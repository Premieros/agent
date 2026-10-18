"use client";

import {useCallback,useEffect,useState} from "react";
import {CheckCircle2,AlertCircle,LoaderCircle,RefreshCw,Link2,BookOpen} from "lucide-react";
import {getSupabase} from "@/lib/supabase-browser";
import {currentSession} from "@/lib/auth-session";

type Saved={repository:string;branch:string;defaultProject:boolean;verified:boolean};
type Project={repository:string;branch:string;url:string;description:string};
type Event={id:string;tool_id:string;status:string;detail:string;created_at:string};

export default function GithubConnectionPanel(){
  const db=getSupabase();
  const [saved,setSaved]=useState<Saved|null>(null);
  const [input,setInput]=useState("Premieros/.com");
  const [confirmed,setConfirmed]=useState<Project|null>(null);
  const [events,setEvents]=useState<Event[]>([]);
  const [working,setWorking]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const credentials=useCallback(async()=>{
    if(!db)throw new Error("سجّل دخولك أولًا.");
    const session=await currentSession(db);
    if(!session?.access_token)throw new Error("انتهت جلسة AGENT. سجّل الدخول مرة أخرى.");
    return {Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"};
  },[db]);

  const refresh=useCallback(async()=>{
    try{
      const headers=await credentials();
      const [p,e]=await Promise.all([
        fetch("/api/assistant/github",{headers,cache:"no-store"}),
        fetch("/api/assistant/tool-events",{headers,cache:"no-store"})
      ]);
      const project=await p.json() as Saved&{error?:string};
      if(!p.ok)throw new Error(project.error||"تعذر تحميل المشروع.");
      setSaved(project);setInput(project.repository);
      if(e.ok){
        const audit=await e.json() as {events?:Event[]};
        setEvents(audit.events||[]);
      }
    }catch(err){setError(err instanceof Error?err.message:"تعذر التحميل.");}
  },[credentials]);

  useEffect(()=>{void refresh();},[refresh]);
  async function act(action:"test"|"connect"){
    if(working)return;
    setWorking(action);setError("");setNotice("");setConfirmed(null);
    try{
      const resp=await fetch("/api/assistant/github",{
        method:"POST",headers:await credentials(),
        body:JSON.stringify({action,repository:input.trim()})
      });
      const payload=await resp.json() as {ok?:boolean;saved?:boolean;project?:Project;error?:string};
      if(!resp.ok||!payload.ok||!payload.project)throw new Error(payload.error||"تعذر الاتصال.");
      setConfirmed(payload.project);
      setNotice(action==="connect"?"تم اختيار المستودع العام لأداة قراءة الكود.":"نجح الاتصال بمعلومات المستودع العام.");
      if(action==="connect")await refresh();
      else {
        const headers=await credentials();
        const e=await fetch("/api/assistant/tool-events",{headers,cache:"no-store"});
        if(e.ok)setEvents(((await e.json()) as {events?:Event[]}).events||[]);
      }
    }catch(err){setError(err instanceof Error?err.message:"فشل التحقق.");}
    finally{setWorking("");}
  }

  return <section className="integration-project-panel" aria-label="إدارة مستودع GitHub">
    <div className="integration-project-heading">
      <div><h2><Link2 size={19}/> مستودع GitHub للمساعد</h2>
        <p>اختار أي مستودع <strong>عام</strong> للاختبار. AGENT يفحص فهرس الملفات ويقرأ مقتطفات عند طلبك، بدون كتابة أو Pull Requests.</p></div>
    </div>
    <div className="integration-project-form">
      <label htmlFor="agent-github-project">رابط المستودع أو owner/repo</label>
      <div className="integration-project-controls">
        <input id="agent-github-project" dir="ltr" spellCheck={false}
          value={input} maxLength={150} onChange={e=>setInput(e.target.value)}
          placeholder="Premieros/.com" aria-label="مستودع GitHub العام"/>
        <button type="button" disabled={Boolean(working)||!input.trim()}
          onClick={()=>void act("test")}>
          {working==="test"?<LoaderCircle size={15}/>:<RefreshCw size={15}/>}
          اختبار الاتصال
        </button>
        <button type="button" className="integration-project-save" disabled={Boolean(working)||!input.trim()}
          onClick={()=>void act("connect")}>
          {working==="connect"?<LoaderCircle size={15}/>:<CheckCircle2 size={15}/>}
          اختيار للمساعد
        </button>
      </div>
    </div>
    {saved&&<div className="integration-project-current">
      <BookOpen size={16}/><span>المشروع المختار: <strong dir="ltr">{saved.repository}</strong> · فرع <b dir="ltr">{saved.branch}</b>
        {saved.defaultProject?" (الافتراضي)":""}</span>
    </div>}
    {confirmed&&<p className="integration-project-ok"><CheckCircle2 size={15}/>
      {notice} <a href={confirmed.url} target="_blank" rel="noopener noreferrer">{confirmed.repository}</a>
    </p>}
    {error&&<p className="integration-project-error"><AlertCircle size={15}/>{error}</p>}
    <p className="integration-project-note">هذه الوصلة لا تفتح مستودعات خاصة ولا تستخدم GitHub OAuth. قد تتطلب المستودعات الخاصة إذن GitHub App في إصدار لاحق.</p>
    <div className="integration-audit-head"><h3>آخر عمليات الأدوات</h3>
      <button type="button" onClick={()=>void refresh()} title="تحديث السجل"><RefreshCw size={14}/></button>
    </div>
    {events.length===0
      ?<p className="integration-project-note">لسه مفيش عمليات مسجلة لحسابك.</p>
      :<div className="integration-audit-list">{events.slice(0,8).map(e=>
        <div key={e.id} className="integration-audit-entry">
          <span>{e.tool_id==="github"?"GitHub":"متصفح"}</span>
          <strong className={e.status==="success"?"ok":""}>
            {e.status==="success"?"نجح":e.status==="partial"?"جزئي":e.status==="disabled"?"موقوف":"تعذر"}
          </strong>
          <span>{e.detail}</span><small>{new Date(e.created_at).toLocaleString("ar-EG")}</small>
        </div>)}</div>}
  </section>;
}
