"use client";

import {useEffect,useState} from "react";
import {getSupabase} from "@/lib/supabase-browser";
import {currentSession} from "@/lib/auth-session";

const PREMIER_ORIGIN="https://premieros-sage.vercel.app";
type ChatSnapshot={conversations:unknown[];messages:unknown[]};

export default function PremierInboxBridge(){
 const db=getSupabase();
 const [status,setStatus]=useState("جارٍ التحقق من صلاحيات إدارة AGENT...");
 const [error,setError]=useState("");
 useEffect(()=>{
  if(!db)return;
  let canceled=false;
  const run=async()=>{
   try{
    const params=new URLSearchParams(window.location.search);
    const requestId=params.get("requestId")||"";
    if(!window.opener||!/^[a-zA-Z0-9-]{8,100}$/.test(requestId))
     throw new Error("افتح هذه النافذة من صفحة دعم العملاء في Premier.");
    const session=await currentSession(db);
    if(!session)throw new Error("سجّل الدخول إلى AGENT أولًا في هذه النافذة ثم أعد المحاولة من Premier.");
    const response=await fetch("/api/support/conversations/export",{
     cache:"no-store",headers:{Authorization:"Bearer "+session.access_token}
    });
    const payload=await response.json() as ChatSnapshot & {error?:string};
    if(!response.ok)throw new Error(payload.error||"تعذر تحميل محادثات العملاء.");
    if(canceled)return;
    setStatus("تم نقل المحادثات إلى صفحة Premier.");
    window.opener.postMessage({
     type:"premier:agent-support-inbox",requestId,
     conversations:payload.conversations,messages:payload.messages
    },PREMIER_ORIGIN);
    window.close();
   }catch(e){
    if(canceled)return;
    setError(e instanceof Error?e.message:"تعذر الاتصال بحساب AGENT.");
   }
  };
  void run();
  return()=>{canceled=true};
 },[db]);
 return <main dir="rtl" style={{fontFamily:"Cairo, sans-serif",maxWidth:500,margin:"70px auto",padding:24,textAlign:"center"}}>
  <h1 style={{fontSize:22,color:"#0b5f76"}}>ربط محادثات خدمة العملاء</h1>
  {error?<div role="alert" style={{color:"#9c403b",lineHeight:2}}>
    {error}
    <p><a href="/support/conversations" style={{color:"#0b758b"}}>فتح صندوق AGENT للمراجعة</a></p>
   </div>:<p style={{color:"#668793"}}>{status}</p>}
 </main>;
}
