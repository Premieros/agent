"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, CircleAlert, ClipboardList, Inbox, LoaderCircle, MessageCircle, Phone, Plus, RefreshCw, Search, Send, ShieldCheck, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase-browser";

type Member = { organization_id: string; role: string };
type Lead = { id: string; full_name: string; business_name: string | null; phone: string | null; stage: string; source: string };
type Thread = { id: string; organization_id: string; lead_id: string; channel: string; mode: string; assigned_to: string | null; last_message_at: string | null; created_at: string };
type Message = { id: string; direction: string; author_type: string; body: string; created_at: string };
type Task = { id: string; lead_id: string; conversation_id: string | null; handoff_type: string; status: string; summary: string; created_at: string };
const channelLabels: Record<string, string> = { manual: "متابعة داخلية", whatsapp: "واتساب", messenger: "ماسنجر", facebook_comment: "تعليق فيسبوك" };
const taskLabels: Record<string, string> = { chat: "متابعة شات", call: "اتصال هاتفي", site_visit: "معاينة" };
const roleLabels: Record<string, string> = { admin: "مدير النظام", manager: "مدير", sales: "المبيعات", engineer: "فني" };
const dateLabel = (value: string) => new Date(value).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });

export default function LiveInbox() {
  const db = getSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [note, setNote] = useState("");
  const [leadId, setLeadId] = useState("");
  const [filter, setFilter] = useState("");
  const [channelView,setChannelView]=useState("all");
  useEffect(()=>{
    const sync=()=>setChannelView(new URLSearchParams(window.location.search).get("channel")||"all");
    const select=(event:Event)=>setChannelView((event as CustomEvent<string>).detail||"all");
    sync();
    window.addEventListener("popstate",sync);
    window.addEventListener("agent:select-inbox-channel",select);
    return()=>{window.removeEventListener("popstate",sync);window.removeEventListener("agent:select-inbox-channel",select);};
  },[]);
  const [showNew, setShowNew] = useState(false);

  const loadWorkspace = useCallback(async (activeUser: User | null) => {
    if (!db || !activeUser) {
      setMember(null); setThreads([]); setLeads([]); setTasks([]); setSelectedId(null); setLoading(false);
      return;
    }
    setLoading(true);
    const { data: memberships, error: memberError } = await db.from("organization_members")
      .select("organization_id,role").eq("user_id", activeUser.id).limit(1);
    if (memberError) {
      setError(memberError.message); setLoading(false); return;
    }
    const currentMember = (memberships?.[0] || null) as Member | null;
    setMember(currentMember);
    if (!currentMember) { setThreads([]); setLeads([]); setTasks([]); setLoading(false); return; }
    const orgId = currentMember.organization_id;
    const [threadsResult, leadsResult, tasksResult] = await Promise.all([
      db.from("conversations").select("id,organization_id,lead_id,channel,mode,assigned_to,last_message_at,created_at")
        .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(150),
      db.from("leads").select("id,full_name,business_name,phone,stage,source")
        .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(300),
      db.from("handoff_tasks").select("id,lead_id,conversation_id,handoff_type,status,summary,created_at")
        .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(150)
    ]);
    const failure = threadsResult.error || leadsResult.error || tasksResult.error;
    if (failure) setError(failure.message);
    else {
      const threadRows = (threadsResult.data || []) as Thread[];
      setThreads(threadRows);
      setLeads((leadsResult.data || []) as Lead[]);
      setTasks((tasksResult.data || []) as Task[]);
      setSelectedId(previous => previous && threadRows.some(t => t.id === previous) ? previous : (threadRows[0]?.id || null));
    }
    setLoading(false);
  }, [db]);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    let mounted = true;
    void db.auth.getUser().then(({ data }) => {
      if (mounted) { setUser(data.user); void loadWorkspace(data.user); }
    });
    const { data: listener } = db.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user || null);
      setTimeout(() => { if (mounted) void loadWorkspace(session?.user || null); }, 0);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [db, loadWorkspace]);

  const loadMessages = useCallback(async (threadId: string, orgId: string) => {
    if (!db) return;
    setLoadingMessages(true);
    const { data, error: e } = await db.from("messages")
      .select("id,direction,author_type,body,created_at")
      .eq("organization_id", orgId).eq("conversation_id", threadId)
      .order("created_at", { ascending: true }).limit(200);
    if (e) setError(e.message);
    else setMessages((data || []) as Message[]);
    setLoadingMessages(false);
  }, [db]);

  useEffect(() => {
    if (member && selectedId) void loadMessages(selectedId, member.organization_id);
    else setMessages([]);
  }, [member, selectedId, loadMessages]);

  const leadById = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads]);
  const selectedThread = threads.find(t => t.id === selectedId) || null;
  const selectedLead = selectedThread ? leadById.get(selectedThread.lead_id) : null;
  const selectedTasks = tasks.filter(t => t.conversation_id === selectedId);
  const filteredThreads = threads.filter(t => {
    if(channelView!=="all"&&t.channel!==channelView)return false;
    const lead = leadById.get(t.lead_id);
    const needle = filter.trim().toLocaleLowerCase();
    return !needle || [lead?.full_name, lead?.business_name, lead?.phone, channelLabels[t.channel]]
      .some(v => v?.toLocaleLowerCase().includes(needle));
  });

  async function createThread() {
    if (!db || !leadId || !user) return;
    setBusy(true); setError(""); setNotice("");
    const { data, error: e } = await db.rpc("create_internal_thread", { p_lead_id: leadId });
    if (e) setError(e.message);
    else {
      setSelectedId(data as string); setShowNew(false); setLeadId("");
      setNotice("تم فتح متابعة داخلية للعميل. لا يوجد إرسال تلقائي لأي قناة خارجية.");
      await loadWorkspace(user);
    }
    setBusy(false);
  }
  async function addNote() {
    if (!db || !selectedThread || !member || !note.trim()) return;
    setBusy(true); setError(""); setNotice("");
    const { error: e } = await db.rpc("add_internal_note", { p_conversation_id: selectedThread.id, p_body: note.trim() });
    if (e) setError(e.message);
    else {
      setNote(""); setNotice("تم حفظ الملاحظة داخليًا فقط، ولم تُرسل للعميل.");
      await loadMessages(selectedThread.id, member.organization_id);
    }
    setBusy(false);
  }
  async function handoff(kind: "chat" | "call") {
    if (!db || !selectedThread || !user) return;
    setBusy(true); setError(""); setNotice("");
    const { error: e } = await db.rpc("takeover_conversation", {
      p_conversation_id: selectedThread.id, p_handoff_type: kind,
      p_summary: kind === "call" ? "الاتصال بالعميل لتأكيد متطلباته." : "متابعة المحادثة بواسطة موظف مبيعات."
    });
    if (e) setError(e.message);
    else {
      setNotice("تم تحويل المحادثة للوضع البشري وإنشاء مهمة متابعة أو استرجاع المهمة المفتوحة.");
      await loadWorkspace(user);
    }
    setBusy(false);
  }
  async function finishTask(task: Task) {
    if (!db || !member || !user) return;
    setBusy(true); setError(""); setNotice("");
    const { error: e } = await db.from("handoff_tasks").update({ status: "completed" })
      .eq("organization_id", member.organization_id).eq("id", task.id);
    if (e) setError(e.message);
    else { setNotice("تم إكمال المهمة."); await loadWorkspace(user); }
    setBusy(false);
  }

  return <div className="crm-root live-inbox">
    <div className="crm-wrap">
      <header className="crm-header"><div><strong>AGENT</strong><span> · مركز المحادثات</span></div>
        <div className="crm-actions"><Link href="/studio">مدير الوكلاء</Link><Link href="/crm"><ArrowRight size={17}/> إدارة العملاء</Link><Link href="/">الواجهة التجريبية</Link></div>
      </header>
      <div className="crm-title"><div><span className="crm-overline">Team Inbox</span><h1>{channelView==="manual"?"المتابعات الداخلية":"صندوق الوارد"}</h1><p>متابعة فعلية محفوظة على Supabase، مع فصل الملاحظات الداخلية عن الرسائل المرسلة للعملاء.</p></div><span className="crm-status"><ShieldCheck size={15}/> بيانات محمية</span></div>
      <div className="inbox-safety"><CircleAlert size={18}/><span>واتساب وماسنجر لم يتم ربطهما بعد. أي ملاحظة تكتبها هنا <b>داخلية فقط</b> ولن تُرسل لأي عميل.</span></div>
      {error && <div className="crm-error" role="alert">{error}<button type="button" onClick={()=>setError("")}>إغلاق</button></div>}
      {notice && <div className="crm-success inbox-notice" role="status"><CheckCircle2 size={16}/>{notice}<button type="button" onClick={()=>setNotice("")}>×</button></div>}
      {!db && <div className="crm-card">لم تكتمل إعدادات الربط مع Supabase.</div>}
      {db && loading && <div className="crm-card"><LoaderCircle className="crm-spin" size={19}/> جارٍ تحميل المحادثات...</div>}
      {db && !loading && !user && <div className="crm-card inbox-gate"><h2>يلزم تسجيل الدخول</h2><p>سجّل الدخول أولًا من صفحة إدارة المبيعات، ثم ارجع لمركز المحادثات.</p><Link href="/crm">الذهاب إلى تسجيل الدخول</Link></div>}
      {db && !loading && user && !member && <div className="crm-card inbox-gate"><h2>حسابك ليس له عضوية مفعلة</h2><p>لا يمكنك رؤية محادثات الشركات بدون صلاحية.</p></div>}
      {db && !loading && member && <>
        <div className="inbox-toolbar">
          <span><Inbox size={17}/> {threads.length} متابعة / محادثة</span>
          <span>{roleLabels[member.role] || member.role}</span>
          <button type="button" onClick={() => { setError(""); void loadWorkspace(user); }}><RefreshCw size={15}/> تحديث</button>
          {member.role !== "engineer" && <button type="button" className="inbox-create" onClick={() => setShowNew(v => !v)}><Plus size={16}/> متابعة داخلية جديدة</button>}
        </div>
        {showNew && <form className="inbox-new-form" onSubmit={e => { e.preventDefault(); void createThread(); }}>
          <label htmlFor="internal-lead">اختار العميل</label>
          <select id="internal-lead" required value={leadId} onChange={e => setLeadId(e.target.value)}>
            <option value="">— اختر من العملاء المسجلين —</option>
            {leads.map(l => <option key={l.id} value={l.id}>{l.full_name}{l.business_name ? " — " + l.business_name : ""}</option>)}
          </select>
          <button disabled={busy || !leadId}>فتح متابعة داخلية</button>
          {leads.length===0 && <p>مفيش عملاء حاليًا. <Link href="/crm">أضف عميلًا أولًا</Link>.</p>}
        </form>}
        <div className="live-inbox-grid">
          <aside className="inbox-threads-panel">
            <div className="inbox-panel-header"><h2>المحادثات</h2><span>{filteredThreads.length}</span></div>
            <label className="inbox-search"><Search size={15}/><input aria-label="بحث عن عميل" placeholder="بحث بالاسم أو الرقم" value={filter} onChange={e => setFilter(e.target.value)}/></label>
            <div className="inbox-thread-list">
              {filteredThreads.length === 0 ? <p className="inbox-empty">لا توجد محادثات مطابقة. ابدأ متابعة داخلية من الزر بالأعلى.</p> : filteredThreads.map(t => {
                const lead = leadById.get(t.lead_id);
                return <button key={t.id} type="button" className={"inbox-thread-entry "+(selectedId===t.id?"active":"")} onClick={()=>setSelectedId(t.id)}>
                  <span className="inbox-avatar">{(lead?.full_name||"؟").slice(0,1)}</span>
                  <span className="inbox-thread-meta"><strong>{lead?.full_name || "عميل"}</strong><small>{channelLabels[t.channel] || t.channel} · {t.mode==="human"?"بشري":"AI"}</small></span>
                  <span className="inbox-thread-time">{dateLabel(t.last_message_at || t.created_at)}</span>
                </button>;
              })}
            </div>
          </aside>
          <section className="inbox-chat-panel">
            {!selectedThread ? <div className="inbox-main-empty"><MessageCircle size={30}/><h2>اختار محادثة للعرض</h2><p>ابدأ بمتابعة داخلية بعد إضافة عميل من صفحة CRM.</p></div> : <>
              <div className="inbox-chat-head"><span className="inbox-avatar">{(selectedLead?.full_name||"؟").slice(0,1)}</span>
                <div><strong>{selectedLead?.full_name || "عميل"}</strong><p>{channelLabels[selectedThread.channel] || selectedThread.channel} · {selectedLead?.business_name || "بدون نشاط مسجل"}</p></div>
                <span className={"inbox-mode "+(selectedThread.mode==="human"?"human":"ai")}>{selectedThread.mode==="human"?<UserRound size={13}/>:<Bot size={13}/>} {selectedThread.mode==="human"?"الموظف":"AI"}</span>
              </div>
              <div className="inbox-message-list" aria-live="polite">
                {loadingMessages ? <p className="inbox-empty">جارٍ جلب الرسائل...</p> :
                  messages.length===0 ? <p className="inbox-empty">لا توجد رسائل مسجلة في هذه المتابعة. يمكنك إضافة ملاحظة داخلية أدناه.</p> :
                  messages.map(m=><article key={m.id} className={"inbox-message "+(m.direction==="internal"?"internal":m.direction)}>
                    <div><strong>{m.direction==="internal"?"ملاحظة داخلية":m.author_type==="customer"?"رسالة عميل":m.author_type==="ai"?"رد الأيجنت":"رسالة محفوظة"}</strong><small>{dateLabel(m.created_at)}</small></div><p>{m.body}</p>
                  </article>)}
              </div>
              <form className="inbox-note-compose" onSubmit={e=>{e.preventDefault();void addNote();}}>
                <label htmlFor="inbox-note-text">ملاحظة داخلية — لا تُرسل لأي قناة</label>
                <div><textarea id="inbox-note-text" rows={2} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="تفاصيل مكالمة، متطلبات العميل، الخطوة القادمة..." disabled={busy || member.role==="engineer"}/><button disabled={busy || !note.trim() || member.role==="engineer"} title="حفظ الملاحظة الداخلية"><Send size={18}/> حفظ</button></div>
              </form>
            </>}
          </section>
          <aside className="inbox-details-panel">
            <h2>العميل والتسليم</h2>
            {!selectedThread ? <p className="inbox-empty">اختار محادثة لعرض تفاصيل العميل.</p> : <>
              <div className="inbox-detail-row"><span>اسم العميل</span><b>{selectedLead?.full_name || "—"}</b></div>
              <div className="inbox-detail-row"><span>الهاتف</span><b dir="ltr">{selectedLead?.phone || "—"}</b></div>
              <div className="inbox-detail-row"><span>المصدر</span><b>{channelLabels[selectedThread.channel] || selectedThread.channel}</b></div>
              <div className="inbox-detail-row"><span>وضع المحادثة</span><b>{selectedThread.mode==="human"?"متابعة بشرية":"الأيجنت"}</b></div>
              {member.role!=="engineer" && <div className="inbox-takeover">
                <h3>تسليم للموظف</h3><p>توقّف ردود AI على هذه المحادثة في قاعدة البيانات، وسجّل مهمة للفريق.</p>
                <button type="button" onClick={()=>void handoff("chat")} disabled={busy}><MessageCircle size={15}/> متابعة شات</button>
                <button type="button" onClick={()=>void handoff("call")} disabled={busy}><Phone size={15}/> مهمة اتصال</button>
              </div>}
              <h3 className="inbox-task-title"><ClipboardList size={15}/> مهام المحادثة</h3>
              {selectedTasks.length===0 ? <p className="inbox-empty">لا توجد مهام لهذا الشات.</p> :
                selectedTasks.map(t=><div className="inbox-task-row" key={t.id}><div><b>{taskLabels[t.handoff_type]||t.handoff_type}</b><span>{t.status==="completed"?"مكتملة":t.status==="pending"?"بانتظار التنفيذ":t.status}</span></div><p>{t.summary || "متابعة العميل"}</p>{t.status!=="completed" && t.status!=="cancelled" && member.role!=="engineer" && <button type="button" disabled={busy} onClick={()=>void finishTask(t)}><CheckCircle2 size={13}/> إنهاء المهمة</button>}</div>)}
            </>}
          </aside>
        </div>
      </>}
    </div>
  </div>;
}
