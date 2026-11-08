"use client";

import {useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {KeyRound,LockKeyhole,ShieldCheck,UnlockKeyhole} from "lucide-react";
import {getSupabase} from "@/lib/supabase-browser";
import {currentSession} from "@/lib/auth-session";
import {checkQuickPin,createQuickPin,normalizePin,parseQuickPin,quickPinKey,
 type QuickPinRecord,PIN_ATTEMPT_LIMIT} from "@/lib/quick-pin";

type Mode="checking"|"ready"|"locked"|"setup"|"confirm";
const loginUrl="/crm?view=account";

/**
 * Convenience lock for an EXISTING authenticated browser session only.
 * Never creates a new Supabase session or overrides server JWT/RLS checks.
 * The PIN is a local UI privacy barrier, not a replacement for full sign-in.
 */
export default function QuickPinControl(){
 const db=getSupabase();
 const [mode,setMode]=useState<Mode>("checking");
 const [userId,setUserId]=useState("");
 const [record,setRecord]=useState<QuickPinRecord|null>(null);
 const [entry,setEntry]=useState("");
 const [first,setFirst]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");

 useEffect(()=>{
  if(!db){setMode("ready");return;}
  let active=true,sequence=0;
  const {data:{subscription}}=db.auth.onAuthStateChange((event)=>{
   if(!["INITIAL_SESSION","SIGNED_IN","SIGNED_OUT"].includes(event))return;
   const stamp=++sequence;
   // Wait until Supabase's auth lock is released before resolving the session.
   setTimeout(()=>{
    void (async()=>{
     if(event==="SIGNED_OUT"){
      if(!active||stamp!==sequence)return;
      setUserId("");setRecord(null);setEntry("");setFirst("");setMode("ready");
      return;
     }
     const session=await currentSession(db);
     if(!active||stamp!==sequence)return;
     if(!session?.access_token){
      setUserId("");setRecord(null);setMode("ready");return;
     }
     const id=session.user.id;
     let pinRecord:QuickPinRecord|null=null;
     try{pinRecord=parseQuickPin(window.localStorage.getItem(quickPinKey(id)));}
     catch{/* Local storage disabled: ordinary Supabase login still works. */}
     setUserId(id);setRecord(pinRecord);
     // A returning browser session gets a privacy lock; a newly completed
     // full login is allowed through. Never replace expired auth with PIN.
     setMode(old=>old==="locked"?"locked":event==="INITIAL_SESSION"&&pinRecord?"locked":"ready");
    })();
   },0);
  });
  return()=>{active=false;sequence++;subscription.unsubscribe();};
 },[db]);

 function reset(mode:Mode="ready"){
  setEntry("");setFirst("");setMessage("");setMode(mode);
 }
 async function fullSignIn(){
  if(!db)return;
  setBusy(true);
  // A full sign-in discards the old Supabase session. The saved PIN cannot
  // restore it or act as a standalone password.
  await db.auth.signOut();
  window.location.assign(loginUrl);
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy||!db||!userId)return;
  const pin=normalizePin(entry);
  if(pin.length!==4){setMessage("أدخل أربعة أرقام كاملة.");return;}
  setBusy(true);setMessage("");
  try{
   const session=await currentSession(db);
   const {data,error}=session?.access_token?await db.auth.getUser(session.access_token):
    {data:{user:null},error:new Error("Session expired")};
   if(!session||error||data.user?.id!==userId){
    setMessage("انتهت الجلسة أو تغيّر الحساب. سجل الدخول بالبريد أو كلمة المرور.");
    setMode("locked");return;
   }
   if(mode==="setup"){
    setFirst(pin);setEntry("");setMode("confirm");return;
   }
   if(mode==="confirm"){
    if(pin!==first){setFirst("");setEntry("");setMode("setup");setMessage("الرمزان غير متطابقين. حاول تعيين الرمز مرة أخرى.");return;}
    const next=await createQuickPin(pin,userId);
    window.localStorage.setItem(quickPinKey(userId),JSON.stringify(next));
    setRecord(next);reset("ready");return;
   }
   if(mode==="locked"&&record){
    const attempt=await checkQuickPin(pin,userId,record);
    window.localStorage.setItem(quickPinKey(userId),JSON.stringify(attempt.record));
    setRecord(attempt.record);setEntry("");
    if(attempt.ok){reset("ready");return;}
    if(attempt.blockedUntil>Date.now()){
     setMessage("توقفت المحاولات مؤقتًا لمدة 15 دقيقة. يمكنك تسجيل الدخول بالطريقة الأساسية.");
    }else{
     const left=PIN_ATTEMPT_LIMIT-attempt.record.failedAttempts;
     setMessage("رمز غير صحيح. المحاولات المتبقية: "+left);
    }
   }
  }catch{
   setMessage("تعذر استخدام رمز الجهاز. جرّب تسجيل الدخول الأساسي.");
  }finally{setBusy(false);}
 }
 function removePin(){
  if(!userId||!window.confirm("هل تريد إلغاء الرمز السريع على هذا الجهاز؟"))return;
  try{window.localStorage.removeItem(quickPinKey(userId));}catch{}
  setRecord(null);reset("ready");
 }

 const setup=mode==="setup"||mode==="confirm";
 const showOverlay=mode==="checking"||mode==="locked"||setup;
 return <>
  {Boolean(userId)&&mode==="ready"&&<div className="agent-pin-menu" aria-label="خيارات الدخول السريع">
   <button type="button" onClick={()=>reset(record?"locked":"setup")}>
    {record?<LockKeyhole size={16}/>:<KeyRound size={16}/>}
    {record?"قفل سريع":"تفعيل رمز ٤ أرقام"}
   </button>
   {record&&<button type="button" className="agent-pin-remove" onClick={removePin}>إلغاء PIN</button>}
  </div>}
  {showOverlay&&<div className="agent-pin-overlay" role="dialog" aria-modal="true"
      aria-label="قفل دخول AGENT السريع">
    <div className="agent-pin-card">
     {mode==="checking"?<p role="status">جارٍ التحقق من جلسة AGENT...</p>:<>
      <div className="agent-pin-mark">{mode==="locked"?<LockKeyhole size={25}/>:<ShieldCheck size={25}/>}</div>
      <h2>{mode==="locked"?"الفتح السريع — AGENT":mode==="confirm"?"تأكيد الرمز":"تفعيل رمز الجهاز"}</h2>
      <p>{mode==="locked"?"أدخل رمزك المكوّن من 4 أرقام لفتح الواجهة على هذا الجهاز، بشرط استمرار تسجيل الدخول.":
       mode==="confirm"?"أعد إدخال الأرقام الأربعة للتأكيد.":
       "اختر رمزًا من 4 أرقام لفتح الواجهة في المرات القادمة على هذا المتصفح."}</p>
      <form onSubmit={e=>void submit(e)}>
       <label htmlFor="agent-quick-pin">الرمز الرباعي</label>
       <input id="agent-quick-pin" type="password" inputMode="numeric" autoComplete="off"
        pattern="[0-9]{4}" maxLength={4} value={entry} autoFocus
        onChange={e=>setEntry(normalizePin(e.target.value))}
        placeholder="••••" aria-describedby="agent-pin-hint" required/>
       <div className="agent-pin-dots" aria-hidden="true">
        {[0,1,2,3].map(i=><span key={i} className={entry.length>i?"filled":""}/>)}
       </div>
       {message&&<p className="agent-pin-error" role="alert">{message}</p>}
       <button type="submit" disabled={busy||entry.length!==4}>
        {busy?"جارٍ التحقق...":mode==="locked"?"فتح الواجهة":mode==="confirm"?"تفعيل الرمز":"متابعة"}
        {!busy&&mode==="locked"&&<UnlockKeyhole size={17}/>}
       </button>
      </form>
      {setup?<button className="agent-pin-secondary" type="button" onClick={()=>reset("ready")}>إلغاء</button>
       :<button className="agent-pin-secondary" type="button" disabled={busy}
        onClick={()=>void fullSignIn()}>الدخول بالبريد أو كلمة المرور</button>}
      <small id="agent-pin-hint">الرمز مخصص لقفل الواجهة محليًا فقط؛ الصلاحيات والجلسة الآمنة لا تزال تُراجع على الخادم. لا يمكن للرمز استعادة جلسة منتهية.</small>
      {mode==="locked"&&<Link href={loginUrl} onClick={e=>{e.preventDefault();void fullSignIn();}} className="agent-pin-help">تغيير الحساب</Link>}
     </>}
    </div>
   </div>}
 </>;
}
