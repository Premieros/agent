"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, LogOut, Plus, RefreshCw, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase-browser";

type Member = { organization_id: string; role: string };
type Lead = { id: string; full_name: string; business_name: string | null; phone: string | null; business_type: string; source: string; stage: string; priority: string; created_at: string };
type Task = { id: string; lead_id: string; handoff_type: string; status: string; summary: string };
const types = [
  { value: "restaurant", label: "مطعم" }, { value: "cafe", label: "كافيه" },
  { value: "clothing_store", label: "متجر ملابس" }, { value: "clothing_factory", label: "مصنع ملابس" },
  { value: "other", label: "أخرى" }
];
const stages: Record<string, string> = { new: "جديد", qualifying: "تأهيل", qualified: "جاهز للمبيعات", contacting: "جارٍ التواصل", site_visit: "معاينة", proposal: "عرض سعر", won: "تم البيع", lost: "لم يتم البيع" };
const base = { full_name: "", business_name: "", phone: "", business_type: "restaurant" };

export default function LiveCrm() {
  const db = getSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [membership, setMembership] = useState<Member | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loginMode, setLoginMode] = useState<"link" | "password">("link");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [emailBlocked, setEmailBlocked] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState(base);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (activeUser: User | null) => {
    if (!db || !activeUser) { setMembership(null); setLeads([]); setTasks([]); setChecking(false); return; }
    setChecking(true);
    const { data: memberships, error: membershipError } = await db.from("organization_members").select("organization_id, role").eq("user_id", activeUser.id).limit(1);
    if (membershipError) { setError(membershipError.message); setChecking(false); return; }
    const member = (memberships?.[0] ?? null) as Member | null;
    setMembership(member);
    if (member) {
      const [l, t] = await Promise.all([
        db.from("leads").select("id,full_name,business_name,phone,business_type,source,stage,priority,created_at").eq("organization_id", member.organization_id).order("created_at", { ascending: false }).limit(100),
        db.from("handoff_tasks").select("id,lead_id,handoff_type,status,summary").eq("organization_id", member.organization_id).order("created_at", { ascending: false }).limit(100)
      ]);
      if (l.error || t.error) setError(l.error?.message || t.error?.message || "حدث خطأ في القراءة");
      else { setLeads((l.data || []) as Lead[]); setTasks((t.data || []) as Task[]); }
    }
    setChecking(false);
  }, [db]);

  useEffect(() => {
    if (!db) { setChecking(false); return; }
    let active = true;
    db.auth.getUser().then(({data}) => { if (active) {setUser(data.user); void load(data.user);} });
    const { data: listener } = db.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      // Schedule the data load outside the auth event callback.
      setTimeout(() => { if (active) void load(session?.user ?? null); }, 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [db, load]);

  async function signIn() {
    if (!db || !email.trim()) return;
    setError(""); setBusy(true);
    const { error: e } = await db.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + "/crm", shouldCreateUser: false }
    });
    setBusy(false);
    if (e) {
      if (/rate limit|too many requests|429/i.test(e.message)) {
        setEmailBlocked(true);
        setError("تم الوصول لحد إرسال رسائل Supabase. متطلبش رابط جديد دلوقتي. انتظر تجدد الحد أو استخدم كلمة مرور لو سبق تعيينها.");
      } else setError(e.message);
    } else setSent(true);
  }
  async function loginWithPassword() {
    if (!db || !email.trim() || !password) return;
    setBusy(true); setError("");
    const { error: e } = await db.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) setError("فشل تسجيل الدخول. راجع البريد وكلمة المرور. لو حسابك كان برابط البريد فقط، لازم تعيّن كلمة مرور بعد تسجيل دخول ناجح أولًا.");
    else setPassword("");
  }
  async function savePassword() {
    if (!db || !user || newPassword.length < 12 || newPassword !== confirmPassword) return;
    setBusy(true); setError("");
    const { error: e } = await db.auth.updateUser({ password: newPassword });
    setBusy(false); setNewPassword(""); setConfirmPassword("");
    if (e) setError("تعذر حفظ كلمة المرور: " + e.message);
    else { setPasswordSaved(true); setShowPasswordSetup(false); }
  }
  async function createLead() {
    if (!db || !membership || !form.full_name.trim()) return;
    setError(""); setBusy(true);
    const { error: e } = await db.from("leads").insert({
      organization_id: membership.organization_id,
      full_name: form.full_name.trim(),
      business_name: form.business_name.trim() || null,
      phone: form.phone.trim() || null,
      business_type: form.business_type,
      source: "manual", stage: "new", priority: "warm"
    });
    setBusy(false);
    if (e) setError(e.message);
    else { setShowForm(false); setForm(base); await load(user); }
  }
  async function createHandoff(lead: Lead, handoff_type: "chat" | "call") {
    if (!db || !membership) return;
    setBusy(true); setError("");
    const { error: e } = await db.from("handoff_tasks").insert({
      organization_id: membership.organization_id, lead_id: lead.id, handoff_type,
      summary: handoff_type === "call" ? "طلب الاتصال بالعميل لتحديد احتياجاته وترتيب معاينة." : "متابعة العميل كتابةً بواسطة موظف المبيعات."
    });
    setBusy(false);
    if (e) setError(e.message); else await load(user);
  }

  return <div className="crm-root">
    <div className="crm-wrap">
      <header className="crm-header"><div><strong>AGENT</strong><span> · إدارة المبيعات الفعلية</span></div><div className="crm-actions"><Link href="/crm/inbox">مركز المحادثات الفعلي</Link><Link href="/"><ArrowRight size={17}/> الواجهة التجريبية</Link>{user && <button onClick={async () => {await db?.auth.signOut();setUser(null);setMembership(null);}}>خروج <LogOut size={15}/></button>}</div></header>
      <div className="crm-title"><div><span className="crm-overline">Sales CRM</span><h1>إدارة العملاء والمتابعة</h1><p>حسابات منفصلة وصلاحيات محمية وتخزين فعلي على Supabase.</p></div><span className="crm-status"><ShieldCheck size={15}/> بيانات فعلية</span></div>
      {error && <p className="crm-error" role="alert">{error}</p>}
      {!db && <div className="crm-card"><h2>ربط قاعدة البيانات غير مكتمل</h2><p>الموقع يحتاج متغيرات الاتصال العامة في إعدادات الاستضافة.</p></div>}
      {db && checking && <div className="crm-card"><LoaderCircle size={21} className="crm-spin"/> جارٍ التحقق من الجلسة والصلاحيات...</div>}
      {db && !checking && !user && <div className="crm-card crm-login">
        <h2>تسجيل دخول آمن</h2>
        <p>استخدم كلمة المرور لو سبق تعيينها، أو اطلب رابط بريد. إنشاء الحساب وحده لا يعطي صلاحية الاطلاع على العملاء.</p>
        <div className="crm-login-tabs" role="group" aria-label="طريقة الدخول">
          <button type="button" className={loginMode === "link" ? "selected" : ""} onClick={() => { setLoginMode("link"); setError(""); }}>رابط البريد</button>
          <button type="button" className={loginMode === "password" ? "selected" : ""} onClick={() => { setLoginMode("password"); setError(""); }}>كلمة المرور</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); void (loginMode === "password" ? loginWithPassword() : signIn()); }}>
          <label htmlFor="crm-email">البريد الإلكتروني</label>
          <input id="crm-email" type="email" autoComplete="email" required placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          {loginMode === "password" ? <>
            <label htmlFor="crm-password">كلمة المرور</label>
            <input id="crm-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
            <button disabled={busy || !password}>دخول بكلمة المرور</button>
            <small className="crm-help-text">لازم تكون عيّنت كلمة مرور من داخل حسابك بعد تسجيل دخول ناجح سابقًا.</small>
          </> : sent ? <p className="crm-success"><CheckCircle2 size={16}/> تم طلب إرسال الرابط. راجع بريدك الإلكتروني.</p> : <>
            <button disabled={busy || emailBlocked}>إرسال رابط الدخول</button>
            {emailBlocked && <p className="crm-help-text">تم إيقاف طلب روابط إضافية في هذه الصفحة بسبب حد الإرسال. جرّب لاحقًا بعد تجدد الحد.</p>}
          </>}
        </form>
      </div>}
      {db && !checking && user && !membership && <div className="crm-card"><h2>حسابك جاهز، وينتظر إضافتك للفريق</h2><p>البريد: <b dir="ltr">{user.email}</b></p><p>مسؤول النظام لازم يضيف حسابك لعضوية الشركة. ده إجراء مقصود لحماية العملاء والمحادثات، ومش هنسمح لحساب غير معتمد يشوف أي بيانات.</p><button className="crm-btn-secondary" onClick={()=>void load(user)}>إعادة فحص العضوية <RefreshCw size={15}/></button></div>}
      {db && !checking && membership && user && <>
        <section className="crm-card crm-password-panel">
          <div className="crm-section-head"><div><h2>تسجيل الدخول بكلمة مرور</h2><p>عيّن كلمة مرور مرة واحدة، علشان متحتاجش رسالة بريد في كل دخول.</p></div>
          <button type="button" onClick={() => setShowPasswordSetup(v => !v)}>{showPasswordSetup ? "إلغاء" : "تعيين / تغيير كلمة المرور"}</button></div>
          {passwordSaved && <p className="crm-success"><CheckCircle2 size={16}/> تم حفظ كلمة المرور. يمكنك استخدامها عند تسجيل الدخول لاحقًا.</p>}
          {showPasswordSetup && <form className="crm-password-form" onSubmit={e => { e.preventDefault(); void savePassword(); }}>
            <label>كلمة مرور جديدة<input type="password" minLength={12} required autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
            <label>تأكيد كلمة المرور<input type="password" minLength={12} required autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>
            <button disabled={busy || newPassword.length < 12 || newPassword !== confirmPassword}>حفظ كلمة المرور</button>
            <p className="crm-help-text">اختر كلمة مرور قوية من 12 حرفًا على الأقل. لا تشاركها مع أي شخص.</p>
          </form>}
        </section>
        <div className="crm-metrics"><div><span>العملاء المسجلون</span><strong>{leads.length}</strong></div><div><span>مهام المتابعة</span><strong>{tasks.filter(t=>t.status==="pending").length}</strong></div><div><span>صلاحيتك</span><strong className="crm-role">{membership.role}</strong></div></div>
        <section className="crm-card"><div className="crm-section-head"><div><h2><UsersRound size={19}/> العملاء المحتملون</h2><p>معلومات حقيقية محفوظة في قاعدة البيانات</p></div><button onClick={()=>setShowForm(v=>!v)}><Plus size={17}/> إضافة عميل</button></div>
        {showForm && <form className="crm-form" onSubmit={e=>{e.preventDefault();void createLead();}}><label>اسم العميل<input required maxLength={180} value={form.full_name} onChange={e=>setForm(v=>({...v,full_name:e.target.value}))}/></label><label>اسم النشاط<input maxLength={180} value={form.business_name} onChange={e=>setForm(v=>({...v,business_name:e.target.value}))}/></label><label>رقم التواصل<input maxLength={40} value={form.phone} onChange={e=>setForm(v=>({...v,phone:e.target.value}))}/></label><label>نوع النشاط<select value={form.business_type} onChange={e=>setForm(v=>({...v,business_type:e.target.value}))}>{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label><button disabled={busy || !form.full_name.trim()}>حفظ العميل</button></form>}
        {leads.length===0?<div className="crm-empty">لسه مفيش عملاء مسجلين. أضف أول عميل من الزر بالأعلى.</div>:<div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>العميل</th><th>النشاط</th><th>الهاتف</th><th>المرحلة</th><th>التسليم للموظف</th></tr></thead><tbody>{leads.map(lead=><tr key={lead.id}><td><strong>{lead.full_name}</strong><small>{lead.business_name || "—"}</small></td><td>{types.find(t=>t.value===lead.business_type)?.label || lead.business_type}</td><td dir="ltr">{lead.phone||"—"}</td><td>{stages[lead.stage]||lead.stage}</td><td><div className="crm-row-actions"><button disabled={busy} onClick={()=>void createHandoff(lead,"chat")}>شات</button><button disabled={busy} onClick={()=>void createHandoff(lead,"call")}>اتصال</button></div></td></tr>)}</tbody></table></div>}
        </section>
        <section className="crm-card crm-tasks"><div className="crm-section-head"><div><h2>مهام تسليم العملاء</h2><p>مهام محفوظة فعليًا — الاتصال أو استكمال المحادثة</p></div></div>{tasks.length===0?<div className="crm-empty">مافيش مهام متابعة حتى الآن.</div>:tasks.map(t=><div className="crm-task" key={t.id}><span className="crm-task-kind">{t.handoff_type==="call"?"اتصال تليفوني":t.handoff_type==="chat"?"استكمال شات":"معاينة"}</span><span>{leads.find(l=>l.id===t.lead_id)?.full_name||"عميل"}</span><span>{t.summary}</span><small>{t.status==="pending"?"بانتظار الموظف":t.status}</small></div>)}</section>
      </>}
    </div>
  </div>;
}
