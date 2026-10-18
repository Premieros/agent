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
import AssistantLearningPanel from "@/components/assistant-learning-panel";

type Thread = { id:string; title:string; skill:AssistantSkill; updated_at:string; created_at:string };
type ChatMessage = {id:string;role:"user"|"assistant";content:string;model?:string|null;skill?:string|null;created_at:string};
type WorkRun={id:string;status:"planned"|"running"|"executed"|"reporting"|"completed"|"failed";
  steps:string[];stage_note:string;sandbox_ran:boolean;sandbox_succeeded:boolean|null};
type StudioPage={id:string;name:string;platform:string;connection_status:string};
type StudioMission={id:string;page_id:string;objective:string;brief:string;status:string;created_at:string};
type StudioDraft={id:string;page_id:string;objective:string;brief:string;
  status:"draft"|"creating"|"created";mission_id:string|null};
type StudioResponse={error?:string;ok?:boolean;messages?:ChatMessage[];
  pages?:StudioPage[];missions?:StudioMission[];drafts?:StudioDraft[];
  draft?:StudioDraft;missionId?:string};
type SiteChange={id:string;title:string;summary:string;task:string;
  status:"draft"|"opening_pr"|"pr_opened"|"failed";
  edits:Array<{path:string;search:string;replace:string}>;pr_url?:string|null};
