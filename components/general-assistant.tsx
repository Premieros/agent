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
import {detectAgentIntent,describeAgentIntent,extractMemory,type AgentIntent} from "@/lib/assistant-intent";

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
type AgentApproval={intent:AgentIntent|"studio-confirm"|"site-approve"|"work-resume"|
  "approve-memory"|"approve-skill";text:string;id?:string;title?:string;detail?:string};
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
  researchResult?:{query:string;searchedAt:string;trustedDomains:number;warnings:string[];
    sources:Array<{title:string;url:string;excerpt:string;publisher:string;
      publishedAt:string|null;trusted:boolean}>}|null;
};
const starters=[
  {label:"كتابة", icon:FileText, text:"اكتب لي منشور احترافي لصفحة Premier.OS عن فوائد أنظمة الكاشير للمطاعم، بدون أسعار غير مؤكدة."},
  {label:"تطوير POS", icon:Code2, text:"أنت مدير تطوير نظام Premier.OS الحالي. ابدأ بخطة لمراجعة علاقات الفروع والمخازن والمخزون والمبيعات والمشتريات والوصفات والتكاليف والحسابات. قل ما تحتاج رؤيته ولا تفترض مواصفات غير مؤكدة."},
  {label:"تخطيط", icon:Lightbulb, text:"حوّل فكرة إنشاء شركة برمجيات لخطة عملية من 30 يوم بخطوات وأولويات."},
  {label:"بحث الإنترنت", icon:Globe, text:"ابحث عن أحدث الأخبار الموثوقة في الذكاء الاصطناعي، وأرفق المصادر وتواريخ نشرها مع توضيح حدود التحقق."}
];

