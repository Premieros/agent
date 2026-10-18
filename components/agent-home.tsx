"use client";

import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {Bot,ChevronLeft,ClipboardList,Inbox,LoaderCircle,MessagesSquare,
  Megaphone,PlugZap,RefreshCw,ShieldCheck,UsersRound} from "lucide-react";
import {getSupabase} from "@/lib/supabase-browser";
import {currentUser} from "@/lib/auth-session";

type Totals={leads:number|null;conversations:number|null;pending:number|null};
const sections=[
  {href:"/assistant",title:"المساعد الذكي",detail:"المحادثات والبرمجة والتحليل",icon:MessagesSquare},
  {href:"/crm?view=leads",title:"العملاء",detail:"سجلات العملاء ومراحل البيع",icon:UsersRound},
  {href:"/crm/inbox",title:"صندوق الوارد",detail:"المحادثات والمتابعات",icon:Inbox},
  {href:"/studio?section=agents",title:"الوكلاء",detail:"تشغيل الفريق ومراجعة النتائج",icon:Bot},
  {href:"/studio?section=campaigns",title:"التسويق",detail:"الحملات والمهام والتصميمات",icon:Megaphone},
  {href:"/assistant/integrations",title:"الإضافات",detail:"الاتصالات والخدمات المصرح بها",icon:PlugZap}
];
export default function AgentHome(){
  const db=getSupabase();
  const [loading,setLoading]=useState(true);
  const [signedIn,setSignedIn]=useState(false);
  const [hasAccess,setHasAccess]=useState(false);
  const [error,setError]=useState("");
  const [totals,setTotals]=useState<Totals>({leads:null,conversations:null,pending:null});
  const [updatedAt,setUpdatedAt]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    setTotals({leads:null,conversations:null,pending:null});setUpdatedAt("");
    if(!db){setError("إعدادات الاتصال بقاعدة AGENT غير متاحة.");setLoading(false);return;}
    try{
      const user=await currentUser(db);
      setSignedIn(Boolean(user));setHasAccess(false);
      if(!user){setLoading(false);return;}
      const membership=await db.from("organization_members")
        .select("organization_id").eq("user_id",user.id).limit(1).maybeSingle();
      if(membership.error)throw membership.error;
      const orgId=membership.data?.organization_id;
      if(!orgId){setError("الحساب غير مرتبط بمؤسسة. راجع صلاحياتك.");return;}
      setHasAccess(true);
      const [leads,conversations,pending]=await Promise.all([
        db.from("leads").select("id",{count:"exact",head:true}).eq("organization_id",orgId),
        db.from("conversations").select("id",{count:"exact",head:true}).eq("organization_id",orgId),
        db.from("handoff_tasks").select("id",{count:"exact",head:true})
          .eq("organization_id",orgId).eq("status","pending")
      ]);
      setTotals({
        leads:leads.error?null:leads.count??null,
        conversations:conversations.error?null:conversations.count??null,
        pending:pending.error?null:pending.count??null
      });
      if(leads.error||conversations.error||pending.error){
        setError("بعض المؤشرات غير متاحة بسبب صلاحيات القراءة أو الاتصال؛ لن تُعرض أرقام غير مؤكدة.");
      }else setUpdatedAt(new Date().toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"}));
    }catch{
      setError("تعذر قراءة البيانات الفعلية. جرّب تحديث المؤشرات أو تسجيل الدخول مجددًا.");
    }finally{setLoading(false);}
  },[db]);
  useEffect(()=>{void load();},[load]);
  const fmt=(n:number|null)=>loading?"…":n===null?"—":n.toLocaleString("ar-EG");
  return <div className="agent-home" dir="rtl">
    <header className="agent-home-heading">
      <div><span className="agent-home-eyebrow">مساحة العمل</span>
        <h1>الرئيسية</h1><p>كل أدوات AGENT في مكان واحد، بدون بيانات تجريبية.</p></div>
      <button type="button" onClick={()=>void load()} disabled={loading}>
        <RefreshCw size={15}/> تحديث البيانات
      </button>
    </header>
    {!signedIn&&!loading?<section className="agent-home-notice">
      <ShieldCheck size={19}/><div><strong>سجّل الدخول لعرض بيانات مؤسستك</strong>
      <p>المؤشرات لا تظهر إلا بعد التحقق من الحساب والصلاحيات.</p>
      <Link href="/crm?view=account">تسجيل الدخول <ChevronLeft size={15}/></Link></div>
    </section>:null}
    {signedIn&&!hasAccess&&!loading?<p className="agent-home-error" role="status">{error||"لا توجد صلاحيات لعرض مؤشرات المؤسسة."}</p>:null}
    {hasAccess&&<section className="agent-home-metrics" aria-label="مؤشرات البيانات الفعلية">
      <div><span>العملاء المسجلون</span><strong>{fmt(totals.leads)}</strong><small>إجمالي سجلات العملاء</small></div>
      <div><span>المحادثات المسجلة</span><strong>{fmt(totals.conversations)}</strong><small>إجمالي المحادثات</small></div>
      <div><span>المتابعات المعلقة</span><strong>{fmt(totals.pending)}</strong><small>المهام بحالة «معلّق»</small></div>
    </section>}
    {error&&hasAccess&&<p className="agent-home-error" role="status">{error}</p>}
    {loading&&<p className="agent-home-loading" role="status"><LoaderCircle className="crm-spin" size={17}/> جارٍ قراءة بيانات AGENT...</p>}
    {updatedAt&&<p className="agent-home-updated">بيانات فعلية من حساب مؤسستك · آخر تحديث {updatedAt}</p>}
    <section className="agent-home-sections" aria-labelledby="agent-sections-heading">
      <div className="agent-home-section-title"><h2 id="agent-sections-heading">الأقسام</h2>
      <span>اختر القسم المطلوب</span></div>
      <div className="agent-home-links">{sections.map(section=>
        <Link key={section.href} href={section.href} className="agent-home-link">
          <span className="agent-home-link-icon"><section.icon size={19}/></span>
          <span className="agent-home-link-copy"><strong>{section.title}</strong>
            <small>{section.detail}</small></span><ChevronLeft size={16} className="agent-home-arrow"/>
        </Link>
      )}</div>
    </section>
    <p className="agent-home-caption"><ClipboardList size={15}/>
      هذه الصفحة تعرض الأعداد المسموح بقراءتها فقط. إدارة السجلات من الأقسام المخصصة.</p>
  </div>;
}
