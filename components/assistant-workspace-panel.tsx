"use client";

import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {Check,ChevronLeft,Globe,LoaderCircle,PlugZap,RefreshCw,ShieldCheck,UsersRound,X} from "lucide-react";

export type WorkspaceView="overview"|"customers"|"followups"|"inbox"|"integrations";
type Lead={id:string;full_name:string;business_name:string|null;stage:string;business_type:string;priority:string};
type Followup={id:string;lead_id:string;handoff_type:string;status:string;summary:string};
type Conversation={id:string;lead_id:string;channel:string;mode:string};
type Snapshot={counts:{leads:number;conversations:number;pending:number};role:string;canWrite:boolean;
  leads:Lead[];tasks:Followup[];conversations:Conversation[];readAt:string};
type Connector={id:string;name?:string;label?:string;title?:string;status:string;
  toggleable:boolean;enabled:boolean};
type IntegrationState={connectors:Connector[];aiProviders:unknown;policy?:{externalPublishingEnabled:boolean}};
type LeadDraft={fullName:string;businessName:string;phone:string;businessType:string};
const initialLead:LeadDraft={fullName:"",businessName:"",phone:"",businessType:"other"};
const views:Array<{id:WorkspaceView;label:string}>=[
  {id:"overview",label:"نظرة عامة"},{id:"customers",label:"العملاء"},
  {id:"followups",label:"المتابعات"},{id:"inbox",label:"الوارد"},
  {id:"integrations",label:"الإضافات"}
];
const types=[
  {id:"restaurant",label:"مطعم"},{id:"cafe",label:"كافيه"},
  {id:"clothing_store",label:"محل ملابس"},{id:"clothing_factory",label:"مصنع ملابس"},
  {id:"other",label:"نشاط آخر"}
];
const stageName:Record<string,string>={new:"جديد",qualifying:"قيد التأهيل",
  qualified:"مؤهل",contacting:"تواصل",site_visit:"معاينة",proposal:"عرض سعر",won:"مكتمل",lost:"مفقود"};
const followupName:Record<string,string>={chat:"رسالة",call:"اتصال",site_visit:"معاينة"};
const fmt=(n:number)=>n.toLocaleString("ar-EG");

