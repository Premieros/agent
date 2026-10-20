import {NextRequest,NextResponse} from "next/server";
import {requireAgentSession,errorResponse} from "@/lib/agent-server";
import {createPortableExperimentZip} from "@/lib/agent-project-bundle";

export const runtime="nodejs";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Download an independently runnable archive; never check into AGENT. */
export async function GET(req:NextRequest){
  try{
    const session=await requireAgentSession(req);
    const runId=new URL(req.url).searchParams.get("runId");
    if(!runId||!uuid.test(runId))
      return NextResponse.json({error:"معرّف البرنامج غير صحيح."},{status:400});
    const {data:run,error}=await session.db.from("assistant_work_runs")
      .select("id,task,steps,code,status,sandbox_ran,sandbox_succeeded,execution_log,github_run_id")
      .eq("id",runId).eq("organization_id",session.organizationId)
      .eq("user_id",session.userId).maybeSingle();
    if(error)throw error;
    if(!run)return NextResponse.json({error:"البرنامج غير موجود."},{status:404});
    if(!["executed","completed","failed"].includes(String(run.status))||
      typeof run.code!=="string"||!run.code.trim())
      return NextResponse.json({error:"البرنامج غير جاهز للتسليم بعد. أكمل المراجعة والتجربة أولًا."},
        {status:409});
    const zip=createPortableExperimentZip({
      id:run.id,task:String(run.task||""),
      code:run.code,steps:Array.isArray(run.steps)?run.steps:[],
      status:run.status,sandbox_ran:Boolean(run.sandbox_ran),
      sandbox_succeeded:typeof run.sandbox_succeeded==="boolean"?run.sandbox_succeeded:null,
      execution_log:run.execution_log,github_run_id:run.github_run_id
    });
    const body=new Uint8Array(new ArrayBuffer(zip.byteLength));
    body.set(zip);
    return new NextResponse(body,{
      status:200,headers:{
        "Content-Type":"application/zip",
        "Content-Disposition":'attachment; filename="AGENT-program-'+run.id.slice(0,8)+'.zip"',
        "Content-Length":String(zip.byteLength),
        "Cache-Control":"private, no-store",
        "X-Content-Type-Options":"nosniff"
      }
    });
  }catch(e){
    const x=errorResponse(e);
    return NextResponse.json({error:x.message},{status:x.status,headers:{"Cache-Control":"no-store"}});
  }
}
