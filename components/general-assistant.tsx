"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {createPortal} from "react-dom";
import {
  ArrowRight, Bot, BookOpen, Check, ChevronDown, CircleAlert, Code2, Copy,
  FileText, Lightbulb, LoaderCircle, Menu, MessageCircle, Plus, Send, ShieldCheck,
  Sparkles, Trash2, WandSparkles, PlugZap, Globe, Minus, PlusCircle
} from "lucide-react";
import { getSupabase } from "@/lib/supabase-browser";
import { currentSession } from "@/lib/auth-session";
import { assistantSkills, type AssistantSkill } from "@/lib/assistant-skills";
import AssistantMarkdown from "@/components/assistant-markdown";

type Thread = { id:string; title:string; skill:AssistantSkill; updated_at:string; created_at:string };
type ChatMessage = {id:string;role:"user"|"assistant";content:string;model?:string|null;skill?:string|null;created_at:string};
type AssistantResponse = {
  error?:string; threads?:Thread[]; thread?:Thread; messages?:ChatMessage[];
  title?:string; skill?:string; model?:string; attempts?:number; ok?:boolean;
  projectContext?:{loadedDocuments:number;missingDocuments:number;source:"github-public-readonly"}|null;
  sourceInspection?:{inspected:Array<{path:string;url:string;truncated:boolean}>;failed:string[]}|null;
  browserResult?:{url:string;title:string;fetched:boolean;note:string}|null;
};
const starters=[
  {label:"كتابة", icon:FileText, text:"اكتب لي منشور احترافي لصفحة Premier.OS عن فوائد أنظمة الكاشير للمطاعم، بدون أسعار غير مؤكدة."},
  {label:"تطوير POS", icon:Code2, text:"أنت مدير تطوير نظام Premier.OS الحالي. ابدأ بخطة لمراجعة علاقات الفروع والمخازن والمخزون والمبيعات والمشتريات والوصفات والتكاليف والحسابات. قل ما تحتاج رؤيته ولا تفترض مواصفات غير مؤكدة."},
  {label:"تخطيط", icon:Lightbulb, text:"حوّل فكرة إنشاء شركة برمجيات لخطة عملية من 30 يوم بخطوات وأولويات."},
  {label:"المتصفح", icon:Globe, text:"افحص الصفحة العامة https://premieros-sage.vercel.app/#/login واشرح ما يمكن قراءته فعلاً من HTML فقط، وحدود قدرتك على فحص تطبيقات JavaScript."}
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
  const [sourceFiles,setSourceFiles]=useState<Array<{path:string;url:string;truncated:boolean}>>([]);
  const [showSidebar,setShowSidebar]=useState(false);
  const [sidebarPortalTarget,setSidebarPortalTarget]=useState<HTMLElement|null>(null);
  const [fontSize,setFontSize]=useState(15);
  const [browserResult,setBrowserResult]=useState<{url:string;title:string;fetched:boolean;note:string}|null>(null);
  const endRef=useRef<HTMLDivElement|null>(null);
  const inputRef=useRef<HTMLTextAreaElement|null>(null);
  const active=threads.find(t=>t.id===threadId);
  useEffect(()=>setSidebarPortalTarget(document.getElementById("workspace-sidebar-slot")),[]);

  const authHeaders=useCallback(async () => {
    if(!db)throw new Error("تعذر اتصال قاعدة البيانات.");
    const session=await currentSession(db);
    if(!session?.access_token)throw new Error("انتهت جلسة AGENT. افتح صفحة تسجيل الدخول ثم ارجع للمحادثة.");
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
    setBusy("loading-thread");setError("");setBrowserResult(null);
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
      setNote("");setSourceFiles([]);
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
        if(first && !new URLSearchParams(window.location.search).has("new"))await openThread(first);
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
      setBrowserResult(null);
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
        setThreadId("");setMessages([]);setNote("");setBrowserResult(null);
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
      setSourceFiles(data.sourceInspection?.inspected||[]);
      setBrowserResult(data.browserResult||null);
      await loadThreads(false);
    }catch(e){
      setMessages(current=>current.filter(m=>!m.id.startsWith("pending-")));
      setDraft(message);
      setError(e instanceof Error?e.message:"تعذر إرسال الرسالة.");
    }finally{setBusy("");}
  }

  const sidebar=(
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
  );
  useEffect(()=>{
    const begin=()=>void createThread();
    window.addEventListener("agent:new-chat",begin);
    return()=>window.removeEventListener("agent:new-chat",begin);
  });

  const sending=busy==="send";
  return <div className="crm-root general-assistant-root" style={{"--agent-chat-font-size":fontSize+"px"} as React.CSSProperties}>
    <div className="crm-wrap">
      <header className="crm-header">
        <div><strong>AGENT</strong><span> · المساعد متعدد المهارات</span></div>
        <nav className="crm-actions">
          <Link href="/assistant/integrations"><PlugZap size={16}/> الإضافات</Link>
          <Link href="/studio"><ArrowRight size={16}/> استوديو التسويق</Link>
          <Link href="/crm">العملاء</Link>
        </nav>
      </header>
      <div className="assistant-title">
        <div><span className="crm-overline">AGENT • CHAT & TOOLS</span>
          <h1>مساعدك الذكي</h1>
          <p>تحدث معه، افحص كود GitHub، أو جرّب مهارة قراءة صفحات الويب. الأدوات الخارجية بصلاحيات محدودة.</p>
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
          {sidebarPortalTarget ? createPortal(sidebar,sidebarPortalTarget) : sidebar}
          <main className="assistant-panel">
            <div className="assistant-toolbar">
              <button type="button" className="assistant-menu-button" onClick={()=>setShowSidebar(v=>!v)}
                title="قائمة المحادثات"><Menu size={20}/></button>
              <div className="assistant-toolbar-name"><Bot size={18}/><strong>{active?.title||"محادثة جديدة"}</strong></div>
              <div className="assistant-font-tools" aria-label="حجم خط المحادثة">
                <button type="button" title="تصغير الخط" onClick={()=>setFontSize(x=>Math.max(14,x-1))} disabled={fontSize<=14}><Minus size={14}/></button>
                <span aria-live="polite">{fontSize}</span>
                <button type="button" title="تكبير الخط" onClick={()=>setFontSize(x=>Math.min(19,x+1))} disabled={fontSize>=19}><PlusCircle size={15}/></button>
              </div>
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
                <p>اسأل أي سؤال، اختار مهارة، أو اختبر GitHub والمتصفح النصي. اضغط «الإضافات والاتصالات» لربط خدمات جديدة.</p>
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
              {browserResult && <div className="assistant-browser-note">
                <Globe size={15}/>
                {browserResult.fetched
                  ? <a href={browserResult.url} target="_blank" rel="noopener noreferrer">صفحة تمت قراءتها: {browserResult.title||browserResult.url}</a>
                  : <span>تعذرت قراءة الصفحة: {browserResult.note}</span>}
              </div>}
              {sourceFiles.length>0 && <div className="assistant-source-list">
                <strong>ملفات الكود اللي اتقرأت فعلًا (GitHub - قراءة فقط):</strong>
                {sourceFiles.map(file=><a key={file.path} href={file.url} target="_blank" rel="noopener noreferrer">
                  {file.path}{file.truncated?" · مقتطف":""}
                </a>)}
              </div>}
              <div className="assistant-composer-box">
                <textarea ref={inputRef} rows={2} maxLength={4500} value={draft}
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
              <p className="assistant-limit-note">القراءة من GitHub والصفحات العامة المحددة فقط؛ المتصفح التفاعلي والنشر والإرسال والتعديل الخارجي مش مفعّلين. النماذج قد تخطئ.</p>
            </div>
          </main>
        </div>}
    </div>
  </div>;
}
