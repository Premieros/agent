import "server-only";
import {createClient} from "@supabase/supabase-js";
import {randomUUID} from "node:crypto";
import {dispatchAgentProject,fetchAgentExperiment,githubActionsConfigured} from "@/lib/agent-github-actions";
import {parseProjectSpec,publicGithubProjectPreflight,verifiedProjectTest,
 acceptanceKindForModel,repairPreservesTests,type ProjectFile} from "@/lib/agent-project-engine";
import {nextProjectWorkerAction,projectShouldRepair,type AgentProjectPhase} from "@/lib/agent-project-worker-logic";
import {chooseExperiencedModels,recordSandboxExperience} from "@/lib/agent-experience";
import {discoverAutoModels,askAutoAgent} from "@/lib/auto-ai";
import type {AgentSession} from "@/lib/agent-server";

/** Staged background executor. Disabled unless AGENT-specific credentials and a
 * separate authenticated scheduler are explicitly configured. Never user-facing. */
type Row={
 id:string;organization_id:string;user_id:string;status:AgentProjectPhase;
 title:string;steps:string[];task:string;files:ProjectFile[];
 model:string;model_calls:number;github_request_id:string|null;github_run_id:number|null;
 attempts:number;max_attempts:number;approved_at:string|null;deadline_at:string|null;
 execution_log:string;
};
function workerClient(){
 const projectId=process.env.AGENT_PROJECT_WORKER_PROJECT_ID;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.AGENT_PROJECT_WORKER_DB_KEY;
 // Protect against mistakenly pointing the privileged worker at another project.
 if(projectId!=="gldlgdycgneadbqftcrj"||!url||!key)
  throw new Error("AGENT_WORKER_NOT_CONFIGURED");
 const host=new URL(url).hostname;
 if(host!==projectId+".supabase.co")throw new Error("AGENT_WORKER_DATABASE_MISMATCH");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function safeSpec(row:Row){
 return parseProjectSpec(JSON.stringify({title:row.title,steps:row.steps,files:row.files}));
}
export async function runOneAgentProjectWorkerTick(){
 if(!githubActionsConfigured())throw new Error("AGENT_GITHUB_RUNNER_NOT_CONFIGURED");
 const db=workerClient();
 const {data,error}=await db.from("assistant_project_builds").select("*")
  .in("status",["ready","testing","repairing"])
  .not("approved_at","is",null)
  .order("updated_at",{ascending:true}).limit(8);
 if(error)throw error;
 const now=Date.now();
 const row=(data as Row[]||[]).find(item=>
  nextProjectWorkerAction(item.status,item.approved_at,item.deadline_at,
   item.attempts,item.max_attempts,now)!=="none");
 if(!row)return {processed:false,action:"none"};
 const action=nextProjectWorkerAction(row.status,row.approved_at,row.deadline_at,
  row.attempts,row.max_attempts,now);
 const session:AgentSession={db,userId:row.user_id,organizationId:row.organization_id,role:"worker"};
 const where=()=>db.from("assistant_project_builds").update({updated_at:new Date().toISOString()})
  .eq("id",row.id).eq("organization_id",row.organization_id).eq("user_id",row.user_id)
  .eq("status",row.status);
 if(action==="expire"){
  await where().update({status:"failed",test_passed:false,stage_note:"انتهت مهلة التشغيل دون إعادة إرسال تلقائية."});
  return {processed:true,action};
 }
 if(action==="poll"){
  if(!row.github_request_id)return {processed:false,action:"missing_request_id"};
  const trace=await fetchAgentExperiment(row.github_request_id,row.github_run_id);
  if(!trace.found)return {processed:true,action:"queued"};
  const finished=trace.status==="completed";
  const success=verifiedProjectTest(trace.log,trace.conclusion,acceptanceKindForModel(row.model));
  const actualExit=/\[exit=(-?\d+)\]/.exec(trace.log);
  const expired=Boolean(row.deadline_at&&
   Date.now()>=new Date(row.deadline_at).getTime());
  const next=finished?(success&&!expired?"completed":
   projectShouldRepair(success,finished,Boolean(actualExit&&actualExit[1]!=="0"),
    row.attempts,row.max_attempts,row.model_calls,expired)?"repairing":"failed"):"testing";
  const {data:updated,error:e}=await db.from("assistant_project_builds").update({
   status:next,github_run_id:trace.runId,
   ...(finished?{test_passed:success&&!expired}:{}),
   stage_note:finished?(success&&!expired?"اجتاز الاختبارات الفعلية.":next==="repairing"?
    "يجري تجهيز إصلاح واحد.":"لم يجتز الاختبارات."):"GitHub Actions: "+trace.status,
   execution_log:(row.execution_log+"\n"+trace.log).slice(-14000),
   updated_at:new Date().toISOString()
  }).eq("id",row.id).eq("organization_id",row.organization_id)
   .eq("user_id",row.user_id).eq("status","testing")
   .eq("github_request_id",row.github_request_id).select("id").maybeSingle();
  if(e)throw e;
  if(updated&&finished&&actualExit&&["completed","failed"].includes(next)){
   await recordSandboxExperience(session,{id:row.id,task:row.task,model:row.model,
    sandbox_ran:true},success&&!expired,"github").catch(()=>{});
  }
  return {processed:Boolean(updated),action:"poll",status:next};
 }
 if(action==="dispatch"){
  const spec=safeSpec(row),check=publicGithubProjectPreflight(spec.files);
  if(!check.ok)return {processed:false,action:"unsafe_manifest"};
  const requestId=randomUUID();
  const {data:claimed,error:e}=await db.from("assistant_project_builds").update({
   status:"testing",attempts:row.attempts+1,github_request_id:requestId,
   github_run_id:null,test_passed:null,updated_at:new Date().toISOString(),
   stage_note:"بدأ الاختبار تلقائيًا في GitHub."
  }).eq("id",row.id).eq("organization_id",row.organization_id)
   .eq("user_id",row.user_id).eq("status","ready")
   .eq("attempts",row.attempts).select("id").maybeSingle();
  if(e)throw e;
  if(!claimed)return {processed:false,action:"already_claimed"};
  try{
   await dispatchAgentProject({requestId,files:spec.files,
    acceptanceKind:acceptanceKindForModel(row.model)});
  }catch{
   // GitHub may have received it. Do not dispatch twice.
   await db.from("assistant_project_builds").update({stage_note:
    "لم نتأكد من قبول GitHub؛ تم الاحتفاظ بالمعرّف للمتابعة دون إرسال متكرر."})
    .eq("id",row.id).eq("github_request_id",requestId);
  }
  return {processed:true,action:"dispatch"};
 }
 if(action==="repair"){
  if(row.model_calls!==1)return {processed:false,action:"repair_not_eligible"};
  const {data:claimed,error:e}=await db.from("assistant_project_builds").update({
   status:"testing",github_request_id:null,github_run_id:null,model_calls:2,
   stage_note:"إصلاح تلقائي محدود بمحاولة نموذج واحدة.",updated_at:new Date().toISOString()
  }).eq("id",row.id).eq("organization_id",row.organization_id)
   .eq("user_id",row.user_id).eq("status","repairing")
   .eq("model_calls",1).select("id").maybeSingle();
  if(e)throw e;
  if(!claimed)return {processed:false,action:"already_claimed"};
  try{
   const candidates=await chooseExperiencedModels(session,await discoverAutoModels(false),"coding");
   if(!candidates.length)throw Error("NO_FREE_MODEL_AVAILABLE");
   const revised=await askAutoAgent(candidates.slice(0,1),"AGENT repair",
    "أصلح كود التطبيق ولا تعدّل الاختبارات الموجودة. أرجع JSON يشمل title,steps,files كاملة. Node built-ins فقط.",
    "TASK:\n"+row.task.slice(0,1800)+"\nFILES:\n"+
    JSON.stringify(row.files).slice(0,18000)+"\nLOG:\n"+row.execution_log.slice(-3900),
    3000,"general",38000);
   const spec=parseProjectSpec(revised.text);
   if(!repairPreservesTests(safeSpec(row),spec))throw Error("REPAIR_CHANGED_TESTS");
   if(!publicGithubProjectPreflight(spec.files).ok)throw Error("UNSAFE_REPAIR");
   if(JSON.stringify(row.files)===JSON.stringify(spec.files))throw Error("NO_REPAIR_CHANGE");
   if(Date.now()>=new Date(row.deadline_at||"").getTime())throw Error("REPAIR_TIMEOUT");
   await db.from("assistant_project_builds").update({
    status:"ready",title:spec.title,steps:spec.steps,files:spec.files,
    model:revised.model,stage_note:"أُصلح الكود؛ إعادة الاختبار بنفس الموافقة.",
    updated_at:new Date().toISOString()
   }).eq("id",row.id).eq("user_id",row.user_id).eq("status","testing")
    .is("github_request_id",null);
   return {processed:true,action:"repair"};
  }catch{
   await db.from("assistant_project_builds").update({
    status:"failed",test_passed:false,
    stage_note:"تعذر الإصلاح ضمن حدود النموذج المجاني والمحاولات المعتمدة.",
    updated_at:new Date().toISOString()
   }).eq("id",row.id).eq("user_id",row.user_id).eq("status","testing")
    .is("github_request_id",null);
   return {processed:true,action:"repair_failed"};
  }
 }
 return {processed:false,action:"none"};
}
