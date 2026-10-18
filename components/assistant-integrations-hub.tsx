"use client";

import { useCallback,useEffect,useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Bot, CheckCircle2, CircleAlert, Cloud, Code2, Copy,
  Database, ExternalLink, Facebook, Globe, KeyRound, LockKeyhole,
  MessageCircle, PlugZap, RefreshCw, ShieldCheck
} from "lucide-react";
import { getSupabase } from "@/lib/supabase-browser";
import { currentSession } from "@/lib/auth-session";
import GithubConnectionPanel from "@/components/github-connection-panel";
import type { ConnectorDescriptor,ConnectorId } from "@/lib/assistant-integrations";

type ConnectorState=ConnectorDescriptor & {toggleable:boolean;enabled:boolean};
type Response={connectors?:ConnectorState[];aiProviders?:string[];error?:string};
const groups=[
  {id:"ai",name:"نماذج الذكاء الاصطناعي"},
  {id:"developer",name:"التطوير والمستودعات"},
  {id:"database",name:"قواعد البيانات"},
  {id:"social",name:"التواصل والتسويق"},
  {id:"browser",name:"تصفح المواقع"}
] as const;
const icons:Record<ConnectorId,typeof Cloud>={
  "ai-models":Bot,github:Code2,browser:Globe,"agent-database":Database,
  "pos-database":Database,facebook:Facebook,whatsapp:MessageCircle
};
export default function AssistantIntegrationsHub(){
  const db=getSupabase();
  const [connectors,setConnectors]=useState<ConnectorState[]>([]);
  const [setting,setSetting]=useState<ConnectorId|null>(null);
  const [aiProviders,setAiProviders]=useState<string[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [focused,setFocused]=useState<ConnectorId|null>(null);
  const [categoryView,setCategoryView]=useState("all");
  useEffect(()=>{
    const sync=()=>setCategoryView(new URLSearchParams(window.location.search).get("category")||"all");
    const select=(event:Event)=>setCategoryView((event as CustomEvent<string>).detail||"all");
    sync();
    window.addEventListener("popstate",sync);
    window.addEventListener("agent:select-integrations-category",select);
    return()=>{window.removeEventListener("popstate",sync);window.removeEventListener("agent:select-integrations-category",select);};
  },[]);
  const load=useCallback(async ()=>{
    if(!db){setError("تعذر الوصول للجلسة.");setLoading(false);return;}
    setLoading(true);setError("");
    try{
      const session=await currentSession(db);
      if(!session?.access_token)throw new Error("سجّل دخولك أولًا من صفحة العملاء.");
      const response=await fetch("/api/assistant/integrations",{
        headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"
      });
      const payload=await response.json() as Response;
      if(!response.ok)throw new Error(payload.error||"تعذر جلب الإضافات.");
      setConnectors(payload.connectors||[]);
      setAiProviders(payload.aiProviders||[]);
    }catch(e){setError(e instanceof Error?e.message:"تعذر تحميل الإضافات.");}
    finally{setLoading(false);}
  },[db]);
  useEffect(()=>{void load();},[load]);
  async function toggleConnector(connectorId:ConnectorId,enabled:boolean){
    if(!db||setting)return;
    setSetting(connectorId);setError("");
    try{
      const session=await currentSession(db);
      if(!session?.access_token)throw new Error("سجّل الدخول لإدارة إضافاتك.");
      const resp=await fetch("/api/assistant/integrations",{
        method:"POST",
        headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},
        body:JSON.stringify({connectorId,enabled})
      });
      const result=await resp.json() as {error?:string;ok?:boolean};
      if(!resp.ok||!result.ok)throw new Error(result.error||"تعذر تغيير حالة الإضافة.");
      setConnectors(items=>items.map(c=>c.id===connectorId?{...c,enabled}:c));
    }catch(e){setError(e instanceof Error?e.message:"تعذر حفظ إعداد الإضافة.");}
    finally{setSetting(null);}
  }
  return <div className="crm-root agent-integrations-root">
    <div className="crm-wrap">
      <header className="crm-header">
        <div><strong>AGENT</strong><span> · مركز الإضافات والاتصالات</span></div>
        <nav className="crm-actions">
          <Link href="/assistant"><ArrowRight size={16}/> المساعد</Link>
          <Link href="/studio">استوديو التسويق</Link>
        </nav>
      </header>
      <section className="integrations-hero">
        <div>
          <span className="crm-overline">AGENT CONNECTORS • V1</span>
          <h1><PlugZap size={26}/>{categoryView==="social"?"فيسبوك وواتساب":categoryView==="developer"?"GitHub وأدوات التطوير":"الإضافات والاتصالات"}</h1>
          <p>مكان واحد للمهارات والبرامج ومفاتيح API. تفعيل الوصلة يختلف عن وجود مفتاح: أي اتصال حقيقي لازم يمر بالمصادقة والصلاحيات والاختبار.</p>
        </div>
        <button type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> تحديث الحالة</button>
      </section>
      <div className="integrations-security">
        <ShieldCheck size={20}/>
        <span>مفاتيح API محفوظة على سيرفر Vercel، ولا تظهر قيمها داخل AGENT. لا توجد صلاحية للنشر أو إرسال رسائل أو تعديل مستودعات/قواعد بيانات خارجية في النسخة الحالية.</span>
      </div>
      {error && <div className="crm-error" role="alert">{error} <Link href="/crm">تسجيل الدخول</Link></div>}
      {loading && <p className="integrations-loading">جارٍ التحقق من حالة الإضافات...</p>}
      {!loading && connectors.length>0 && <>
        <div className="integrations-stats">
          <div><strong>{connectors.filter(c=>["internal","read-only"].includes(c.status)&&c.enabled).length}</strong><span>إمكانيات مفعّلة</span></div>
          <div><strong>{aiProviders.length}</strong><span>مزوّد AI بمفتاح سيرفر</span></div>
          <div><strong>{connectors.filter(c=>c.status==="credentials-present").length}</strong><span>وصلات مفاتيحها موجودة وتحتاج تفعيل</span></div>
        </div>
        {(categoryView==="all"||categoryView==="developer")&&<GithubConnectionPanel/>}
        {groups.filter(group=>categoryView==="all"||(
          categoryView==="social"?group.id==="social":
          categoryView==="developer"?(group.id==="developer"||group.id==="browser"||group.id==="database"):true
        )).map(group=><section className="integrations-section" key={group.id}>
          <h2>{group.name}</h2>
          <div className="integrations-grid">
            {connectors.filter(item=>item.category===group.id).map(item=>{
              const Icon=icons[item.id];
              const isActive=["internal","read-only"].includes(item.status)&&item.enabled;
              return <article className="integration-card" key={item.id}>
                <div className="integration-card-head"><span className="integration-icon"><Icon size={20}/></span>
                  <div className="integration-card-name"><h3>{item.title}</h3>
                    <span className={isActive?"integration-status ready":"integration-status"}>
                      {isActive?<CheckCircle2 size={13}/>:<CircleAlert size={13}/>}
                      {item.toggleable&&!item.enabled?"موقوفة من إعداداتك":item.statusLabel}
                    </span></div>
                </div>
                <p>{item.description}</p>
                <div className="integration-capability"><LockKeyhole size={14}/>{item.capability}</div>
                {item.toggleable && <label className="integration-toggle">
                  <span>{item.enabled?"الإضافة مفعّلة لحسابك":"الإضافة متوقفة لحسابك"}</span>
                  <input type="checkbox" checked={item.enabled} disabled={Boolean(setting)}
                    onChange={e=>void toggleConnector(item.id,e.target.checked)}
                    aria-label={"تفعيل إضافة "+item.title}/>
                </label>}
                {item.id==="ai-models" && <div className="integration-models">{aiProviders.length?
                  aiProviders.map(p=><span key={p}>{p}</span>):"لم يتم العثور على مفاتيح AI في السيرفر"}</div>}
                {focused===item.id && <div className="integration-details">
                  <strong>إعداد الوصلة</strong>
                  {item.requiredKeys.length>0?<>
                    <p>أضف المتغيرات التالية إلى Vercel → Production → Environment Variables، وفعّل Sensitive ثم أعد النشر. لا تلصق المفاتيح في الشات.</p>
                    {item.requiredKeys.map(key=><div className="integration-key" key={key}>
                      <code dir="ltr">{key}</code>
                      <button type="button" onClick={()=>void navigator.clipboard.writeText(key)} aria-label={"نسخ "+key}><Copy size={15}/></button>
                    </div>)}
                  </>:<p>هذه الوصلة لا تحتاج مفتاحًا حاليًا في وضع القراءة المحدود. الصلاحيات الجديدة ستحتاج مراجعة وتفويض منفصل.</p>}
                  {["facebook","whatsapp","pos-database"].includes(item.id)&&<p className="integration-warning">وجود متغيرات API لا يُفعّل الربط تلقائيًا. OAuth / Webhooks / صلاحيات قواعد البيانات قيد التطوير، ولن تستخدم AGENT مفتاحًا خارجيًا قبل تفعيل مسار آمن.</p>}
                  <a href={item.docsUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> توثيق الإضافة</a>
                </div>}
                <div className="integration-actions">
                  <button type="button" onClick={()=>setFocused(current=>current===item.id?null:item.id)}>
                    <KeyRound size={15}/>{focused===item.id?"إخفاء التفاصيل":"الإعداد ومفاتيح API"}
                  </button>
                  {item.id==="ai-models"&&<Link href="/studio">تجربة النماذج</Link>}
                  {item.id==="github"&&item.enabled&&<Link href="/assistant">افحص كود GitHub</Link>}
                  {item.id==="browser"&&item.enabled&&<Link href="/assistant">جرب قراءة صفحة</Link>}
                </div>
              </article>;
            })}
          </div>
        </section>)}
      </>}
      <div className="integrations-footer">
        <h2>إزاي هنوسع AGENT بعد كده؟</h2>
        <p>كل إضافة هتكون وحدة مستقلة بعقد واضح: صلاحيات محددة، اختبار اتصال، سجل عمليات، حد إنفاق، وموافقة بشرية قبل أي تعديل أو إرسال خارجي. هنبدأ بالقراءة والتحليل ثم نضيف الأفعال واحدة واحدة.</p>
        <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer"><Cloud size={16}/> افتح Vercel لإضافة مفاتيح السيرفر <ExternalLink size={14}/></a>
      </div>
    </div>
  </div>;
}
