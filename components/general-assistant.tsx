"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Bot, BookOpen, Check, ChevronDown, CircleAlert, Code2, Copy,
  FileText, Lightbulb, LoaderCircle, Menu, MessageCircle, Plus, Send, ShieldCheck,
  Sparkles, Trash2, WandSparkles
} from "lucide-react";
import { getSupabase } from "@/lib/supabase-browser";
import { assistantSkills, type AssistantSkill } from "@/lib/assistant-skills";
import AssistantMarkdown from "@/components/assistant-markdown";

type Thread = { id:string; title:string; skill:AssistantSkill; updated_at:string; created_at:string };
type ChatMessage = {id:string;role:"user"|"assistant";content:string;model?:string|null;skill?:string|null;created_at:string};
type AssistantResponse = {
  error?:string; threads?:Thread[]; thread?:Thread; messages?:ChatMessage[];
  title?:string; skill?:string; model?:string; attempts?:number; ok?:boolean;
  projectContext?:{loadedDocuments:number;missingDocuments:number;source:"github-public-readonly"}|null;
};
const starters=[
  {label:"كتابة", icon:FileText, text:"اكتب لي منشور احترافي لصفحة Premier.OS عن فوائد أنظمة الكاشير للمطاعم، بدون أسعار غير مؤكدة."},
  {label:"تطوير POS", icon:Code2, text:"أنت مدير تطوير نظام Premier.OS الحالي. ابدأ بخطة لمراجعة علاقات الفروع والمخازن والمخزون والمبيعات والمشتريات والوصفات والتكاليف والحسابات. قل ما تحتاج رؤيته ولا تفترض مواصفات غير مؤكدة."},
  {label:"تخطيط", icon:Lightbulb, text:"حوّل فكرة إنشاء شركة برمجيات لخطة عملية من 30 يوم بخطوات وأولويات."},
  {label:"تعليم", icon:BookOpen, text:"اشرح لي مفهوم AI Agents والفرق بينهم وبين الشات العادي بأمثلة بسيطة."}
];