export default function AssistantWorkspacePanel({initialView,initialOpenLead=false,authHeaders,onClose,onPrompt}:{
  initialView:WorkspaceView;initialOpenLead?:boolean;authHeaders:()=>Promise<Record<string,string>>;
  onClose:()=>void;onPrompt:(text:string)=>void
}){
  const [view,setView]=useState<WorkspaceView>(initialView);
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [integrations,setIntegrations]=useState<IntegrationState|null>(null);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [leadDraft,setLeadDraft]=useState<LeadDraft>(initialLead);
  const [leadReview,setLeadReview]=useState(false);
  const [followupLead,setFollowupLead]=useState("");
  const [followupType,setFollowupType]=useState("call");
  const [followupReview,setFollowupReview]=useState(false);
  const [showLeadForm,setShowLeadForm]=useState(initialOpenLead);
  useEffect(()=>{if(initialOpenLead)setShowLeadForm(true);},[initialOpenLead]);
  useEffect(()=>setView(initialView),[initialView]);

  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const headers=await authHeaders();
      const [data,extras]=await Promise.all([
        fetch("/api/assistant/workspace",{headers,cache:"no-store"}),
        fetch("/api/assistant/integrations",{headers,cache:"no-store"})
      ]);
      const main=await data.json() as Snapshot&{error?:string};
      if(!data.ok)throw new Error(main.error||"تعذر قراءة مساحة العمل.");
      setSnapshot(main);
      if(extras.ok)setIntegrations(await extras.json() as IntegrationState);
      else setIntegrations(null);
    }catch(e){setError(e instanceof Error?e.message:"تعذر تحميل البيانات.");}
    finally{setLoading(false);}
  },[authHeaders]);
  useEffect(()=>{void refresh();},[refresh]);
  async function submitAction(payload:Record<string,unknown>){
    setBusy(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/assistant/workspace",{
        method:"POST",headers:await authHeaders(),body:JSON.stringify(payload)
      });
      const value=await response.json() as {error?:string;ok?:boolean;lead?:{full_name:string}};
      if(!response.ok||!value.ok)throw new Error(value.error||"لم يتم حفظ التغيير.");
      setNotice(payload.action==="create_lead"
        ?"تم تسجيل العميل في مؤسستك.":"تم إنشاء متابعة محفوظة داخل AGENT.");
      setShowLeadForm(false);setLeadReview(false);setFollowupReview(false);
      setLeadDraft(initialLead);
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:"تعذر تنفيذ الإجراء.");}
    finally{setBusy(false);}
  }
  const leadName=(id:string)=>snapshot?.leads.find(l=>l.id===id)?.full_name||"عميل";
  const disabled=busy||loading;
  return <section className="assistant-workspace-card" dir="rtl" aria-label="مساحة العمل داخل المحادثة">
    <div className="assistant-workspace-heading">
      <strong><Globe size={17}/> مساحة AGENT من المحادثة</strong>
      <div>
        <button type="button" onClick={()=>void refresh()} disabled={disabled} title="تحديث البيانات"><RefreshCw size={15}/></button>
        <button type="button" onClick={onClose} title="إغلاق مساحة العمل"><X size={16}/></button>
      </div>
    </div>
    <div className="assistant-workspace-tabs" role="group" aria-label="أقسام مساحة العمل">
      {views.map(v=><button key={v.id} type="button" aria-pressed={view===v.id}
        onClick={()=>setView(v.id)}>{v.label}</button>)}
    </div>
    {loading&&<p className="assistant-workspace-message"><LoaderCircle size={15} className="crm-spin"/> جارٍ قراءة البيانات الفعلية...</p>}
    {error&&<p className="assistant-workspace-error" role="alert">{error}</p>}
    {notice&&<p className="assistant-workspace-success" role="status"><Check size={15}/>{notice}</p>}
    {snapshot&&<div className="assistant-workspace-body">
      {view==="overview"&&<>
        <div className="assistant-workspace-metrics">
          <div><span>العملاء</span><strong>{fmt(snapshot.counts.leads)}</strong></div>
          <div><span>محادثات العملاء</span><strong>{fmt(snapshot.counts.conversations)}</strong></div>
          <div><span>متابعات معلقة</span><strong>{fmt(snapshot.counts.pending)}</strong></div>
        </div>
        <p>أرقام من قاعدة AGENT لحساب مؤسستك، وليست تقديرات من نموذج ذكاء اصطناعي.</p>
        <div className="assistant-workspace-actions">
          <button type="button" onClick={()=>setView("customers")}>مراجعة العملاء</button>
          <button type="button" onClick={()=>setView("followups")}>متابعات الفريق</button>
          <button type="button" onClick={()=>onPrompt("اعرض صفحات ومهام AGENT")}>المهام والوكلاء</button>
          <button type="button" onClick={()=>onPrompt("افحص حالة موقع AGENT")}>فحص الموقع</button>
          <button type="button" onClick={()=>onPrompt("اعرض الذاكرة والمهارات")}>الذاكرة والمهارات</button>
        </div>
      </>}
      {view==="customers"&&<>
        <div className="assistant-workspace-section-head">
          <strong><UsersRound size={16}/> آخر العملاء</strong>
          {snapshot.canWrite&&<button type="button" disabled={disabled}
            onClick={()=>{setShowLeadForm(v=>!v);setLeadReview(false);}}>
            {showLeadForm?"إغلاق النموذج":"إضافة عميل"}
          </button>}
        </div>
        {showLeadForm&&snapshot.canWrite&&<div className="assistant-workspace-form">
          <label>اسم العميل<input maxLength={100} value={leadDraft.fullName}
            onChange={e=>{setLeadDraft({...leadDraft,fullName:e.target.value});setLeadReview(false);}}/></label>
          <label>اسم النشاط<input maxLength={110} value={leadDraft.businessName}
            onChange={e=>{setLeadDraft({...leadDraft,businessName:e.target.value});setLeadReview(false);}}/></label>
          <label>الهاتف (اختياري)<input maxLength={32} dir="ltr" value={leadDraft.phone}
            onChange={e=>{setLeadDraft({...leadDraft,phone:e.target.value});setLeadReview(false);}}/></label>
          <label>نوع النشاط<select value={leadDraft.businessType}
            onChange={e=>{setLeadDraft({...leadDraft,businessType:e.target.value});setLeadReview(false);}}>
            {types.map(t=><option value={t.id} key={t.id}>{t.label}</option>)}
          </select></label>
          {!leadReview?<button type="button" disabled={disabled||leadDraft.fullName.trim().length<2}
            onClick={()=>setLeadReview(true)}>مراجعة قبل الحفظ</button>:
            <div className="assistant-workspace-confirm">
              <p>تأكيد إضافة <b>{leadDraft.fullName.trim()}</b> إلى قاعدة AGENT؟ لن تُرسل أي رسالة للعميل.</p>
              <button type="button" disabled={disabled} onClick={()=>void submitAction({
                action:"create_lead",...leadDraft})}>تأكيد حفظ العميل</button>
              <button type="button" onClick={()=>setLeadReview(false)}>إلغاء</button>
            </div>}
        </div>}
        <div className="assistant-workspace-list">
          {snapshot.leads.length? snapshot.leads.map(l=><div key={l.id}>
            <div><strong>{l.full_name}</strong><small>{l.business_name||"بدون نشاط"} · {stageName[l.stage]||l.stage}</small></div>
            <button type="button" onClick={()=>{
              setFollowupLead(l.id);setFollowupReview(false);setView("followups");
            }}>متابعة <ChevronLeft size={13}/></button>
          </div>):<p>لا توجد سجلات عملاء حتى الآن.</p>}
        </div>
        <Link href="/crm?view=leads">فتح إدارة العملاء التفصيلية</Link>
      </>}
      {view==="followups"&&<>
        <div className="assistant-workspace-section-head"><strong>المتابعات المفتوحة</strong>
          <span>{fmt(snapshot.counts.pending)} معلقة</span></div>
        {snapshot.canWrite&&<div className="assistant-workspace-form">
          <label>العميل
            <select value={followupLead} onChange={e=>{setFollowupLead(e.target.value);setFollowupReview(false);}}>
              <option value="">اختر عميلًا من القائمة</option>
              {snapshot.leads.map(l=><option key={l.id} value={l.id}>{l.full_name}</option>)}
            </select>
          </label>
          <label>نوع المتابعة<select value={followupType} onChange={e=>{setFollowupType(e.target.value);setFollowupReview(false);}}>
            {Object.entries(followupName).map(([value,label])=>
              <option key={value} value={value}>{label}</option>)}
          </select></label>
          {!followupReview?<button type="button" disabled={disabled||!followupLead}
            onClick={()=>setFollowupReview(true)}>مراجعة المتابعة</button>:
            <div className="assistant-workspace-confirm">
              <p>إنشاء مهمة {followupName[followupType]} للعميل <b>{leadName(followupLead)}</b>؟ لا إرسال خارجي.</p>
              <button type="button" disabled={disabled} onClick={()=>void submitAction({
                action:"create_handoff",leadId:followupLead,handoffType:followupType
              })}>تأكيد إنشاء المتابعة</button>
              <button type="button" onClick={()=>setFollowupReview(false)}>إلغاء</button>
            </div>}
        </div>}
        <div className="assistant-workspace-list">
          {snapshot.tasks.length?snapshot.tasks.map(t=><div key={t.id}>
            <div><strong>{leadName(t.lead_id)} · {followupName[t.handoff_type]||t.handoff_type}</strong>
              <small>{t.summary} · {t.status==="pending"?"معلقة":"قيد التنفيذ"}</small></div>
          </div>):<p>لا توجد متابعات مفتوحة.</p>}
        </div>
        <Link href="/crm?view=tasks">كل مهام المتابعة</Link>
      </>}
      {view==="inbox"&&<>
        <div className="assistant-workspace-section-head"><strong>آخر محادثات العملاء</strong>
          <span>{fmt(snapshot.counts.conversations)} إجمالًا</span></div>
        <div className="assistant-workspace-list">
          {snapshot.conversations.length?snapshot.conversations.map(t=><div key={t.id}>
            <div><strong>{leadName(t.lead_id)}</strong>
              <small>{t.channel} · {t.mode==="human"?"متابعة بشرية":"مساعد AI"}</small></div>
          </div>):<p>لا توجد محادثات عملاء محفوظة.</p>}
        </div>
        <p>المحادثات هنا للعرض فقط؛ متابعة الرسائل الخارجية تخضع لصلاحيات القنوات وحالة الربط الفعلية.</p>
        <Link href="/crm/inbox">فتح صندوق الوارد التفصيلي</Link>
      </>}
      {view==="integrations"&&<>
        <div className="assistant-workspace-section-head"><strong><PlugZap size={16}/> حالة الإضافات</strong></div>
        <p>حالة الربط للقراءة فقط هنا. توصيل المصادر وتغيير صلاحياتها من مركز الربط الواحد، ولا تُعد الخدمة متصلة قبل التفويض الفعلي.</p>
        <div className="assistant-workspace-list">
          {integrations?.connectors?.map(item=><div key={item.id}>
            <div><strong>{item.name||item.label||item.title||item.id}</strong>
              <small>{item.status} · {item.enabled?"مفعّلة":"غير مفعّلة"}</small></div>

          </div>)}
          {!integrations&&<p>تعذر قراءة مركز الإضافات حاليًا.</p>}
        </div>
        <Link href="/assistant/integrations">فتح الربط وإعداداته</Link>
      </>}
      <p className="assistant-workspace-foot"><ShieldCheck size={14}/>
        البيانات من مؤسستك المصرّح بها؛ القراءة تلقائية، والحفظ أو التغيير بتأكيد منك.</p>
    </div>}
  </section>;
}
