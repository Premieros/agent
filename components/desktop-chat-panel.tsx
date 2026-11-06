"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {currentSession} from "@/lib/auth-session";
import {getSupabase} from "@/lib/supabase-browser";
import {parseDesktopChatCommand} from "@/lib/desktop-chat-intent";

type Device={id:string;name:string;last_seen_at:string|null;revoked_at:string|null};
type Job={id:string;action:string;status:string;result?:string|null};
type Line={id:number;role:"user"|"assistant";text:string};
const HELLO="أنا مساعد التحكم في Windows. اربط الكمبيوتر أولًا، ثم اكتب مثلًا: «افتح https://example.com» أو «ابحث عن أنظمة نقاط البيع». لن يُرسل أي أمر قبل موافقتك، ولن يُنفّذ على الجهاز إلا بعد موافقة محلية أخرى.";

export default function DesktopChatPanel(){
  const [devices,setDevices]=useState<Device[]>([]);
  const [selected,setSelected]=useState("");
  const [name,setName]=useState("كمبيوتر Windows");
  const [token,setToken]=useState("");
  const [draft,setDraft]=useState("");
  const [history,setHistory]=useState<Line[]>([{id:0,role:"assistant",text:HELLO}]);
  const [pending,setPending]=useState<{text:string;action:string;arguments:Record<string,unknown>;description:string}|null>(null);
  const [jobs,setJobs]=useState<Job[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const index=useRef(1);
  const end=useRef<HTMLDivElement>(null);
  const say=(role:Line["role"],text:string)=>setHistory(prev=>[...prev.slice(-49),{id:index.current++,role,text}]);
  const api=useCallback(async(path:string,body?:unknown)=>{
    const db=getSupabase();
    if(!db)throw new Error("اتصال AGENT غير متاح.");
    const session=await currentSession(db);
    if(!session)throw new Error("يجب تسجيل الدخول أولًا.");
    const response=await fetch(path,{method:body===undefined?"GET":"POST",
      headers:{"Authorization":"Bearer "+session.access_token,...(body===undefined?{}:{"Content-Type":"application/json"})},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),cache:"no-store"});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"تعذر الاتصال بالخادم.");
    return result;
  },[]);
  const refresh=useCallback(async()=>{
    try{
      const result=await api("/api/desktop/devices");
      const list=result.devices as Device[];
      setDevices(list||[]);
      setSelected(prev=>list?.some(d=>d.id===prev&&!d.revoked_at)?prev:
        list?.find(d=>!d.revoked_at)?.id||"");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
  },[api]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{end.current?.scrollIntoView({block:"nearest",behavior:"smooth"});},[history,pending]);
  const refreshJobs=useCallback(async()=>{
    if(!selected)return;
    try{
      const result=await api("/api/desktop/jobs?deviceId="+encodeURIComponent(selected));
      setJobs(result.jobs||[]);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
  },[api,selected]);
  useEffect(()=>{
    if(!selected)return;
    void refreshJobs();
    const id=setInterval(()=>void refreshJobs(),7000);
    return()=>clearInterval(id);
  },[selected,refreshJobs]);
  async function pair(){
    if(!name.trim())return;
    setBusy(true);setError("");
    try{
      const result=await api("/api/desktop/devices",{action:"pair",name:name.trim()});
      setToken(result.token);
      say("assistant","تم تسجيل الكمبيوتر «"+name.trim()+"». انسخ رمز الربط إلى برنامج PremierAgentCompanion.exe، ثم اضغط بدء الاستقبال داخله.");
      await refresh();
      setSelected(result.device.id);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  const propose=()=>{
    const text=draft.trim();
    if(!text||busy||pending)return;
    say("user",text);setDraft("");setError("");
    const cmd=parseDesktopChatCommand(text);
    if(!cmd){say("assistant","لم أفهم الأمر بما يكفي لتنفيذه بأمان. جرب: «افتح https://example.com»، «ابحث عن التسويق»، «اكتب مرحبًا»، «اضغط عند 400 300» أو «اختصار ctrl+l».");return;}
    if(!selected){say("assistant","يجب ربط كمبيوتر Windows واختياره أولًا قبل إرسال الأوامر.");return;}
    setPending({text,action:cmd.action,arguments:cmd.arguments,description:cmd.description});
    say("assistant","فهمت طلبك: "+cmd.description+"\nهل تسمح بإرساله إلى الجهاز المحدد؟ ستظهر موافقة ثانية على Windows.");
  };
  async function approve(){
    if(!pending||!selected||busy)return;
    setBusy(true);setError("");
    try{
      const submitted=await api("/api/desktop/jobs",{deviceId:selected,action:pending.action,arguments:pending.arguments});
      say("assistant","أرسلت الأمر إلى جهازك (رقم "+String(submitted.job.id).slice(0,8)+"). افتح برنامج Windows ووافق أو ارفض التنفيذ محليًا.");
      setPending(null);
      await refreshJobs();
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  const reject=()=>{setPending(null);say("assistant","تم إلغاء الأمر، ولم يُرسل إلى الكمبيوتر.");};
  const active=devices.find(d=>d.id===selected);
  return <section dir="rtl" aria-label="محادثة التحكم في Windows" style={{border:"1px solid #6f61b6",borderRadius:20,background:"#111a30",color:"#f8f7ff",padding:18,margin:"16px 0 22px",display:"grid",gap:14}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
      <div><h2 style={{fontWeight:800,fontSize:19,margin:0}}>💻 مساعد Windows — دردشة الأوامر</h2>
        <p style={{fontSize:12,color:"#c9c5dc",margin:"6px 0 0"}}>من Studio مباشرة، مع موافقة الموقع والجهاز. لا يوجد تحكم خفي أو تنفيذ تلقائي.</p></div>
      <span style={{fontSize:12,color:active?.last_seen_at?"#a5f3b8":"#e2d6a9"}}>{active?.last_seen_at?"● جهاز مسجل — آخر اتصال "+new Date(active.last_seen_at).toLocaleTimeString("ar-EG"):"○ لا يوجد جهاز متصل مؤكد"}</span>
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <label style={{fontSize:12,flex:"1 1 170px"}}>الكمبيوتر المستهدف
        <select aria-label="الكمبيوتر المستهدف" value={selected} onChange={e=>{setSelected(e.target.value);setPending(null);}} style={{display:"block",width:"100%",marginTop:5,padding:10,borderRadius:10,background:"#222c47",color:"white",border:"1px solid #59617e"}}>
          <option value="">اختر جهازًا</option>{devices.filter(d=>!d.revoked_at).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      <label style={{fontSize:12,flex:"1 1 170px"}}>اسم كمبيوتر جديد
        <input value={name} onChange={e=>setName(e.target.value)} maxLength={80} style={{display:"block",width:"100%",marginTop:5,padding:10,borderRadius:10,background:"#222c47",color:"white",border:"1px solid #59617e"}}/>
      </label>
      <button type="button" disabled={busy} onClick={()=>void pair()} style={{alignSelf:"end",padding:"10px 14px",borderRadius:10,background:"#7953ef",color:"white",fontWeight:700}}>ربط جهاز</button>
    </div>
    {token&&<div style={{background:"#271d32",border:"1px solid #b49d64",padding:12,borderRadius:10}}>
      <strong style={{fontSize:12}}>رمز الربط — يظهر مرة واحدة فقط</strong>
      <code style={{display:"block",overflowWrap:"anywhere",margin:"8px 0",fontSize:12}}>{token}</code>
      <button type="button" onClick={()=>void navigator.clipboard.writeText(token)} style={{padding:"7px 13px",background:"#444060",borderRadius:8}}>نسخ الرمز</button>
      <button type="button" onClick={()=>setToken("")} style={{padding:"7px 13px",marginInlineStart:8}}>إخفاء</button>
    </div>}
    <div role="log" aria-live="polite" style={{height:260,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,padding:12,background:"#0c1325",borderRadius:14}}>
      {history.map(line=><div key={line.id} style={{alignSelf:line.role==="user"?"flex-start":"flex-end",maxWidth:"88%",borderRadius:14,padding:"10px 13px",whiteSpace:"pre-wrap",lineHeight:1.7,fontSize:13,background:line.role==="user"?"#6143c0":"#263350"}}>{line.text}</div>)}
      <div ref={end}/>
    </div>
    {pending&&<div role="group" aria-label="الموافقة على الأمر" style={{border:"1px solid #ac94ff",background:"#211f3c",borderRadius:12,padding:12}}>
      <p style={{margin:"0 0 10px",fontSize:13}}><strong>الأمر بانتظار الموافقة:</strong> {pending.description}</p>
      <button type="button" disabled={busy} onClick={()=>void approve()} style={{background:"#7953ef",borderRadius:9,padding:"9px 16px",fontWeight:700}}>إرسال إلى Windows</button>
      <button type="button" disabled={busy} onClick={reject} style={{padding:"9px 16px",marginInlineStart:8}}>إلغاء</button>
    </div>}
    <form onSubmit={e=>{e.preventDefault();propose();}} style={{display:"flex",gap:8}}>
      <input aria-label="اكتب أمر Windows" value={draft} disabled={busy||Boolean(pending)} maxLength={1500} onChange={e=>setDraft(e.target.value)} placeholder="مثال: افتح المتصفح وابحث عن أسعار اللابتوبات..." style={{minWidth:0,flex:1,padding:12,borderRadius:11,background:"#222c47",color:"white",border:"1px solid #59617e"}} />
      <button type="submit" disabled={busy||Boolean(pending)||!draft.trim()} style={{background:"#7953ef",padding:"11px 17px",borderRadius:10,fontWeight:800,opacity:busy?0.5:1}}>إرسال</button>
    </form>
    {error&&<p role="alert" style={{color:"#ffbdbd",fontSize:13,margin:0}}>{error}</p>}
    <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"space-between",fontSize:12,color:"#bcb8d0"}}>
      <span>الأوامر المتاحة: فتح موقع، بحث، كتابة، نقرة إحداثيات، اختصار.</span>
      <span>آخر أمر: {jobs[0]?jobs[0].action+" — "+jobs[0].status:"لا يوجد"}</span>
    </div>
  </section>;
}