type AssistantResponse = {
  error?:string; threads?:Thread[]; thread?:Thread; messages?:ChatMessage[];
  title?:string; skill?:string; customSkill?:string|null; model?:string; attempts?:number; ok?:boolean;
  projectContext?:{loadedDocuments:number;missingDocuments:number;source:"github-public-readonly"}|null;
  sourceInspection?:{
    repository:string;branch:string;indexed:number;truncatedTree:boolean;
    inspected:Array<{path:string;url:string;truncated:boolean}>;failed:string[]
  }|null;
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
  const [workMode,setWorkMode]=useState(false);
  const [siteMode,setSiteMode]=useState(false);
  const [studioMode,setStudioMode]=useState(false);
  const [studioPages,setStudioPages]=useState<StudioPage[]>([]);
  const [studioMissions,setStudioMissions]=useState<StudioMission[]>([]);
  const [studioDraft,setStudioDraft]=useState<StudioDraft|null>(null);
  const [studioPageId,setStudioPageId]=useState("");
  const [studioMissionId,setStudioMissionId]=useState("");
  const [siteChange,setSiteChange]=useState<SiteChange|null>(null);
  const [siteWriteReady,setSiteWriteReady]=useState(false);
  const [workProgress,setWorkProgress]=useState("");
  const [workSteps,setWorkSteps]=useState<string[]>([]);
  const [pendingWork,setPendingWork]=useState<WorkRun|null>(null);
  const [busy,setBusy]=useState("");
  const [loading,setLoading]=useState(true);
  const [authorized,setAuthorized]=useState(false);
  const [error,setError]=useState("");
  const [note,setNote]=useState("");
  const [sourceFiles,setSourceFiles]=useState<Array<{path:string;url:string;truncated:boolean}>>([]);
  const [sourceProject,setSourceProject]=useState("");
  const [showSidebar,setShowSidebar]=useState(false);
  const [sidebarPortalTarget,setSidebarPortalTarget]=useState<HTMLElement|null>(null);
  const [fontSize,setFontSize]=useState(15);
  const [browserResult,setBrowserResult]=useState<{url:string;title:string;fetched:boolean;note:string}|null>(null);
  const endRef=useRef<HTMLDivElement|null>(null);
  const inputRef=useRef<HTMLTextAreaElement|null>(null);
  const active=threads.find(t=>t.id===threadId);
  useEffect(()=>setSidebarPortalTarget(document.getElementById("workspace-sidebar-slot")),[]);
  useEffect(()=>{
    const pick=(value:string|null)=>{
      const allowed=assistantSkills.some(item=>item.id===value);
      if(allowed)setSkill(value as AssistantSkill);
      else if(value==="auto")setSkill("auto");
    };
    pick(new URLSearchParams(window.location.search).get("skill"));
    const onNavigate=(event:Event)=>pick((event as CustomEvent<string>).detail);
    const onPop=()=>pick(new URLSearchParams(window.location.search).get("skill"));
    window.addEventListener("agent:select-assistant-skill",onNavigate);
    window.addEventListener("popstate",onPop);
    return()=>{window.removeEventListener("agent:select-assistant-skill",onNavigate);window.removeEventListener("popstate",onPop);};
  },[]);

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
      window.dispatchEvent(new Event("agent:close-navigation"));
      setNote("");setSourceFiles([]);setSourceProject("");setWorkSteps([]);setWorkProgress("");
      setSiteChange(null);
    setStudioDraft(null);setStudioMissions([]);setStudioPages([]);
    setStudioPageId("");setStudioMissionId("");
      void loadWorkState(id);
      void loadSiteState(id);
      void loadStudioState(id);
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
    setBusy("create");setError("");setNote("");setWorkSteps([]);setWorkProgress("");setPendingWork(null);
    setSiteChange(null);
    try {
      const res=await fetch("/api/assistant",{
        method:"POST",headers:await authHeaders(),
        body:JSON.stringify({action:"create",skill})
      });
      const data=await res.json() as AssistantResponse;
      if(!res.ok||!data.thread)throw new Error(data.error||"تعذر إنشاء المحادثة.");
      setThreadId(data.thread.id);setMessages([]);setThreads(current=>[data.thread!,...current]);
      setShowSidebar(false);
      window.dispatchEvent(new Event("agent:close-navigation"));
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
        setThreadId("");setMessages([]);setNote("");setBrowserResult(null);setPendingWork(null);
      }
    }catch(e){setError(e instanceof Error?e.message:"تعذر الحذف.");}
    finally{setBusy("");}
  }


  async function loadWorkState(id:string){
    try{
      const res=await fetch("/api/assistant/work?threadId="+encodeURIComponent(id),{
        headers:await authHeaders(),cache:"no-store"
      });
      if(!res.ok)return;
      const data=await res.json() as {runs?:WorkRun[]};
      const running=(data.runs||[]).find(r=>
        ["planned","running","executed","reporting"].includes(r.status));
      setPendingWork(running||null);
      if(running){
        setWorkSteps(running.steps||[]);
        setWorkProgress(running.stage_note||"مهمة محفوظة بانتظار استكمال.");
      }
    }catch{/* The normal chat stays usable even when run history is unavailable. */}
  }

  async function loadStudioState(id:string){
    if(!id)return;
    try{
      const res=await fetch("/api/assistant/studio?threadId="+encodeURIComponent(id),{
        headers:await authHeaders(),cache:"no-store"
      });
      if(!res.ok)return;
      const data=await res.json() as StudioResponse;
      if(data.pages)setStudioPages(data.pages);
      if(data.missions)setStudioMissions(data.missions);
      if(data.drafts)setStudioDraft(
        data.drafts.find(x=>x.status==="draft"||x.status==="creating")||
        data.drafts[0]||null
      );
    }catch{/* Marketing tools stay optional and don't block normal chat. */}
  }

  async function studioRequest(id:string,action:"overview"|"prepare"|"confirm"|"summary",
    extra:Record<string,unknown>={}):Promise<StudioResponse>{
    const res=await fetch("/api/assistant/studio",{
      method:"POST",headers:await authHeaders(),
      body:JSON.stringify({action,threadId:id,...extra})
    });
    const data=await res.json() as StudioResponse;
    if(!res.ok)throw new Error(data.error||"تعذر إتمام طلب مدير الوكلاء.");
    if(data.messages?.length)setMessages(current=>[
      ...current.filter(m=>!m.id.startsWith("pending-")),...data.messages!
    ]);
    if(data.draft)setStudioDraft(data.draft);
    if(data.pages)setStudioPages(data.pages);
    if(data.missions)setStudioMissions(data.missions);
    if(data.missionId)setStudioMissionId(data.missionId);
    return data;
  }

  async function confirmStudioDraft(){
    if(busy||!threadId||studioDraft?.status!=="draft")return;
    const pageName=studioPages.find(p=>p.id===studioDraft.page_id)?.name||"الصفحة";
    if(!window.confirm("حفظ مهمة "+pageName+" في قاعدة AGENT؟ لن تعمل الوكلاء أو يُنشر شيء تلقائيًا."))return;
    setBusy("studio-create");setError("");setNote("");
    try{
      await studioRequest(threadId,"confirm",{draftId:studioDraft.id});
      await loadStudioState(threadId);
      setNote("تم حفظ المهمة. تشغيل الوكلاء خطوة منفصلة تحتاج موافقتك.");
    }catch(e){setError(e instanceof Error?e.message:"تعذر حفظ المهمة.");}
    finally{setBusy("");}
  }

  async function runStudioMission(){
    const id=studioMissionId||studioDraft?.mission_id||studioMissions[0]?.id;
    if(busy||!threadId||!id)return;
    const selected=studioMissions.find(m=>m.id===id);
    if(selected&&!["queued","failed"].includes(selected.status)){
      setError("المهمة ليست جاهزة للتشغيل. راجع حالتها في الاستوديو.");return;
    }
    if(!window.confirm(
      "تشغيل الوكلاء في الوضع الاقتصادي لمهمة محفوظة؟ سيستخدم نموذج AI من الحصة المتاحة؛ لا نشر ولا إنفاق إعلاني."
    ))return;
    setBusy("studio-run");setError("");setNote("جارٍ توزيع العمل على الوكلاء...");
    try{
      const res=await fetch("/api/agents/run",{
        method:"POST",headers:await authHeaders(),
        body:JSON.stringify({missionId:id,mode:"economy",routing:"auto",
          allowConditionalFreeTier:allowConditional})
      });
      const result=await res.json() as {error?:string;agents?:number;apiCalls?:number};
      if(!res.ok)throw new Error(result.error||"تعذر تشغيل الوكلاء.");
      await studioRequest(threadId,"summary",{missionId:id});
      await loadStudioState(threadId);
      setNote("تم حفظ "+(result.agents||0)+" مخرجات في الاستوديو للمراجعة. لا نشر خارجي.");
    }catch(e){setError(e instanceof Error?e.message:"تعذر التشغيل.");setNote("");}
    finally{setBusy("");}
  }

  async function loadSiteState(id:string){
    if(!id)return;
    try{
      const res=await fetch("/api/assistant/site?threadId="+encodeURIComponent(id),{
        headers:await authHeaders(),cache:"no-store"
      });
      if(!res.ok)return;
      const data=await res.json() as {changes?:SiteChange[];writeReady?:boolean};
      setSiteChange(data.changes?.find(c=>c.status==="draft"||c.status==="opening_pr")||
        data.changes?.[0]||null);
      setSiteWriteReady(Boolean(data.writeReady));
    }catch{/* Site manager remains optional. */}
  }

  async function approveSiteChange(){
    if(!siteChange||siteChange.status!=="draft"||busy)return;
    if(!window.confirm(
      "هل توافق على فتح Pull Request في Premieros/agent للمراجعة؟ لن يتم الدمج أو النشر تلقائيًا."
    ))return;
    setBusy("site-approve");setError("");
    try{
      const res=await fetch("/api/assistant/site",{
        method:"POST",headers:await authHeaders(),
        body:JSON.stringify({action:"approve",changeId:siteChange.id})
      });
      const data=await res.json() as {error?:string;url?:string};
      if(!res.ok||!data.url)throw new Error(data.error||"تعذر فتح طلب المراجعة.");
      setSiteChange({...siteChange,status:"pr_opened",pr_url:data.url});
      setNote("تم فتح Pull Request للمراجعة فقط؛ لم يُنشر أي تعديل.");
    }catch(e){setError(e instanceof Error?e.message:"تعذر فتح طلب المراجعة.");}
    finally{setBusy("");}
  }

  async function finishWork(initial:WorkRun,id:string){
    setBusy("work");setError("");
    let run=initial;
    try{
      if(run.status==="planned"){
        setWorkProgress("تنفيذ خطة العمل...");
        const resp=await fetch("/api/assistant/work",{
          method:"POST",headers:await authHeaders(),
          body:JSON.stringify({action:"execute",runId:run.id})
        });
        const result=await resp.json() as {error?:string;status?:WorkRun["status"];
          sandboxAttempted?:boolean;sandboxSucceeded?:boolean|null};
        if(!resp.ok)throw new Error(result.error||"تعذر تشغيل المهمة.");
        run={...run,status:"executed",
          sandbox_ran:Boolean(result.sandboxAttempted),
          sandbox_succeeded:result.sandboxSucceeded??null,
          stage_note:result.sandboxAttempted?
            (result.sandboxSucceeded?"اكتمل الاختبار المعزول.":"تعذر الاختبار المعزول."):
            "التحليل لا يحتاج تشغيل كود."};
        setPendingWork(run);
      }
      if(run.status!=="executed")throw new Error(
        "التنفيذ الجاري لم ينتهِ بعد. اضغط تحديث بعد قليل.");
      setWorkProgress("تحليل النتائج وإعداد التقرير...");
      const resp=await fetch("/api/assistant/work",{
        method:"POST",headers:await authHeaders(),
        body:JSON.stringify({action:"finalize",runId:run.id,
          allowConditionalFreeTier:allowConditional})
      });
      const result=await resp.json() as {status?:string;error?:string;message?:ChatMessage};
      if(!resp.ok||!result.message)throw new Error(result.error||"تعذر تجهيز التقرير.");
      setPendingWork(null);setWorkSteps([]);
      setWorkProgress(result.status==="completed"?
        (run.sandbox_ran?"اكتمل التحليل في البيئة المعزولة.":"اكتمل تحليل الأدلة دون تشغيل كود."):
        "انتهت المحاولة مع فشل الاختبار. راجع التقرير.");
      setNote(run.sandbox_ran?
        (run.sandbox_succeeded?"تجربة Sandbox ناجحة.":"تعذر اختبار Sandbox؛ النتيجة توضح ذلك."):
        "تحليل مصادر ونتائج، بدون تشغيل Sandbox.");
    }catch(e){
      setError(e instanceof Error?e.message:"تعذر استكمال العمل.");
      await loadWorkState(id);
    }finally{
      try{
        const response=await fetch("/api/assistant?threadId="+encodeURIComponent(id),{
          headers:await authHeaders(),cache:"no-store"
        });
        if(response.ok){
          const saved=await response.json() as AssistantResponse;
          setMessages(saved.messages||[]);setThreads(saved.threads||[]);
        }
      }catch{/* The saved task can still be reopened later. */}
      setBusy("");
    }
  }

  async function sendMessage(text=draft) {
    const message=text.trim();
    if(busy||!message||message.length>4500)return;
    setBusy("send");setError("");setNote("");setWorkSteps([]);setWorkProgress("");
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
      if(studioMode){
        const creating=/(?:انشئ|أنشئ|اضف|أضف|اعمل|جهز|جهّز|سجل|مهمةs+جديدة|create|new task)/i.test(message);
        const summarizing=/(?:لخص|لخّص|ملخص|مخرجات|نتائج|summary|summarize)/i.test(message);
        const running=/(?:شغّل|شغلs+(?:الوكلاء|المهمة)|تشغيلs+(?:الوكلاء|المهمة)|وزّع|وزعs+علىs+الوكلاء|run agents)/i.test(message);
        if(running){
          setMessages(current=>current.filter(m=>m.id!==optimistic.id));
          setDraft(message);
          setNote("تشغيل الوكلاء يحتاج تأكيدًا مستقلًا من الزر داخل لوحة إدارة المهام.");
          return;
        }
        await studioRequest(id,creating?"prepare":summarizing?"summary":"overview",{
          task:message,
          pageId:creating&&studioPageId?studioPageId:undefined,
          missionId:summarizing&&studioMissionId?studioMissionId:undefined
        });
        await loadStudioState(id);
        setNote(creating?"المهمة مقترحة ولم تُحفظ بعد؛ راجعها ووافق من اللوحة.":
          "تمت القراءة من بيانات مدير الوكلاء الفعلية، بدون Sandbox.");
        return;
      }
      if(siteMode){
        const diagnose=/^(?:افحص|فحص|تحقق|حالة|راقب|check|status|diagnose)(?:\s|$)/iu.test(message);
        const res=await fetch("/api/assistant/site",{
          method:"POST",headers:await authHeaders(),
          body:JSON.stringify({action:diagnose?"diagnose":"draft",
            threadId:id,task:message,allowConditionalFreeTier:allowConditional})
        });
        const data=await res.json() as {error?:string;change?:SiteChange;
          messages?:ChatMessage[];writeReady?:boolean};
        if(!res.ok||!data.messages?.length)
          throw new Error(data.error||"تعذر فحص الموقع أو إعداد المقترح.");
        setMessages(current=>[...current.filter(m=>m.id!==optimistic.id),...data.messages!]);
        if(data.change)setSiteChange(data.change);
        if(typeof data.writeReady==="boolean")setSiteWriteReady(data.writeReady);
        setNote(diagnose?"فحص الموقع بدون Sandbox.":"المقترح محفوظ للمراجعة؛ بدون تغيير مباشر.");
        return;
      }
      if(workMode){
        setWorkProgress("تجهيز خطة العمل...");
        const planRes=await fetch("/api/assistant/work",{
          method:"POST",headers:await authHeaders(),
          body:JSON.stringify({action:"plan",threadId:id,task:message,
            allowConditionalFreeTier:allowConditional})
        });
        const planData=await planRes.json() as {
          ok?:boolean;error?:string;runId?:string;steps?:string[];
          title?:string;answered?:boolean;messages?:ChatMessage[];note?:string;
        };
        if(!planRes.ok)throw new Error(planData.error||"تعذر إعداد خطة العمل.");
        if(planData.answered&&planData.messages?.length){
          setMessages(current=>[
            ...current.filter(m=>m.id!==optimistic.id),...planData.messages!
          ]);
          if(planData.title)setThreads(current=>current.map(t=>
            t.id===id?{...t,title:planData.title!}:t));
          setPendingWork(null);setWorkSteps([]);setWorkProgress("");
          setNote(planData.note||"تمت الإجابة مباشرة.");
          return;
        }
        if(!planData.runId)throw new Error("تعذر إعداد خطة العمل.");
        const work:WorkRun={id:planData.runId,status:"planned",steps:planData.steps||[],
          stage_note:"الخطة محفوظة وجاهزة للتنفيذ.",sandbox_ran:false,sandbox_succeeded:null};
        setPendingWork(work);setWorkSteps(work.steps);
        setMessages(current=>current.filter(m=>m.id!==optimistic.id));
        await finishWork(work,id);
        return;
      }
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
      setNote(`مهارة ${data.customSkill||assistantSkills.find(s=>s.id===data.skill)?.title||data.skill} · ${data.model||"نموذج غير محدد"} · ${data.attempts||1} محاولة`+projectNote);
      setSourceFiles(data.sourceInspection?.inspected||[]);
      setSourceProject(data.sourceInspection?.repository||"");
      setBrowserResult(data.browserResult||null);
      await loadThreads(false);
    }catch(e){
      setMessages(current=>current.filter(m=>!m.id.startsWith("pending-")));
      setDraft(message);setWorkProgress("");
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
                <strong>ملفات الكود المقروءة من {sourceProject||"GitHub"} — قراءة فقط:</strong>
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
              {pendingWork&&<div className="assistant-work-steps" role="status">
                <strong>{workProgress||pendingWork?.stage_note}</strong>
                <span>{workSteps.map((step,i)=>(i+1)+". "+step).join(" · ")}</span>
                {pendingWork&&["planned","executed"].includes(pendingWork.status)&&
                  <button type="button" disabled={Boolean(busy)}
                    onClick={()=>void finishWork(pendingWork,threadId)}>استكمال</button>}
                {pendingWork&&["running","reporting"].includes(pendingWork.status)&&
                  <button type="button" disabled={Boolean(busy)}
                    onClick={()=>void loadWorkState(threadId)}>تحديث</button>}
              </div>}
              {studioMode&&<div className="assistant-studio-control" role="region" aria-label="إدارة صفحات التسويق والمهام">
                <div className="assistant-studio-control-head">
                  <strong>إدارة الصفحات والمهام</strong>
                  <button type="button" disabled={Boolean(busy)}
                    onClick={()=>void sendMessage("اعرض صفحات ومهام AGENT")}>عرض الحالة</button>
                </div>
                <div className="assistant-studio-control-selects">
                  <label>الصفحة
                    <select value={studioPageId} onChange={e=>setStudioPageId(e.target.value)}
                      disabled={Boolean(busy)}>
                      <option value="">اختيار تلقائي حسب الطلب</option>
                      {studioPages.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                  <label>مهمة للملخص أو التشغيل
                    <select value={studioMissionId} onChange={e=>setStudioMissionId(e.target.value)}
                      disabled={Boolean(busy)}>
                      <option value="">آخر مهمة</option>
                      {studioMissions.map(m=><option value={m.id} key={m.id}>
                        {(studioPages.find(p=>p.id===m.page_id)?.name||"صفحة")+" · "+m.objective+" · "+m.status}
                      </option>)}
                    </select>
                  </label>
                </div>
                {studioDraft&&<div className="assistant-studio-draft">
                  <strong>{studioDraft.status==="created"?"مهمة محفوظة":"مهمة مقترحة للمراجعة"}</strong>
                  <span>الصفحة: {studioPages.find(p=>p.id===studioDraft.page_id)?.name||"—"}</span>
                  <span>النوع: {studioDraft.objective}</span>
                  <p>{studioDraft.brief}</p>
                  {studioDraft.status==="draft"&&
                    <button type="button" disabled={Boolean(busy)}
                      onClick={()=>void confirmStudioDraft()}>تأكيد إضافة المهمة</button>}
                  {studioDraft.status==="creating"&&<small>جارٍ حفظ المهمة؛ انتظر تحديث حالتها.</small>}
                </div>}
                <div className="assistant-studio-control-actions">
                  <button type="button" disabled={Boolean(busy)||!(studioMissionId||studioDraft?.mission_id||studioMissions.length)}
                    onClick={()=>void runStudioMission()}>تشغيل الوكلاء بعد الموافقة</button>
                  <button type="button" disabled={Boolean(busy)||studioMissions.length===0}
                    onClick={()=>void sendMessage("لخص نتائج المهام")}>تلخيص المخرجات</button>
                  <Link href="/studio?section=outputs">المخرجات الكاملة</Link>
                </div>
                <small>قراءة وتلخيص مباشرة؛ إضافة مهمة وتشغيل الوكلاء بموافقتك. لا نشر ولا إعلانات مدفوعة.</small>
              </div>}
              {siteMode&&<div className="assistant-site-manager" role="region" aria-label="إدارة الموقع">
                <div className="assistant-site-manager-head">
                  <strong>إدارة موقع AGENT</strong>
                  <button type="button" disabled={Boolean(busy)}
                    onClick={()=>void sendMessage("افحص حالة الموقع")}>فحص الحالة</button>
                </div>
                {siteChange&&<div className="assistant-site-draft">
                  <strong>{siteChange.title}</strong>
                  <span>{siteChange.summary}</span>
                  <details>
                    <summary>مراجعة التعديلات ({siteChange.edits?.length||0})</summary>
                    {siteChange.edits?.map((e,i)=><div key={i} className="assistant-site-diff">
                      <small>{e.path}</small>
                      <pre>قبل: {e.search}</pre>
                      <pre>بعد: {e.replace}</pre>
                    </div>)}
                  </details>
                  {siteChange.status==="draft"&&
                    <button type="button" disabled={!siteWriteReady||Boolean(busy)}
                      onClick={()=>void approveSiteChange()}>فتح Pull Request للمراجعة</button>}
                  {siteChange.status==="pr_opened"&&siteChange.pr_url&&
                    <a href={siteChange.pr_url} target="_blank" rel="noopener noreferrer">عرض طلب المراجعة على GitHub</a>}
                  {siteChange.status==="opening_pr"&&<small>جارٍ إعداد طلب المراجعة...</small>}
                  {siteChange.status==="failed"&&<small>المقترح يحتاج إعادة إعداد.</small>}
                </div>}
                <small>{siteWriteReady?
                  "لا نشر تلقائي ولا تغيير على main؛ موافقتك تفتح طلب مراجعة فقط.":
                  "فحص واقتراحات حاليًا. فتح Pull Request يحتاج تصريح GitHub محدودًا لهذا المستودع."}</small>
              </div>}
              <AssistantLearningPanel threadId={threadId} refreshKey={messages.length}/>
              <div className="assistant-compose-foot">
                <label><input type="checkbox" checked={allowConditional} onChange={e=>setAllowConditional(e.target.checked)}/>
                  السماح بحصص Gemini وGroq المشروطة
                </label>
                <label className="assistant-work-option"><input type="checkbox" checked={studioMode}
                  disabled={Boolean(busy)} onChange={e=>{
                    setStudioMode(e.target.checked);
                    if(e.target.checked){
                      setSiteMode(false);setWorkMode(false);setSkill("auto");
                      if(threadId)void loadStudioState(threadId);
                    }
                  }}/>
                  إدارة المهام
                </label>
                <label className="assistant-work-option"><input type="checkbox" checked={siteMode}
                  disabled={Boolean(busy)} onChange={e=>{
                    setSiteMode(e.target.checked);
                    if(e.target.checked){
                      setWorkMode(false);setStudioMode(false);setSkill("auto");
                      if(threadId)void loadSiteState(threadId);
                    }
                  }}/>
                  إدارة الموقع
                </label>
                <label className="assistant-work-option"><input type="checkbox" checked={workMode}
                  disabled={Boolean(busy)} onChange={e=>{
                    if(e.target.checked&&!window.confirm(
                      "وضع عمل يستخدم Vercel Sandbox وقد يستهلك موارد حسابك. سيتم منع الإنترنت والتعديل الخارجي. تشغيل؟"
                    ))return;
                    setWorkMode(e.target.checked);
                    if(e.target.checked){setSkill("auto");setSiteMode(false);setStudioMode(false);}
                    setWorkSteps([]);setWorkProgress("");
                  }}/>
                  وضع عمل
                </label><span>{draft.length}/4500</span>
              </div>
              <p className="assistant-limit-note">{studioMode?
                "إدارة المهام: بيانات مؤسستك الفعلية، مسودات مهام، تشغيل الوكلاء بموافقة، وملخص النتائج. بدون Sandbox.":
                siteMode?
                "إدارة الموقع: فحص وتشخيص ومسودات تعديل ومراجعة GitHub. لا تعديل مباشر أو نشر تلقائي.":
                "وضع العمل يشغّل Sandbox للحسابات البرمجية فقط. لا تعديل خارجي. راجع النتائج."}</p>
            </div>
          </main>
        </div>}
    </div>
  </div>;
}