export default function GeneralAssistant() {
  const db=getSupabase();
  const [threads,setThreads]=useState<Thread[]>([]);
  const [threadId,setThreadId]=useState("");
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [draft,setDraft]=useState("");
  const [skill,setSkill]=useState<AssistantSkill>("auto");
  const [allowConditional,setAllowConditional]=useState(false);
  const [activeArea,setActiveArea]=useState<"studio"|"site"|null>(null);
  const [pendingAction,setPendingAction]=useState<AgentApproval|null>(null);
  const [showLearning,setShowLearning]=useState(false);
  const [pageName,setPageName]=useState("");
  const [pagePlatform,setPagePlatform]=useState<"facebook"|"instagram">("facebook");
  const [pageContext,setPageContext]=useState("");
  const [pageAudience,setPageAudience]=useState("");
  const [memoryText,setMemoryText]=useState("");
  const [memorySubject,setMemorySubject]=useState("");
  const [memoryGlobal,setMemoryGlobal]=useState(true);
  const [newSkillTitle,setNewSkillTitle]=useState("");
  const [newSkillPhrase,setNewSkillPhrase]=useState("");
  const [newSkillInstructions,setNewSkillInstructions]=useState("");
  const seenSuggestions=useRef(new Set<string>());
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
  const [researchResult,setResearchResult]=useState<AssistantResponse["researchResult"]>(null);
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
    setBusy("loading-thread");setError("");setBrowserResult(null);setResearchResult(null);
    try {
      const res=await fetch("/api/assistant?threadId="+encodeURIComponent(id),{
        headers:await authHeaders(),cache:"no-store"
      });
      const data=await res.json() as AssistantResponse;
      if(!res.ok)throw new Error(data.error||"تعذر فتح المحادثة.");
      setThreadId(id);
      setMessages(data.messages||[]);
      setSkill("auto");
      setPendingAction(null);setShowLearning(false);
      const lastReply=(data.messages||[]).filter(m=>m.role==="assistant").at(-1);
      setActiveArea(lastReply?.model==="studio-data"?"studio":
        lastReply?.model==="site-manager"?"site":null);
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
    setSiteChange(null);setStudioDraft(null);setStudioMissions([]);setStudioPages([]);
    setStudioPageId("");setStudioMissionId("");setPendingAction(null);setActiveArea(null);setShowLearning(false);
    try {
      const res=await fetch("/api/assistant",{
        method:"POST",headers:await authHeaders(),
        body:JSON.stringify({action:"create",skill:"auto"})
      });
      const data=await res.json() as AssistantResponse;
      if(!res.ok||!data.thread)throw new Error(data.error||"تعذر إنشاء المحادثة.");
      setThreadId(data.thread.id);setMessages([]);setThreads(current=>[data.thread!,...current]);
      setShowSidebar(false);
      window.dispatchEvent(new Event("agent:close-navigation"));
      setBrowserResult(null);setResearchResult(null);
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
        setThreadId("");setMessages([]);setNote("");setBrowserResult(null);setResearchResult(null);setPendingWork(null);
        setPendingAction(null);setActiveArea(null);setShowLearning(false);
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

  async function studioRequest(id:string,action:"overview"|"prepare"|"confirm"|"summary"|"create_page",
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

  async function suggestLearningApproval(id:string){
    try{
      const res=await fetch("/api/assistant/learning?threadId="+encodeURIComponent(id),{
        headers:await authHeaders(),cache:"no-store"
      });
      if(!res.ok)return;
      const data=await res.json() as {
        memories?:Array<{id:string;subject:string;content:string;status:string;source:string}>;
        skills?:Array<{id:string;title:string;instructions:string;status:string;source:string}>;
      };
      const memory=data.memories?.find(x=>x.status==="suggested"&&x.source==="automatic"&&
        !seenSuggestions.current.has(x.id));
      const found=memory||data.skills?.find(x=>x.status==="suggested"&&x.source==="automatic"&&
        !seenSuggestions.current.has(x.id));
      if(!found)return;
      seenSuggestions.current.add(found.id);
      setPendingAction({intent:memory?"approve-memory":"approve-skill",
        text:memory?"اعتماد معلومة مقترحة":"تفعيل مهارة مقترحة",
        title:memory?memory.subject:(found as {title?:string}).title,
        detail:memory?memory.content:(found as {instructions?:string}).instructions,
        id:found.id});
    }catch{/* Suggestions never block the chat. */}
  }

  async function postLearning(action:string,payload:Record<string,unknown>,id:string){
    const res=await fetch("/api/assistant/learning",{
      method:"POST",headers:await authHeaders(),
      body:JSON.stringify({action,threadId:id,...payload})
    });
    const data=await res.json() as {error?:string;id?:string;messages?:ChatMessage[]};
    if(!res.ok)throw new Error(data.error||"تعذر تحديث الذاكرة أو المهارة.");
    if(data.messages?.length)setMessages(current=>[
      ...current.filter(m=>!m.id.startsWith("pending-")),...data.messages!
    ]);
    return data;
  }

  function requestApproval(intent:AgentApproval["intent"],text:string,id?:string){
    if(busy)return;
    setPendingAction({intent,text,id});
    if(intent==="memory-save"){
      const memory=extractMemory(text);
      setMemoryText(memory);setMemorySubject(memory.slice(0,85));
      setMemoryGlobal(true);
    }
    if(intent==="studio-page-create"){
      setPageName(text.replace(/^(?:أضف|اضف|أنشئ|انشئ|سجل|اعمل|جهز|create|add)\s+(?:لي\s+)?(?:صفحة|صفحه|page|marketing\s+page)\s*/iu,"")
        .replace(/^(?:اسمها|باسم)\s*/iu,"").trim().slice(0,120));
      setPagePlatform(/(?:instagram|انستجرام|إنستجرام|انستغرام)/iu.test(text)?"instagram":"facebook");
      setPageContext("");setPageAudience("");
    }
    if(intent==="skill-create"){
      const name=text.replace(/^(?:أنشئ|انشئ|اعمل|أضف|اضف|اصنع|جهز)\s+(?:لي\s+)?(?:مهارة|مهاره|skill)\s*/iu,"")
        .replace(/^(?:اسمها|باسم)\s*/iu,"").trim().slice(0,76);
      const title=name.slice(0,65)||"مهارة مخصصة";
      setNewSkillTitle(title);
      setNewSkillPhrase(title.length>=4?title:"مهارة مخصصة");
      setNewSkillInstructions("عند طلب هذه المهمة، التزم بهذه المتطلبات: "+text.slice(0,700));
    }
    if(intent.startsWith("studio")&&threadId)void loadStudioState(threadId);
    if(intent.startsWith("site")&&threadId)void loadSiteState(threadId);
  }

  async function confirmStudioDraft(confirmed=false,idOverride=threadId){
    if(busy||!idOverride||studioDraft?.status!=="draft")return;
    if(!confirmed){requestApproval("studio-confirm","تأكيد حفظ المهمة في AGENT");return;}
    setBusy("studio-create");setError("");setNote("");
    try{
      await studioRequest(idOverride,"confirm",{draftId:studioDraft.id});
      await loadStudioState(idOverride);
      setNote("تم حفظ المهمة. تشغيل الوكلاء خطوة منفصلة تحتاج موافقتك.");
    }catch(e){setError(e instanceof Error?e.message:"تعذر حفظ المهمة.");}
    finally{setBusy("");}
  }

  async function runStudioMission(confirmed=false,idOverride=threadId){
    if((busy&&busy!=="send")||!idOverride)return;
    if(!confirmed){requestApproval("studio-run","شغّل الوكلاء للمهمة المحددة");return;}
    const id=studioMissionId||
      (studioDraft?.status==="created"?studioDraft.mission_id:null)||
      (!studioDraft&&studioMissions.length===1?studioMissions[0].id:null);
    if(!id){setError("حدد المهمة المطلوبة قبل التشغيل، لتجنب تشغيل مهمة أخرى بالخطأ.");return;}
    const selected=studioMissions.find(m=>m.id===id);
    if(selected&&!["queued","failed"].includes(selected.status)){
      setError("المهمة ليست جاهزة للتشغيل. راجع حالتها في الاستوديو.");return;
    }
    setBusy("studio-run");setError("");setNote("جارٍ توزيع العمل على الوكلاء...");
    try{
      const res=await fetch("/api/agents/run",{
        method:"POST",headers:await authHeaders(),
        body:JSON.stringify({missionId:id,mode:"economy",routing:"auto",
          allowConditionalFreeTier:allowConditional})
      });
      const result=await res.json() as {error?:string;agents?:number;apiCalls?:number};
      if(!res.ok)throw new Error(result.error||"تعذر تشغيل الوكلاء.");
      let summarySaved=true;
      try{await studioRequest(idOverride,"summary",{missionId:id});}
      catch{summarySaved=false;}
      await loadStudioState(idOverride);
      setNote("تم حفظ "+(result.agents||0)+" مخرجات في الاستوديو للمراجعة."+
        (summarySaved?"":" تعذر التلخيص؛ يمكنك الضغط على تلخيص المخرجات لاحقًا.")+
        " لا نشر خارجي.");
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

  async function approveSiteChange(confirmed=false){
    if(!siteChange||siteChange.status!=="draft"||busy)return;
    if(!confirmed){requestApproval("site-approve","فتح طلب مراجعة التعديل على GitHub");return;}
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

  async function sendMessage(text=draft,approved=false) {
    const message=text.trim();
    if(busy||!message||message.length>4500)return;
    const previous=messages.filter(m=>m.role==="assistant").at(-1);
    const intent=detectAgentIntent(message,previous?.model);
    if(intent==="learning-list"){
      setShowLearning(true);setDraft("");setNote("دي معلومات AGENT المحفوظة فعليًا؛ تقدر تراجعها أو تحذفها.");return;
    }
    if(intent==="learning-hide"){
      setShowLearning(false);setDraft("");setNote("تم إغلاق عرض الذاكرة والمهارات.");return;
    }
    if(!approved&&intent!=="chat"){requestApproval(intent,message);return;}
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
      if(intent==="memory-save"){
        const data=await postLearning("add_memory",{
          subject:memorySubject.trim(),content:memoryText.trim(),
          scope:memoryGlobal?"global":"thread",category:"project"
        },id);
        setMessages(current=>current.filter(m=>m.id!==optimistic.id));
        setNote(data.id?"تم حفظ المعلومة في ذاكرة AGENT المستقلة.":"تم تحديث الذاكرة.");
        return;
      }
      if(intent==="skill-create"){
        const data=await postLearning("create_skill",{
          title:newSkillTitle.trim(),description:"مهارة مخصصة مقترحة للمراجعة",
          instructions:newSkillInstructions.trim(),
          phrases:newSkillPhrase.split(/[،,]/).map(x=>x.trim()).filter(Boolean),
          baseSkill:"general"
        },id);
        setMessages(current=>current.filter(m=>m.id!==optimistic.id));
        setNote("تم إعداد مهارة مقترحة للمراجعة فقط.");
        if(data.id)setPendingAction({
          intent:"approve-skill",text:"تفعيل المهارة الجديدة",title:newSkillTitle,id:data.id
        });
        return;
      }
      if(intent==="studio-page-create"){
        setActiveArea("studio");
        await studioRequest(id,"create_page",{
          pageName:pageName.trim(),platform:pagePlatform,
          productContext:pageContext.trim(),targetAudience:pageAudience.trim(),
          brandVoice:"مصري احترافي وواضح"
        });
        await loadStudioState(id);
        setMessages(current=>current.filter(m=>m.id!==optimistic.id));
        setNote("تم إنشاء صفحة تسويق حقيقية في قاعدة AGENT. لم يتم ربط Meta أو نشر محتوى.");
        return;
      }
      if(intent==="studio-run"){
        setActiveArea("studio");
        setMessages(current=>current.filter(m=>m.id!==optimistic.id));
        await runStudioMission(true,id);
        return;
      }
      if(intent==="studio-overview"||intent==="studio-summary"||intent==="studio-prepare"){
        setActiveArea("studio");
        const action=intent==="studio-summary"?"summary":
          intent==="studio-prepare"?"prepare":"overview";
        const data=await studioRequest(id,action,{
          task:message,
          pageId:intent==="studio-prepare"&&studioPageId?studioPageId:undefined,
          missionId:intent==="studio-summary"&&studioMissionId?studioMissionId:undefined
        });
        await loadStudioState(id);
        setNote(action==="prepare"?"المقترح جاهز للمراجعة، ولم يُحفظ كمهمة بعد.":
          "تمت قراءة البيانات الفعلية بدون Sandbox.");
        if(action==="prepare"&&data.draft){
          setPendingAction({intent:"studio-confirm",text:"حفظ المهمة المقترحة بعد المراجعة"});
        }
        return;
      }
      if(intent==="site-diagnose"||intent==="site-draft"){
        setActiveArea("site");
        const diagnose=intent==="site-diagnose";
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
        setNote(diagnose?"تم فحص موقع AGENT بدون Sandbox.":
          "تم حفظ مقترح الموقع للمراجعة فقط؛ لا تغيير مباشر.");
        return;
      }
      if(intent==="work"){
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
      setActiveArea(null);
      const res=await fetch("/api/assistant",{
        method:"POST",headers:await authHeaders(),
        body:JSON.stringify({action:"send",threadId:id,text:message,skill:"auto",allowConditionalFreeTier:allowConditional})
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
      const toolNote=data.model==="agent-web-search"
        ?"بحث فهارس مباشرة · دون نموذج AI"
        :`${data.model||"نموذج غير محدد"} · ${data.attempts??1} محاولة`;
      setNote(`مهارة ${data.customSkill||assistantSkills.find(s=>s.id===data.skill)?.title||data.skill} · ${toolNote}`+projectNote);
      setSourceFiles(data.sourceInspection?.inspected||[]);
      setSourceProject(data.sourceInspection?.repository||"");
      setBrowserResult(data.browserResult||null);
      setResearchResult(data.researchResult||null);
      await loadThreads(false);
      await suggestLearningApproval(id);
    }catch(e){
      setMessages(current=>current.filter(m=>!m.id.startsWith("pending-")));
      setDraft(message);setWorkProgress("");
      setError(e instanceof Error?e.message:"تعذر إرسال الرسالة.");
    }finally{setBusy("");}
  }

  async function approvePending(){
    const choice=pendingAction;
    if(!choice||busy)return;
    const kind=choice.intent;
    if(kind==="studio-run"&&!studioMissionId&&
      !(studioDraft?.status==="created"&&studioDraft.mission_id)&&studioMissions.length!==1){
      setError("اختار مهمة واحدة للتشغيل من نافذة الموافقة.");return;
    }
    setPendingAction(null);
    if(kind==="studio-confirm"){await confirmStudioDraft(true);return;}
    if(kind==="site-approve"){await approveSiteChange(true);return;}
    if(kind==="work-resume"){if(pendingWork)await finishWork(pendingWork,threadId);return;}
    if((kind==="approve-memory"||kind==="approve-skill")&&choice.id){
      setBusy("learning-approval");setError("");
      try{
        await postLearning(kind==="approve-memory"?"approve_memory":"approve_skill",
          {id:choice.id},threadId);
        setNote(kind==="approve-memory"?
          "تم اعتماد الذاكرة وسيستخدمها AGENT عند الحاجة.":
          "تم تفعيل المهارة المخصصة في AGENT.");
      }catch(e){setError(e instanceof Error?e.message:"تعذر اعتماد الاقتراح.");}
      finally{setBusy("");}
      return;
    }
    await sendMessage(choice.text,true);
  }

  const approvalInfo=pendingAction?(
    pendingAction.intent==="studio-confirm"?
      {title:"تأكيد إضافة المهمة",detail:"سيُحفظ التكليف داخل AGENT فقط. تشغيل الوكلاء خطوة منفصلة.",cost:"بدون نموذج AI أو Sandbox"}:
    pendingAction.intent==="site-approve"?
      {title:"فتح طلب مراجعة الموقع",detail:"Pull Request في Premieros/agent للمراجعة فقط؛ لا دمج أو نشر تلقائي.",cost:"يتطلب تصريح GitHub محدودًا"}:
    pendingAction.intent==="work-resume"?
      {title:"استكمال وضع العمل",detail:"قد ينفذ Sandbox خطة محفوظة ضمن حصتك.",cost:"قد يستهلك حصة Sandbox"}:
    pendingAction.intent==="approve-memory"?
      {title:"اعتماد ذاكرة مقترحة",detail:"سيستخدم AGENT المعلومة ضمن سياق المحادثات ذات الصلة.",cost:"بدون استدعاء نموذج AI"}:
    pendingAction.intent==="approve-skill"?
      {title:"تفعيل مهارة مقترحة",detail:"سيستخدمها AGENT عند توافق الطلب ولا تمنح أي صلاحية إضافية.",cost:"بدون Sandbox"}:
      describeAgentIntent(pendingAction.intent)
  ):null;

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
          <p>مساعد واحد للمحادثات والذاكرة والمهارات والموقع والمهام والعمل، مع موافقة قبل الإجراءات.</p>
        </div>
        <div className="assistant-tag"><ShieldCheck size={15}/> أدوات تلقائية الاختيار · تشغيل بموافقتك</div>
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
              <span className="assistant-auto-skill"><Sparkles size={14}/> اختيار المهارة تلقائيًا</span>
            </div>
            <div className="assistant-chat-scroll">
              {messages.length===0 && <div className="assistant-welcome">
                <div className="assistant-logo"><WandSparkles size={32}/></div>
                <h2>اطلب اللي محتاجه من AGENT</h2>
                <p>AGENT يختار المهارة والأداة تلقائيًا من كلامك، ويطلب موافقتك قبل أي حفظ أو تغيير أو تشغيل.</p>
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
              {researchResult&&<details className="assistant-research-results">
                <summary>
                  <span><Globe size={15}/> مصادر البحث ({researchResult.sources.length}) · {new Date(researchResult.searchedAt).toLocaleDateString("ar-EG")}</span>
                  <span className="assistant-research-hint">عرض النتائج والمصادر <ChevronDown size={14}/></span>
                </summary>
                <div className="assistant-research-body">
                  <p>هذه مقتطفات فهرسة مرتبطة بالسؤال، وليست تحققًا مستقلًا من المقالات. لا تحفظ معلوماتها كحقائق دون مراجعتها.</p>
                  {researchResult.sources.map((source,i)=><section key={source.url} className="assistant-research-item">
                    <a href={source.url} dir="auto" target="_blank" rel="noopener noreferrer">
                      {i+1}. {source.title}</a>
                    <small>{source.publisher}{source.publishedAt?" · "+source.publishedAt.slice(0,10):" · غير مؤرخ"}
                      {source.trusted?" · موقع معروف (ليس تحققًا من المحتوى)":" · يحتاج تحققًا إضافيًا"}</small>
                    {source.excerpt&&<p dir="auto">{source.excerpt.slice(0,225)}</p>}
                  </section>)}
                  {researchResult.warnings.length>0&&<p className="assistant-research-warnings">{researchResult.warnings.join(" · ")}</p>}
                </div>
              </details>}
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
                    onClick={()=>requestApproval("work-resume","استكمال مهمة عمل محفوظة")}>استكمال</button>}
                {pendingWork&&["running","reporting"].includes(pendingWork.status)&&
                  <button type="button" disabled={Boolean(busy)}
                    onClick={()=>void loadWorkState(threadId)}>تحديث</button>}
              </div>}
              {activeArea==="studio"&&<div className="assistant-studio-control" role="region" aria-label="إدارة صفحات التسويق والمهام">
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
                  <button type="button" disabled={Boolean(busy)||!(studioMissionId||
                      (studioDraft?.status==="created"&&studioDraft.mission_id)||
                      (!studioDraft&&studioMissions.length))}
                    onClick={()=>void runStudioMission()}>تشغيل الوكلاء بعد الموافقة</button>
                  <button type="button" disabled={Boolean(busy)||studioMissions.length===0}
                    onClick={()=>void sendMessage("لخص نتائج المهام")}>تلخيص المخرجات</button>
                  <Link href="/studio?section=outputs">المخرجات الكاملة</Link>
                </div>
                <small>قراءة وتلخيص مباشرة؛ إضافة مهمة وتشغيل الوكلاء بموافقتك. لا نشر ولا إعلانات مدفوعة.</small>
              </div>}
              {activeArea==="site"&&<div className="assistant-site-manager" role="region" aria-label="إدارة الموقع">
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
              {showLearning&&<div className="assistant-on-demand-learning">
                <div className="assistant-on-demand-learning-head">
                  <strong>الذاكرة والمهارات المحفوظة</strong>
                  <button type="button" onClick={()=>setShowLearning(false)} aria-label="إغلاق الذاكرة والمهارات">إغلاق ×</button>
                </div>
                <AssistantLearningPanel threadId={threadId} refreshKey={messages.length} initialOpen/>
              </div>}
              <div className="assistant-compose-foot">
                <label><input type="checkbox" checked={allowConditional}
                  onChange={e=>setAllowConditional(e.target.checked)}/>
                  السماح بحصص Gemini وGroq المشروطة
                </label>
                <span>{draft.length}/4500</span>
              </div>
              <p className="assistant-limit-note">AGENT يختار المهارة والأداة حسب الطلب. التغييرات، وتشغيل الوكلاء وSandbox، تحتاج موافقتك أولًا.</p>
            </div>
          </main>
        </div>}
    </div>
    {pendingAction&&approvalInfo&&<div className="agent-consent-overlay" role="presentation">
      <section className="agent-consent-dialog" role="dialog" aria-modal="true"
        aria-labelledby="agent-consent-heading" dir="rtl"
        onKeyDown={e=>{if(e.key==="Escape")setPendingAction(null);}}>
        <div className="agent-consent-head">
          <ShieldCheck size={20}/>
          <h2 id="agent-consent-heading">{approvalInfo.title}</h2>
          <button type="button" title="إغلاق الطلب" aria-label="إغلاق طلب الموافقة"
            onClick={()=>setPendingAction(null)}>×</button>
        </div>
        <p>{approvalInfo.detail}</p>
        <div className="agent-consent-cost">{approvalInfo.cost}</div>
        {(pendingAction.intent==="approve-memory"||pendingAction.intent==="approve-skill")&&
          <div className="agent-consent-preview">
            <strong>{pendingAction.title}</strong>
            <p>{pendingAction.detail||"مقترح محفوظ ينتظر مراجعتك."}</p>
          </div>}
        {pendingAction.intent==="studio-page-create"&&<div className="agent-consent-fields">
          <label>اسم صفحة التسويق
            <input value={pageName} maxLength={120} autoFocus
              onChange={e=>setPageName(e.target.value)}/>
          </label>
          <label>المنصة
            <select value={pagePlatform}
              onChange={e=>setPagePlatform(e.target.value as "facebook"|"instagram")}>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>
          </label>
          <label>وصف النشاط
            <textarea value={pageContext} maxLength={4000} rows={2}
              onChange={e=>setPageContext(e.target.value)} placeholder="اختياري"/>
          </label>
          <label>الجمهور المستهدف
            <textarea value={pageAudience} maxLength={2000} rows={2}
              onChange={e=>setPageAudience(e.target.value)} placeholder="اختياري"/>
          </label>
          <small>ده ملف داخلي على Supabase في مؤسستك، مش ربط أو نشر على Meta.</small>
        </div>}
        {pendingAction.intent==="memory-save"&&<div className="agent-consent-fields">
          <label>عنوان المعلومة
            <input value={memorySubject} maxLength={110}
              onChange={e=>setMemorySubject(e.target.value)}/>
          </label>
          <label>المعلومة اللي هيفتكرها AGENT
            <textarea value={memoryText} maxLength={900} rows={3}
              onChange={e=>setMemoryText(e.target.value)}/>
          </label>
          <label className="agent-consent-check">
            <input type="checkbox" checked={memoryGlobal} onChange={e=>setMemoryGlobal(e.target.checked)}/>
            تظل متاحة لكل محادثاتي في AGENT
          </label>
        </div>}
        {pendingAction.intent==="skill-create"&&<div className="agent-consent-fields">
          <label>اسم المهارة
            <input value={newSkillTitle} maxLength={90}
              onChange={e=>setNewSkillTitle(e.target.value)}/>
          </label>
          <label>عبارات تشغيل المهارة (افصل بينها بفاصلة)
            <input value={newSkillPhrase} maxLength={250}
              onChange={e=>setNewSkillPhrase(e.target.value)}/>
          </label>
          <label>تعليمات المهارة
            <textarea value={newSkillInstructions} maxLength={1000} rows={3}
              onChange={e=>setNewSkillInstructions(e.target.value)}/>
          </label>
          <small>الحفظ كمقترح أولًا؛ سيظهر تأكيد منفصل للتفعيل.</small>
        </div>}
        {(pendingAction.intent==="studio-run"||pendingAction.intent==="studio-prepare")&&
          <div className="agent-consent-fields">
            {pendingAction.intent==="studio-prepare"&&<label>الصفحة المطلوبة
              <select value={studioPageId} onChange={e=>setStudioPageId(e.target.value)}>
                <option value="">اختيار بالاسم المذكور في الطلب</option>
                {studioPages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>}
            {pendingAction.intent==="studio-run"&&<label>المهمة التي سيشغّلها AGENT
              <select value={studioMissionId} onChange={e=>setStudioMissionId(e.target.value)}>
                <option value="">{studioMissions.length===1?"المهمة الوحيدة": "حدد المهمة قبل التشغيل"}</option>
                {studioMissions.filter(m=>m.status==="queued"||m.status==="failed").map(m=>
                  <option key={m.id} value={m.id}>
                    {(studioPages.find(p=>p.id===m.page_id)?.name||"صفحة")+
                      " · "+m.objective+" · "+m.status}
                  </option>)}
              </select>
            </label>}
          </div>}
        {pendingAction.intent==="studio-confirm"&&studioDraft&&
          <div className="agent-consent-preview">
            <strong>{studioPages.find(p=>p.id===studioDraft.page_id)?.name||"المهمة المقترحة"}</strong>
            <p>{studioDraft.brief}</p>
          </div>}
        {pendingAction.intent==="site-approve"&&siteChange&&
          <details className="agent-consent-preview">
            <summary>{siteChange.title} · راجع التغييرات قبل الموافقة</summary>
            <p>{siteChange.summary}</p>
            {siteChange.edits.map((edit,i)=><div key={i}>
              <small>{edit.path}</small><pre>قبل: {edit.search}</pre>
              <pre>بعد: {edit.replace}</pre>
            </div>)}
          </details>}
        {pendingAction.intent==="work-resume"&&pendingWork&&
          <div className="agent-consent-preview">{pendingWork.steps.join(" · ")}</div>}
        <div className="agent-consent-actions">
          <button type="button" onClick={()=>setPendingAction(null)}>إلغاء</button>
          <button type="button" className="agent-consent-approve" autoFocus
            disabled={Boolean(busy)||
              (pendingAction.intent==="memory-save"&&
                (memorySubject.trim().length<3||memoryText.trim().length<4))||
              (pendingAction.intent==="studio-page-create"&&
                (pageName.trim().length<2||pageName.trim().length>120))||
              (pendingAction.intent==="skill-create"&&
                (newSkillTitle.trim().length<3||newSkillPhrase.trim().length<4||
                  newSkillInstructions.trim().length<12))||
              (pendingAction.intent==="studio-run"&&!studioMissionId&&
                !(studioDraft?.status==="created"&&studioDraft.mission_id)&&
                studioMissions.length!==1)}
            onClick={()=>void approvePending()}>
            {pendingAction.intent==="approve-memory"||pendingAction.intent==="approve-skill"?
              "اعتماد وتفعيل":"موافق، أكمل"}
          </button>
        </div>
      </section>
    </div>}
  </div>;
}
