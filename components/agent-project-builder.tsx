"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {Download,LoaderCircle,Save,Terminal,ShieldCheck} from "lucide-react";

type ProjectFile={path:string;content:string};
type ProjectBuild={
 id:string;title:string;task:string;steps:string[];files:ProjectFile[];
 status:"planned"|"ready"|"testing"|"repairing"|"completed"|"failed";
 approved_at:string|null;max_attempts:number;attempts:number;model_calls:number;
 github_run_id:number|null;
 stage_note:string;execution_log:string;test_passed:boolean|null;saved_artifact_id:string|null;
};
type Props={
 threadId:string;refreshKey:number;
 authHeaders:()=>Promise<Record<string,string>>;
 apiFetch:(url:string,init?:RequestInit)=>Promise<Response>;
};
export default function AgentProjectBuilder({threadId,refreshKey,authHeaders,apiFetch}:Props){
 const [project,setProject]=useState<ProjectBuild|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [note,setNote]=useState("");
 const [maxAttempts,setMaxAttempts]=useState<1|2>(2);
 const [showTerminal,setShowTerminal]=useState(false);
 const active=useRef(false);
 const haltedStep=useRef("");
 const load=useCallback(async()=>{
  if(!threadId)return;
  try{
   const res=await apiFetch("/api/assistant/projects?threadId="+encodeURIComponent(threadId),
    {headers:await authHeaders(),cache:"no-store"});
   if(!res.ok)return;
   const data=await res.json() as {project:ProjectBuild|null};
   setProject(data.project||null);
  }catch{/* Main chat stays available independently. */}
 },[threadId,refreshKey,apiFetch,authHeaders]);
 useEffect(()=>{void load();},[load]);
 async function post(action:string,payload:Record<string,unknown>={}){
  const res=await apiFetch("/api/assistant/projects",{
   method:"POST",headers:await authHeaders(),
   body:JSON.stringify({action,id:project?.id,...payload})
  });
  const data=await res.json() as {error?:string;ok?:boolean;status?:string;itemId?:string};
  if(!res.ok||!data.ok)throw new Error(data.error||"تعذر متابعة بناء التطبيق.");
  return data;
 }
 async function approve(){
  if(!project||project.status!=="planned"||busy)return;
  setBusy(true);setError("");setNote("");
  try{
   await post("approve",{maxAttempts});
   setNote("سمحت بتشغيل ملفات هذا المشروع على GitHub Actions؛ لن يطلب AGENT الموافقة مجددًا أثناء اختباراته وإصلاحه.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر اعتماد الحدود.");}
  finally{setBusy(false);}
 }
 const advance=useCallback(async()=>{
  if(!project||active.current||!["ready","repairing"].includes(project.status)||
    haltedStep.current===project.id+":"+project.status+":"+project.attempts)return;
  active.current=true;setBusy(true);setError("");
  try{
   await post("advance");
   await load();
  }catch(e){
   haltedStep.current=project.id+":"+project.status+":"+project.attempts;
   setError(e instanceof Error?e.message:"توقف التنفيذ؛ افتح حالة المشروع مجددًا.");
   await load();
  }finally{active.current=false;setBusy(false);}
 // State transition triggers the effect; no client retries while testing.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[project?.id,project?.status,apiFetch,authHeaders,load]);
 useEffect(()=>{
  if(project?.approved_at&&["ready","repairing"].includes(project.status)&&!busy&&
    haltedStep.current!==project.id+":"+project.status+":"+project.attempts){
   void advance();
  }
 },[project?.id,project?.status,project?.approved_at,busy,advance]);
 useEffect(()=>{
  if(project?.status!=="testing"||!threadId)return;
  const timer=setInterval(()=>{void load();},3200);
  return()=>clearInterval(timer);
 },[project?.id,project?.status,threadId,load]);
 async function download(){
  if(!project)return;
  setBusy(true);setError("");
  try{
   const res=await apiFetch("/api/assistant/projects/download?id="+encodeURIComponent(project.id),
     {headers:await authHeaders(),cache:"no-store"});
   if(!res.ok)throw new Error("تعذر تنزيل ملف المشروع.");
   const url=URL.createObjectURL(await res.blob());
   const link=document.createElement("a");link.href=url;
   link.download="AGENT-app-"+project.id.slice(0,8)+".zip";
   document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);
  }catch(e){setError(e instanceof Error?e.message:"تعذر التنزيل.");}
  finally{setBusy(false);}
 }
 async function save(){
  if(!project)return;
  setBusy(true);setError("");
  try{await post("save");setNote("حُفظ ZIP في مكتبة AGENT الخاصة.");await load();}
  catch(e){setError(e instanceof Error?e.message:"تعذر الحفظ.");}
  finally{setBusy(false);}
 }
 if(!project)return null;
 const finished=project.status==="completed"||project.status==="failed";
 return <section className="assistant-work-steps agent-work-terminal" aria-label="مشروع AGENT متعدد الملفات">
  <div className="agent-work-terminal-head">
   <strong><ShieldCheck size={15}/> بناء تطبيق مستقل · {project.title}</strong>
  </div>
  <div className="agent-work-verdict" role="status" aria-live="polite">
   <strong>{project.status==="planned"?"المشروع جاهز لمراجعتك":
     project.status==="completed"?"اكتمل اختبار التطبيق":
     project.status==="failed"?"توقف البناء عند الحد المحدد":
     project.status==="repairing"?"تحليل الأخطاء وإصلاح الملفات":
     project.status==="testing"?"تشغيل اختبارات التطبيق":"جاهز لخطوة الاختبار التالية"}</strong>
   <p>{project.stage_note}</p>
   <small>{project.files.length} ملفات · المحاولة {project.attempts}/{project.max_attempts} · استدعاءات النموذج {project.model_calls}/2 · GitHub Actions · دون نشر أو دمج</small>
  </div>
  {project.status==="planned"&&<>
   <div className="agent-work-plan">
    {(project.steps||[]).map((step,i)=><span key={i}>{i+1}. {step}</span>)}
   </div>
   <details className="agent-work-code-review" open>
    <summary>مراجعة ملفات التطبيق قبل الموافقة</summary>
    {project.files.map(file=><details key={file.path}>
     <summary>{file.path} ({file.content.length} حرف)</summary>
     <pre dir="ltr">{file.content}</pre>
    </details>)}
   </details>
   <label className="agent-work-runner-select">الحد الأقصى لمحاولات الاختبار
    <select value={maxAttempts} onChange={e=>setMaxAttempts(e.target.value==="1"?1:2)}>
     <option value={1}>محاولة واحدة، دون إصلاح</option>
     <option value={2}>محاولتان، مع إصلاح واحد كحد أقصى</option>
    </select>
   </label>
   <small>المهلة الكلية 12 دقيقة متضمنة انتظار GitHub، والاختبار داخل حاوية بلا شبكة بحد 45 ثانية في كل محاولة؛ حدّ أقصى لاختبارين وإصلاح مجاني واحد عند الحاجة. GitHub Actions في مستودع عام وقد تظهر المدخلات والسجلات؛ لا ترسل أسرارًا أو بيانات خاصة. لا تُطلب موافقة لكل خطوة.</small>
   <div className="agent-work-controls"><button type="button" disabled={busy}
    onClick={()=>void approve()}>أسمح بإرسال هذا المشروع العام وبدء الاختبار</button></div>
  </>}
  {project.status==="testing"||project.status==="repairing"||project.status==="ready"?
   <p role="status"><LoaderCircle className="crm-spin" size={15}/> {project.stage_note}</p>:null}
  {project.github_run_id&&<a target="_blank" rel="noopener noreferrer"
    href={"https://github.com/Premieros/agent/actions/runs/"+project.github_run_id}>فتح سجل GitHub Actions</a>}
  {finished&&<div className="agent-work-controls">
   <button type="button" onClick={()=>void download()} disabled={busy}>
    <Download size={14}/> تنزيل التطبيق ZIP
   </button>
   <button type="button" onClick={()=>void save()} disabled={busy||Boolean(project.saved_artifact_id)}>
    <Save size={14}/> {project.saved_artifact_id?"محفوظ في المكتبة":"حفظ ZIP في المكتبة"}
   </button>
  </div>}
  <div className="agent-work-log-toggle">
   <button type="button" aria-expanded={showTerminal} onClick={()=>setShowTerminal(v=>!v)}>
    <Terminal size={14}/> {showTerminal?"إخفاء الترمنال":"عرض الترمنال الفعلي"}
   </button>
  </div>
  {showTerminal&&<pre className="agent-work-stdout" dir="ltr">
   {project.execution_log||"$ waiting for approval / execution"}
  </pre>}
  {error&&<p role="alert">{error} {project.approved_at&&
   ["ready","repairing"].includes(project.status)&&
   <button type="button" disabled={busy} onClick={()=>{
    haltedStep.current="";setError("");void advance();
   }}>إعادة المحاولة يدويًا</button>}</p>}
  {note&&<p role="status">{note}</p>}
 </section>;
}
