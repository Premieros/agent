"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {getSupabase} from "@/lib/supabase-browser";
import {currentSession} from "@/lib/auth-session";

type Conversation={
 id:string;projectId:string;projectName:string;origin:string;
 mode:"ai"|"human";createdAt:string;updatedAt:string;
};
type Message={id:string;role:"customer"|"assistant"|"employee"|"system";body:string;created_at:string};

export default function SupportConversationsPage(){
 const db=getSupabase();
 const [rows,setRows]=useState<Conversation[]>([]);
 const [chosen,setChosen]=useState("");
 const [projectFilter,setProjectFilter]=useState("");
 const [search,setSearch]=useState("");
 const [messages,setMessages]=useState<Message[]>([]);
 const [loading,setLoading]=useState(true);
 const [loadingMessages,setLoadingMessages]=useState(false);
 const [error,setError]=useState("");
 const [selectedError,setSelectedError]=useState("");
 const selected=rows.find(r=>r.id===chosen);
 const projects=useMemo(()=>Array.from(new Map(rows.map(x=>[x.projectId,x.projectName])).entries()),[rows]);
 const visible=useMemo(()=>rows.filter(x=>
  (!projectFilter||x.projectId===projectFilter)&&
  (!search.trim()||[x.projectName,x.origin,x.id].some(v=>v.toLocaleLowerCase("ar").includes(search.trim().toLocaleLowerCase("ar"))))
 ),[rows,projectFilter,search]);
 const format=(date:string)=>new Date(date).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"});

 const request=useCallback(async(path:string)=>{
  if(!db)throw new Error("قاعدة بيانات AGENT غير متاحة.");
  const session=await currentSession(db);
  if(!session)throw new Error("افتح AGENT وسجّل الدخول بحساب الإدارة لرؤية المحادثات.");
  const res=await fetch(path,{cache:"no-store",headers:{Authorization:"Bearer "+session.access_token}});
  const data=await res.json();
  if(!res.ok)throw new Error(data.error||"تعذر تحميل المحادثات.");
  return data;
 },[db]);

 const loadRows=useCallback(async()=>{
  try{
   const data=await request("/api/support/conversations");
   const next=(data.conversations||[]) as Conversation[];
   setRows(next);setError("");
   setChosen(previous=>next.some(c=>c.id===previous)?previous:next[0]?.id||"");
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحميل المحادثات.");}
  finally{setLoading(false);}
 },[request]);

 const loadMessages=useCallback(async(conversationId:string)=>{
  setLoadingMessages(true);
  try{
   const data=await request("/api/support/conversations?conversationId="+encodeURIComponent(conversationId));
   if(data.conversation?.id===conversationId){
    setMessages(data.messages||[]);
    setSelectedError("");
   }
  }catch(e){setSelectedError(e instanceof Error?e.message:"تعذر تحميل الرسائل.");}
  finally{setLoadingMessages(false);}
 },[request]);

 useEffect(()=>{if(db)void loadRows();},[db,loadRows]);
 useEffect(()=>{
  if(!chosen){setMessages([]);return;}
  setMessages([]);
  void loadMessages(chosen);
  const timer=setInterval(()=>{void loadRows();void loadMessages(chosen);},15000);
  return()=>clearInterval(timer);
 },[chosen,loadRows,loadMessages]);

 return <main className="support-admin-theme" dir="rtl" style={{maxWidth:1150,margin:"20px auto",padding:"16px 18px",color:"#19353f"}}>
  <header style={{display:"flex",gap:14,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",marginBottom:18}}>
   <div>
    <h1 style={{margin:0,fontSize:26}}>محادثات العملاء</h1>
    <p style={{margin:"5px 0 0",color:"#668793",fontSize:13}}>رسائل مواقعك المتصلة بـ AGENT وردود خدمة العملاء، لكل مشروع بشكل منفصل.</p>
   </div>
   <Link href="/support" style={{padding:"10px 15px",borderRadius:12,background:"#e9f4f7",color:"#0b5f76",textDecoration:"none",fontWeight:700}}>الرجوع لإدارة المشاريع</Link>
  </header>
  <p style={{fontSize:12,color:"#668793",marginBottom:14}}>عرض للمتابعة فقط؛ محادثات الدعم البشري في Premier تظل مستقلة. يتم تحديث المحادثة تلقائيًا كل 15 ثانية.</p>
  {error&&<div role="alert" style={{background:"#fff1ee",color:"#984b3c",padding:14,borderRadius:12,marginBottom:15}}>
   {error} <button type="button" onClick={()=>void loadRows()} style={{marginInlineStart:12,border:0,background:"transparent",color:"inherit",textDecoration:"underline",cursor:"pointer"}}>إعادة المحاولة</button>
  </div>}
  <div style={{display:"grid",gridTemplateColumns:"minmax(270px,340px) minmax(0,1fr)",gap:16,alignItems:"start"}} className="support-conversation-layout">
   <section style={{border:"1px solid #dbe8ea",borderRadius:18,background:"white",overflow:"hidden"}}>
    <div style={{padding:14,display:"grid",gap:10,borderBottom:"1px solid #e4ecef"}}>
     <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <strong>صندوق الوارد ({visible.length})</strong>
      <button type="button" onClick={()=>void loadRows()} style={{border:"1px solid #c7dde3",background:"#e9f4f7",color:"#0b5f76",padding:"6px 10px",borderRadius:9,cursor:"pointer"}}>تحديث</button>
     </div>
     <select aria-label="تصفية حسب المشروع" value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}
      style={{padding:10,border:"1px solid #cbdde2",borderRadius:10,width:"100%",background:"white"}}>
      <option value="">كل المشاريع</option>
      {projects.map(([id,name])=><option key={id} value={id}>{name}</option>)}
     </select>
     <input aria-label="بحث في المحادثات" placeholder="بحث بالمشروع أو الموقع" value={search} onChange={e=>setSearch(e.target.value)}
      style={{padding:10,border:"1px solid #cbdde2",borderRadius:10,width:"100%"}}/>
    </div>
    <div style={{maxHeight:600,overflowY:"auto"}}>
     {loading?<p style={{padding:16,color:"#668793"}}>جارٍ تحميل المحادثات…</p>:visible.length===0?<p style={{padding:16,color:"#668793"}}>لا توجد محادثات مطابقة بعد.</p>:
      visible.map(c=><button key={c.id} type="button" onClick={()=>setChosen(c.id)}
       style={{display:"grid",gap:4,width:"100%",textAlign:"right",padding:"13px 14px",border:0,borderBottom:"1px solid #ebf0f2",background:c.id===chosen?"#e4f4f3":"white",color:"#19353f",cursor:"pointer"}}>
       <strong>{c.projectName}</strong>
       <span style={{fontSize:12,color:"#557d88",overflowWrap:"anywhere"}}>{c.origin}</span>
       <span style={{fontSize:11,color:"#7896a0"}}>{format(c.updatedAt)} · {c.mode==="human"?"دعم بشري":"محادثة خدمة العملاء"}</span>
      </button>)}
    </div>
   </section>
   <section style={{display:"flex",flexDirection:"column",border:"1px solid #dbe8ea",borderRadius:18,background:"white",minHeight:540,overflow:"hidden"}}>
    {selected?<><div style={{padding:16,borderBottom:"1px solid #e4ecef"}}>
     <strong>{selected.projectName}</strong>
     <div style={{fontSize:12,color:"#668793"}}>{selected.origin} · {format(selected.createdAt)}</div>
    </div>
    <div role="log" aria-label="رسائل المحادثة" style={{display:"flex",flexDirection:"column",gap:11,flex:1,padding:18,background:"#f6fafc",maxHeight:570,overflowY:"auto"}}>
     {loadingMessages&&messages.length===0?<p style={{color:"#668793"}}>جارٍ تحميل الرسائل…</p>:null}
     {selectedError&&<p role="alert" style={{color:"#9b4940"}}>{selectedError}</p>}
     {messages.length===0&&!loadingMessages&&!selectedError?<p style={{color:"#668793"}}>لا توجد رسائل بعد.</p>:null}
     {messages.map(m=><div key={m.id} style={{alignSelf:m.role==="customer"?"flex-start":"flex-end",maxWidth:"86%",background:m.role==="customer"?"white":"#e1f2ef",border:"1px solid #d5e6e9",padding:"10px 14px",borderRadius:14,overflowWrap:"anywhere"}}>
      <strong style={{fontSize:11,color:"#0b5f76"}}>{m.role==="customer"?"العميل":m.role==="assistant"?"خدمة العملاء":m.role==="employee"?"موظف الدعم":"النظام"}</strong>
      <p style={{margin:"4px 0",whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.8}}>{m.body}</p>
      <time dateTime={m.created_at} style={{fontSize:10,color:"#668793"}}>{format(m.created_at)}</time>
     </div>)}
    </div>
    </>:<div style={{padding:25,color:"#668793"}}>اختر محادثة لعرض الرسائل.</div>}
   </section>
  </div>
  <style>{`@media(max-width:730px){.support-conversation-layout{grid-template-columns:minmax(0,1fr)!important}}`}</style>
 </main>;
}
