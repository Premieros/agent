"use client";

import {useCallback,useEffect,useState} from "react";
import {Check,LoaderCircle,ShieldCheck} from "lucide-react";
import {getSupabase} from "@/lib/supabase-browser";
import {currentSession} from "@/lib/auth-session";

type Rule={triggerPhrase:string;enabled:boolean;externalChannelsConnected:boolean;error?:string};

export default function AgentReplyRule({canEdit}:{canEdit:boolean}){
 const db=getSupabase();
 const [phrase,setPhrase]=useState("#مساعد");
 const [enabled,setEnabled]=useState(false);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");

 const headers=useCallback(async()=>{
   if(!db)throw new Error("تعذر اتصال AGENT.");
   const session=await currentSession(db);
   if(!session?.access_token)throw new Error("سجّل الدخول أولًا.");
   return {Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"};
 },[db]);

 const load=useCallback(async()=>{
   try{
     const res=await fetch("/api/assistant/reply-rule",{headers:await headers(),cache:"no-store"});
     const data=await res.json() as Rule;
     if(!res.ok)throw new Error(data.error||"تعذر تحميل شرط الرد.");
     setPhrase(data.triggerPhrase);setEnabled(data.enabled);
   }catch(e){setError(e instanceof Error?e.message:"تعذر تحميل الإعداد.");}
   finally{setLoading(false);}
 },[headers]);
 useEffect(()=>{void load();},[load]);

 async function save(){
   if(saving)return;
   setSaving(true);setError("");setNotice("");
   try{
     const res=await fetch("/api/assistant/reply-rule",{
       method:"POST",headers:await headers(),
       body:JSON.stringify({triggerPhrase:phrase.trim(),enabled})
     });
     const data=await res.json() as Rule&{ok?:boolean};
     if(!res.ok||!data.ok)throw new Error(data.error||"تعذر الحفظ.");
     setPhrase(data.triggerPhrase);
     setNotice("تم حفظ شرط استلام الوكيل.");
   }catch(e){setError(e instanceof Error?e.message:"فشل الحفظ.");}
   finally{setSaving(false);}
 }

 return <div className="agent-reply-rule">
   <div className="agent-reply-rule-title"><ShieldCheck size={16}/><strong>شرط استلام الوكيل</strong>
     <span>العميل يبدأ الرسالة بالكلمة المطلوبة</span>
   </div>
   <div className="agent-reply-rule-controls">
     <label htmlFor="agent-reply-phrase">الكلمة</label>
     <input id="agent-reply-phrase" dir="auto" aria-label="كلمة تشغيل الوكيل"
       value={phrase} onChange={e=>{setPhrase(e.target.value);setNotice("");}}
       maxLength={32} disabled={loading||saving||!canEdit} placeholder="#مساعد"/>
     <label className="agent-reply-rule-switch">
       <input type="checkbox" checked={enabled} disabled={loading||saving||!canEdit}
         onChange={e=>{setEnabled(e.target.checked);setNotice("");}}/>
       <span>{enabled?"الشرط مفعّل":"الشرط متوقف"}</span>
     </label>
     {canEdit&&<button type="button" disabled={loading||saving||phrase.trim().length<2}
       onClick={()=>void save()}>{saving?<LoaderCircle size={15}/>:<Check size={15}/>} حفظ</button>}
   </div>
   <p className="agent-reply-rule-hint">مثال: «{phrase||"#مساعد"} عايز أعرف السعر». بدون الكلمة: للموظف. بعد استلام الموظف: يتوقف الوكيل.</p>
   <p className="agent-reply-rule-warning">ربط رسائل Facebook وWhatsApp الحقيقية لم يكتمل بعد. الإعداد جاهز، لكن لا توجد ردود خارجية الآن.</p>
   {error&&<p role="alert" className="agent-reply-rule-error">{error}</p>}
   {notice&&<p role="status" className="agent-reply-rule-success">{notice}</p>}
 </div>;
}
