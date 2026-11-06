"use client";

import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {getSupabase} from "@/lib/supabase-browser";
import {currentSession} from "@/lib/auth-session";

type Device={id:string;name:string;last_seen_at:string|null;revoked_at:string|null};
type Job={id:string;action:string;arguments:Record<string,unknown>;status:string;result:string|null;created_at:string};
type Action="open_url"|"click"|"type_text"|"hotkey";
export default function DesktopControl(){
  const [devices,setDevices]=useState<Device[]>([]);
  const [jobs,setJobs]=useState<Job[]>([]);
  const [selected,setSelected]=useState("");
  const [name,setName]=useState("كمبيوتر Windows");
  const [token,setToken]=useState("");
  const [action,setAction]=useState<Action>("open_url");
  const [value,setValue]=useState("https://example.com");
  const [x,setX]=useState("400");
  const [y,setY]=useState("300");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  const api=useCallback(async(path:string,body?:unknown)=>{
    const db=getSupabase();
    if(!db)throw new Error("تعذر الاتصال بالموقع.");
    const session=await currentSession(db);
    if(!session)throw new Error("سجّل الدخول إلى AGENT أولًا.");
    const response=await fetch(path,{
      method:body===undefined?"GET":"POST",
      headers:{"Authorization":"Bearer "+session.access_token,...(body===undefined?{}:{"Content-Type":"application/json"})},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),cache:"no-store"
    });
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"تعذر تنفيذ الطلب.");
    return result;
  },[]);
  const refresh=useCallback(async()=>{
    try{
      const data=await api("/api/desktop/devices");
      setDevices(data.devices||[]);
    }catch(e){setMessage(String(e instanceof Error?e.message:e));}
  },[api]);
  const refreshJobs=useCallback(async(id:string)=>{
    if(!id)return;
    try{
      const data=await api("/api/desktop/jobs?deviceId="+encodeURIComponent(id));
      setJobs(data.jobs||[]);
    }catch(e){setMessage(String(e instanceof Error?e.message:e));}
  },[api]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    if(!selected)return;
    void refreshJobs(selected);
    const timer=setInterval(()=>void refreshJobs(selected),8000);
    return()=>clearInterval(timer);
  },[selected,refreshJobs]);
  const execute=async(fn:()=>Promise<void>)=>{
    setBusy(true);setMessage("");
    try{await fn();}catch(e){setMessage(String(e instanceof Error?e.message:e));}
    finally{setBusy(false);}
  };
  const pair=()=>void execute(async()=>{
    const data=await api("/api/desktop/devices",{action:"pair",name});
    setToken(data.token);
    setSelected(data.device.id);
    setMessage("تم إصدار رمز جهاز لمرة واحدة. انسخه الآن إلى برنامج Windows.");
    await refresh();
  });
  const send=()=>void execute(async()=>{
    if(!selected)throw new Error("اختر الجهاز أولًا.");
    let args:Record<string,unknown>;
    if(action==="open_url")args={url:value};
    else if(action==="click")args={x:Number(x),y:Number(y)};
    else if(action==="type_text")args={text:value};
    else args={keys:value.toLowerCase().split("+").map(s=>s.trim())};
    if(!window.confirm("هل تريد إرسال هذا الأمر إلى الكمبيوتر؟ سيطلب برنامج Windows موافقة محلية ثانية قبل التنفيذ."))return;
    await api("/api/desktop/jobs",{deviceId:selected,action,arguments:args});
    setMessage("تم إرسال الأمر إلى قائمة الانتظار؛ انتظر موافقة الجهاز.");
    await refreshJobs(selected);
  });
  const revoke=(id:string)=>void execute(async()=>{
    if(!window.confirm("إلغاء ربط هذا الكمبيوتر؟ لن يقبل أي أوامر جديدة."))return;
    await api("/api/desktop/devices",{action:"revoke",deviceId:id});
    if(selected===id){setSelected("");setJobs([]);}
    await refresh();
  });
  return <main dir="rtl" className="min-h-screen bg-[#0c1021] px-4 py-10 text-white sm:px-10">
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-black">التحكم في كمبيوتر Windows</h1>
          <p className="mt-2 text-sm text-slate-300">أوامر مسموحة فقط، مع تأكيد من الموقع وموافقة على الجهاز قبل التنفيذ.</p>
        </div>
        <Link href="/assistant" className="rounded-xl border border-slate-600 px-4 py-2 text-sm">العودة إلى AGENT</Link>
      </header>
      {message&&<p role="status" className="rounded-xl border border-violet-500/40 bg-violet-500/10 p-3 text-sm">{message}</p>}
      <section className="rounded-2xl border border-slate-700 bg-[#151b31] p-5">
        <h2 className="text-lg font-bold">1. ربط الكمبيوتر</h2>
        <p className="mt-2 text-sm text-slate-300">ثبّت برنامج Windows، ثم أنشئ رمز اتصال وانسخه مرة واحدة. لا تشارك الرمز مع الآخرين.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input aria-label="اسم الكمبيوتر" value={name} maxLength={80} onChange={e=>setName(e.target.value)}
            className="min-w-44 flex-1 rounded-lg border border-slate-600 bg-[#0b1122] p-3" />
          <button disabled={busy} onClick={pair} className="rounded-lg bg-violet-600 px-5 py-3 font-bold disabled:opacity-40">إنشاء رمز الربط</button>
        </div>
        {token&&<div className="mt-3 rounded-xl border border-amber-500/50 p-3">
          <p className="mb-2 text-xs text-amber-200">يظهر الرمز مرة واحدة فقط. انسخه إلى برنامج Windows ولا تحتفظ به في مكان عام.</p>
          <code className="block break-all text-sm">{token}</code>
          <button className="mt-3 rounded-lg bg-slate-700 px-3 py-2 text-xs" onClick={()=>void navigator.clipboard.writeText(token)}>نسخ الرمز</button>
          <button className="ms-2 text-xs underline" onClick={()=>setToken("")}>إخفاء الرمز</button>
        </div>}
        <div className="mt-4 space-y-2">
          {devices.map(d=><div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 p-3">
            <label className="flex items-center gap-2"><input type="radio" name="device" checked={selected===d.id} onChange={()=>setSelected(d.id)}/>
              <span>{d.name}</span><span className="text-xs text-slate-400">{d.revoked_at?"ملغى":d.last_seen_at?"آخر اتصال: "+new Date(d.last_seen_at).toLocaleString("ar-EG"):"لم يتصل بعد"}</span>
            </label>
            {!d.revoked_at&&<button onClick={()=>revoke(d.id)} className="text-xs text-rose-300">إلغاء الربط</button>}
          </div>)}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-700 bg-[#151b31] p-5">
        <h2 className="text-lg font-bold">2. إرسال أمر</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">نوع الأمر
            <select value={action} onChange={e=>{const next=e.target.value as Action;setAction(next);setValue(next==="open_url"?"https://example.com":next==="hotkey"?"ctrl+l":"");}}
              className="block w-full rounded-lg border border-slate-600 bg-[#0b1122] p-3">
              <option value="open_url">فتح موقع في المتصفح</option>
              <option value="click">نقرة بالماوس</option>
              <option value="type_text">كتابة نص</option>
              <option value="hotkey">اختصار لوحة مفاتيح</option>
            </select>
          </label>
          {action==="click"?<div className="flex gap-2">
            <label className="flex-1 text-sm">X<input value={x} onChange={e=>setX(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-[#0b1122] p-3"/></label>
            <label className="flex-1 text-sm">Y<input value={y} onChange={e=>setY(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-[#0b1122] p-3"/></label>
          </div>:<label className="space-y-1 text-sm">{action==="open_url"?"رابط HTTPS":action==="hotkey"?"اختصار مثل ctrl+l":"النص المراد كتابته"}
            <input value={value} maxLength={1500} onChange={e=>setValue(e.target.value)}
              className="block w-full rounded-lg border border-slate-600 bg-[#0b1122] p-3"/>
          </label>}
        </div>
        <button disabled={busy||!selected} onClick={send} className="mt-4 rounded-lg bg-violet-600 px-6 py-3 font-bold disabled:opacity-40">إرسال إلى الجهاز</button>
        <p className="mt-2 text-xs text-slate-400">لا يتوفر تنفيذ أوامر PowerShell أو الوصول الصامت إلى الملفات. يجب فتح البرنامج والموافقة على كل أمر محليًا.</p>
      </section>
      <section className="rounded-2xl border border-slate-700 bg-[#151b31] p-5">
        <h2 className="text-lg font-bold">3. سجل الأوامر</h2>
        <div className="mt-3 space-y-2">{jobs.length?jobs.map(j=><div key={j.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm">
          <span>{j.action}</span><span className="text-slate-300">{j.status}</span><span className="text-xs text-slate-400">{j.result||new Date(j.created_at).toLocaleString("ar-EG")}</span>
        </div>):<p className="text-sm text-slate-400">لا توجد أوامر لعرضها.</p>}</div>
      </section>
    </div>
  </main>;
}