export default function GeneralAssistant() {
  const db=getSupabase();
  const [threads,setThreads]=useState<Thread[]>([]);
  const [threadId,setThreadId]=useState("");
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [draft,setDraft]=useState("");
  const [skill,setSkill]=useState<AssistantSkill>("auto");
  const [allowConditional,setAllowConditional]=useState(true);
  const [busy,setBusy]=useState("");
  const [loading,setLoading]=useState(true);
  const [authorized,setAuthorized]=useState(false);
  const [error,setError]=useState("");
  const [note,setNote]=useState("");
  const [showSidebar,setShowSidebar]=useState(false);
  const endRef=useRef<HTMLDivElement|null>(null);
  const inputRef=useRef<HTMLTextAreaElement|null>(null);
  const active=threads.find(t=>t.id===threadId);

  const authHeaders=useCallback(async () => {
    if(!db)throw new Error("تعذر اتصال قاعدة البيانات.");
    const {data:{session}}=await db.auth.getSession();
    if(!session?.access_token)throw new Error("سجّل دخولك من صفحة العملاء أولًا.");
    return {Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"};
  },[db]);

  const loadThreads=useCallback(async (pickFirst:boolean) => {
    const headers=await authHeaders();
    const res=await fetch("/api/assistant",{headers,cache:"no-store"});
    const data=await res.json() as AssistantResponse;
    if(!res.ok)throw new Error(data.error||"تعذر تحميل المحادثات.");
    setThreads(data.threads||[]);
    if(pickFirst && data.threads?.length) return data.threads[0].id;
    return "";
  },[authHeaders]);

  const openThread=useCallback(async (id:string) => {
    setBusy("loading-thread");setError("");
    try {
      const res=await fetch("/api/assistant?threadId="+encodeURIComponent(id),{
        headers:await authHeaders(),cache:"no-store"
      });
      const data=await res.json() as AssistantResponse;
      if(!res.ok)throw new Error(data.error||"تعذر فتح المحادثة.");
      setThreadId(id);
      setMessages(data.messages||[]);
      setSkill((data.thread?.skill||"auto") as AssistantSkill);
      setThreads(data.threads||[]);
      setShowSidebar(false);
      setNote("");
    }catch(e){setError(e instanceof Error?e.message:"فشل تحميل المحادثة.");}
    finally{setBusy("");}
  },[authHeaders]);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      setLoading(true);
      try {
        const first=await loadThreads(true);
        if(cancelled)return;
        setAuthorized(true);
        if(first)await openThread(first);
      }catch(e){
        if(!cancelled) setError(e instanceof Error?e.message:"تعذر تسجيل الدخول.");
      }finally{if(!cancelled)setLoading(false);}
    })();
    return()=>{cancelled=true;};
  },[loadThreads,openThread]);

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth",block:"end"});},[messages.length,busy]);

  async function createThread(){
    if(busy)return;
    setBusy("create");setError("");setNote("");
    try {
      const res=await fetch("/api/assistant",{
        method:"POST",headers:await authHeaders(),
        body:JSON.stringify({action:"create",skill})
      });
      const data=await res.json() as AssistantResponse;
      if(!res.ok||!data.thread)throw new Error(data.error||"تعذر إنشاء المحادثة.");
      setThreadId(data.thread.id);setMessages([]);setThreads(current=>[data.thread!,...current]);
      setShowSidebar(false);
      inputRef.current?.focus();
    }catch(e){setError(e instanceof Error?e.message:"تعذر الإنشاء.");}
    finally{setBusy("");}
  }

  async function removeThread(id:string){
    if(busy||!window.confirm("حذف المحادثة ورسائلها نهائيًا؟"))return;
    setBusy("delete");setError("");
    try {
      const res=await fetch("/api/assistant",{
        method:"POST",headers:await authHeaders(),
        body:JSON.stringify({action:"delete",threadId:id})
      });
      const data=await res.json() as AssistantResponse;
      if(!res.ok)throw new Error(data.error||"تعذر حذف المحادثة.");
      const remaining=threads.filter(t=>t.id!==id);
      setThreads(remaining);
      if(id===threadId){
        setThreadId("");setMessages([]);setNote("");
      }
    }catch(e){setError(e instanceof Error?e.message:"تعذر الحذف.");}
    finally{setBusy("");}
  }

  async function sendMessage(text=draft) {
    const message=text.trim();
    if(busy||!message||message.length>4500)return;
    setBusy("send");setError("");setNote("");
    try {
      let id=threadId;
      if(!id){
        const newRes=await fetch("/api/assistant",{
          method:"POST",headers:await authHeaders(),
          body:JSON.stringify({action:"create",skill})
        });
        const newData=await newRes.json() as AssistantResponse;
        if(!newRes.ok||!newData.thread)throw new Error(newData.error||"تعذر بدء المحادثة.");
        id=newData.thread.id;
        setThreadId(id);setThreads(current=>[newData.thread!,...current]);
      }
      const optimistic:ChatMessage={id:"pending-"+Date.now(),role:"user",content:message,created_at:new Date().toISOString()};
      setMessages(current=>[...current,optimistic]);
      setDraft("");
      const res=await fetch("/api/assistant",{
        method:"POST",headers:await authHeaders(),
        body:JSON.stringify({action:"send",threadId:id,text:message,skill,allowConditionalFreeTier:allowConditional})
      });
      const data=await res.json() as AssistantResponse;
      if(!res.ok||!data.messages?.length)throw new Error(data.error||"لم يصل رد من المساعد.");
      setMessages(current=>[...current.filter(m=>m.id!==optimistic.id),...(data.messages||[])]);
      if(data.title)setThreads(current=>current.map(t=>t.id===id?{...t,title:data.title!}:t));
      const projectNote=data.projectContext
        ? data.projectContext.loadedDocuments>0
          ? ` · GitHub: ${data.projectContext.loadedDocuments} وثائق للقراءة فقط`
          : " · تعذر قراءة وثائق GitHub في هذه المحاولة"
        : "";
      setNote(`مهارة ${assistantSkills.find(s=>s.id===data.skill)?.title||data.skill} · ${data.model||"نموذج غير محدد"} · ${data.attempts||1} محاولة`+projectNote);
      await loadThreads(false);
    }catch(e){
      setMessages(current=>current.filter(m=>!m.id.startsWith("pending-")));
      setDraft(message);
      setError(e instanceof Error?e.message:"تعذر إرسال الرسالة.");
    }finally{setBusy("");}
  }

  const sending=busy==="send";
  return <div className="crm-root general-assistant-root">
    <div className="crm-wrap">
      <header className="crm-header">
        <div><strong>AGENT</strong><span> · المساعد متعدد المهارات</span></div>
        <nav className="crm-actions">
          <Link href="/studio"><ArrowRight size={16}/> استوديو التسويق</Link>
          <Link href="/crm">العملاء</Link>
        </nav>
      </header>
      <div className="assistant-title">
        <div><span className="crm-overline">AGENT SKILLS • PRIVATE WORKSPACE</span>
          <h1>مساعدك الذكي في أي مهمة نصية</h1>
          <p>اكتب طلبك بشكل طبيعي، والمساعد يختار مهارته ويستخدم نماذج Gemini وGroq المتاحة ضمن حدود حسابك.</p>
        </div>
        <div className="assistant-tag"><ShieldCheck size={15}/> محادثات خاصة • بدون إجراءات تلقائية</div>
      </div>
      {error && <div className="crm-error" role="alert">{error} <button type="button" onClick={()=>setError("")}>×</button></div>}
      {loading ? <div className="assistant-loader"><LoaderCircle className="crm-spin" size={22}/> جاري تحميل مساعدك...</div>
      : !authorized ? <section className="crm-card assistant-login">
          <CircleAlert size={26}/><h2>سجّل دخولك إلى AGENT</h2>
          <p>المساعد الخاص يحتاج حساب مدير أو مسؤول تسويق مسجّل.</p>
          <Link href="/crm">الذهاب لتسجيل الدخول</Link>
        </section>
      : <div className="assistant-layout">
          <aside className={"assistant-sidebar "+(showSidebar?"expanded":"")}>
            <button className="assistant-new-chat" type="button" disabled={Boolean(busy)}
              onClick={()=>void createThread()}><Plus size={18}/> محادثة جديدة</button>
            <div className="assistant-sidebar-title">المحادثات المحفوظة</div>
            {threads.length===0 && <p className="assistant-sidebar-empty">ابدأ محادثة جديدة، وهتظهر هنا تلقائيًا.</p>}
            <div className="assistant-thread-list">
              {threads.map(t=><div key={t.id} className={"assistant-thread "+(threadId===t.id?"active":"")}>
                <button type="button" onClick={()=>void openThread(t.id)} disabled={Boolean(busy)}>
                  <MessageCircle size={15}/><span title={t.title}>{t.title}</span>
                </button>
                <button type="button" className="assistant-remove" title="حذف المحادثة"
                  disabled={Boolean(busy)} onClick={()=>void removeThread(t.id)}><Trash2 size={15}/></button>
              </div>)}
            </div>
            <div className="assistant-sidebar-footer"><ShieldCheck size={14}/> المحادثات مخصصة لحسابك فقط داخل الشركة</div>
          </aside>
          <main className="assistant-panel">
            <div className="assistant-toolbar">
              <button type="button" className="assistant-menu-button" onClick={()=>setShowSidebar(v=>!v)}
                title="قائمة المحادثات"><Menu size={20}/></button>
              <div className="assistant-toolbar-name"><Bot size={18}/><strong>{active?.title||"محادثة جديدة"}</strong></div>
              <label className="assistant-skill-select"><span>المهارة</span>
                <select value={skill} disabled={Boolean(busy)}
                  onChange={e=>setSkill(e.target.value as AssistantSkill)}>
                  {assistantSkills.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
                </select><ChevronDown size={14}/>
              </label>
            </div>
            <div className="assistant-chat-scroll">
              {messages.length===0 && <div className="assistant-welcome">
                <div className="assistant-logo"><WandSparkles size={32}/></div>
                <h2>اطلب اللي محتاجه من AGENT</h2>
                <p>كتابة، برمجة، شرح، تخطيط، تحليل، تسويق وترجمة. مهارة تطوير POS بتستند لوثائق عامة من مستودع Premier.OS عند توفرها.</p>
                <div className="assistant-starters">
                  {starters.map(item=><button type="button" key={item.label} onClick={()=>{setDraft(item.text);inputRef.current?.focus();}}>
                    <item.icon size={18}/><strong>{item.label}</strong><span>{item.text}</span>
                  </button>)}
                </div>
              </div>}
              {messages.map(m=><article key={m.id} className={"assistant-bubble "+m.role}>
                <div className="assistant-avatar">{m.role==="assistant"?<Sparkles size={17}/>:<span>أنت</span>}</div>
                <div className="assistant-message-body">
                  <div className="assistant-message-heading"><strong>{m.role==="assistant"?"AGENT":"أنت"}</strong>
                    {m.role==="assistant"&&<button type="button" title="نسخ الرد"
                      onClick={()=>void navigator.clipboard.writeText(m.content)}><Copy size={14}/></button>}</div>
                  <div className="assistant-message-text" dir="auto">{m.role==="assistant"?<AssistantMarkdown content={m.content}/>:m.content}</div>
                  {m.role==="assistant"&&<small>{assistantSkills.find(s=>s.id===m.skill)?.title||m.skill||"مساعد عام"}{m.model?" · "+m.model:""}</small>}
                </div>
              </article>)}
              {sending && <div className="assistant-thinking"><LoaderCircle size={16} className="crm-spin"/> AGENT بيحضّر الرد...</div>}
              <div ref={endRef}/>
            </div>
            <div className="assistant-compose">
              {note && <p className="assistant-run-note"><Check size={14}/>{note}</p>}
              <div className="assistant-composer-box">
                <textarea ref={inputRef} rows={3} maxLength={4500} value={draft}
                  disabled={Boolean(busy)} placeholder="اكتب أي طلب هنا... مثال: اشرح لي، اعمل خطة، اكتب كود، صيغ رسالة..."
                  onChange={e=>setDraft(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void sendMessage();}}}/>
                <button type="button" aria-label="إرسال الرسالة" disabled={Boolean(busy)||!draft.trim()}
                  onClick={()=>void sendMessage()}><Send size={18}/></button>
              </div>
              <div className="assistant-compose-foot">
                <label><input type="checkbox" checked={allowConditional} onChange={e=>setAllowConditional(e.target.checked)}/>
                  السماح بحصص Gemini وGroq المشروطة
                </label><span>{draft.length}/4500</span>
              </div>
              <p className="assistant-limit-note">النماذج قد تخطئ، والحصة المجانية ليست مضمونة. البحث في الإنترنت والملفات وتشغيل البرامج والنشر الخارجي مش متاحين في الشات ده حاليًا.</p>
            </div>
          </main>
        </div>}
    </div>
  </div>;
}
