"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowLeft, ArrowUpLeft, Bot, CheckCircle2, ChevronLeft, ClipboardList,
  Clock3, Factory, Headphones, Inbox, LayoutDashboard, Menu, MessageCircle,
  MessageSquareText, PhoneCall, Search, Send, ShieldCheck, Sparkles, Store,
  UsersRound, X
} from "lucide-react";
import {
  channelLabels, priorityLabels, sampleConversations, sampleLeads, stageLabels,
  type Channel, type Conversation, type HandoffType, type Lead, type Stage
} from "@/lib/demo";

type View = "dashboard" | "inbox" | "leads" | "agent";
type InboxFilter = "all" | "ai" | "human";
const navItems = [
  { id: "dashboard" as View, title: "نظرة عامة", icon: LayoutDashboard },
  { id: "inbox" as View, title: "مركز المحادثات", icon: Inbox },
  { id: "leads" as View, title: "العملاء المحتملون", icon: UsersRound },
  { id: "agent" as View, title: "مركز الأيجنت", icon: Bot }
];

const pageTitle: Record<View, string> = {
  dashboard: "نظرة عامة", inbox: "مركز المحادثات", leads: "العملاء المحتملون", agent: "مركز الأيجنت"
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(part => part.charAt(0)).join("");
}
function ChannelIcon({ channel }: { channel: Channel }) {
  return channel === "whatsapp" ? <MessageCircle size={14} /> : <MessageSquareText size={14} />;
}
function PriorityBadge({ lead }: { lead: Lead }) {
  return <span className={`tag tag-${lead.priority}`}><span className="tag-dot" />{priorityLabels[lead.priority]}</span>;
}
function StageBadge({ stage }: { stage: Stage }) {
  return <span className="stage-badge">{stageLabels[stage]}</span>;
}

export default function SalesWorkspace() {
  const [view, setView] = useState<View>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [leads, setLeads] = useState<Lead[]>(sampleLeads);
  const [conversations, setConversations] = useState<Conversation[]>(sampleConversations);
  const [selectedId, setSelectedId] = useState("thread-1");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");

  const selectedConversation = conversations.find(thread => thread.id === selectedId);
  const selectedLead = leads.find(lead => lead.id === selectedConversation?.leadId);
  const hotCount = leads.filter(lead => lead.priority === "hot").length;
  const humanCount = conversations.filter(thread => thread.mode === "human").length;
  const unreadCount = conversations.reduce((n, thread) => n + thread.unread, 0);

  const visibleConversations = useMemo(() => conversations.filter(thread => {
    const lead = leads.find(item => item.id === thread.leadId);
    const query = search.trim().toLowerCase();
    return (!query || [lead?.name, lead?.businessName, lead?.businessType].some(value => value?.toLowerCase().includes(query)))
      && (filter === "all" || thread.mode === filter);
  }), [conversations, leads, filter, search]);

  const openView = (next: View) => { setView(next); setMobileMenu(false); setNotice(""); };
  const openLead = (id: string) => {
    const thread = conversations.find(item => item.leadId === id);
    if (thread) {
      setSelectedId(thread.id);
      setConversations(prev => prev.map(item => item.id === thread.id ? {...item, unread: 0} : item));
      openView("inbox");
    }
  };
  const openThread = (id: string) => {
    setSelectedId(id); setDraft("");
    setConversations(prev => prev.map(item => item.id === id ? {...item, unread: 0} : item));
    setNotice("");
  };
  const handoff = (type: Exclude<HandoffType, null>) => {
    if (!selectedConversation || !selectedLead) return;
    setConversations(prev => prev.map(item => item.id === selectedId
      ? {...item, mode: "human", handoff: type, unread: 0}
      : item));
    setLeads(prev => prev.map(item => item.id === selectedLead.id
      ? {...item, stage: "contacting" as Stage} : item));
    setNotice(type === "call"
      ? "تم إنشاء مهمة اتصال تجريبية وتسليم العميل لفريق المبيعات."
      : "تم نقل المحادثة للموظف وإيقاف الأيجنت عنها في النسخة التجريبية.");
  };
  const returnToAgent = () => {
    setConversations(prev => prev.map(item => item.id === selectedId
      ? {...item, mode: "ai", handoff: null} : item));
    setNotice("تمت إعادة المحادثة لوضع الأيجنت التجريبي.");
  };
  const sendMessage = () => {
    if (!draft.trim() || !selectedConversation || selectedConversation.mode !== "human") return;
    const body = draft.trim();
    setConversations(prev => prev.map(thread => thread.id !== selectedId ? thread : {
      ...thread,
      messages: [...thread.messages, {
        id: `draft-${Date.now()}`, author: "employee" as const, body,
        time: new Date().toLocaleTimeString("ar-EG", {hour: "numeric", minute: "2-digit"})
      }]
    }));
    setDraft("");
    setNotice("رسالة تجريبية فقط — لم يتم إرسالها إلى واتساب أو ماسنجر.");
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><Sparkles size={23} /></div>
          <div><strong>AGENT</strong><span>AI Sales Workspace</span></div>
          <button className="icon-button mobile-close" aria-label="إغلاق القائمة" onClick={() => setMobileMenu(false)}><X size={19}/></button>
        </div>
        <div className="sidebar-label">مساحة العمل</div>
        <nav aria-label="القائمة الرئيسية" className="side-nav">
          {navItems.map(item => <button key={item.id} className={`side-link ${view === item.id ? "active" : ""}`} onClick={() => openView(item.id)}>
            <item.icon size={19}/><span>{item.title}</span>{item.id === "inbox" && unreadCount > 0 && <b className="nav-count">{unreadCount}</b>}
          </button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><ShieldCheck size={20} /><div><strong>بيئة تجريبية آمنة</strong><p>لا توجد رسائل أو إعلانات فعلية</p></div></div>
          <div className="sidebar-profile"><div className="profile-avatar">PM</div><div><strong>إدارة المبيعات</strong><span>لوحة التحكم</span></div><span className="online-dot" /></div>
        </div>
      </aside>
      {mobileMenu && <button className="mobile-overlay" aria-label="إغلاق القائمة" onClick={() => setMobileMenu(false)} />}
      <div className="main-layout">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <button className="icon-button mobile-menu" aria-label="فتح القائمة" onClick={() => setMobileMenu(true)}><Menu size={22}/></button>
            <span>مساحة العمل</span><ChevronLeft size={15}/><strong>{pageTitle[view]}</strong>
          </div>
          <div className="topbar-right"><Link href="/studio" className="live-crm-link">مدير الوكلاء</Link><Link href="/crm" className="live-crm-link">الدخول إلى CRM الفعلي</Link><span className="demo-pill"><span /> وضع تجريبي</span><div className="profile-avatar top-avatar">PM</div></div>
        </header>
        <main className="main-content">
          {notice && <div className="notice" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="إغلاق الإشعار"><X size={16}/></button></div>}

          {view === "dashboard" && <>
            <div className="page-head"><div><p className="eyebrow">مركز القيادة</p><h1>صباح الشغل الذكي <span className="sparkle">✦</span></h1><p>كل فرص البيع والمحادثات في مكان واحد — بيانات توضيحية للواجهة.</p></div><button className="primary-btn" onClick={() => openView("inbox")}>افتح المحادثات <ArrowLeft size={17}/></button></div>
            <div className="stat-grid">
              <div className="stat-card"><div className="stat-icon green"><UsersRound size={21}/></div><span>إجمالي العملاء</span><strong>{leads.length}</strong><small>عملاء في نسخة العرض</small></div>
              <div className="stat-card"><div className="stat-icon orange"><Activity size={21}/></div><span>فرص جاهزة للتواصل</span><strong>{hotCount}</strong><small>أولوية عالية</small></div>
              <div className="stat-card"><div className="stat-icon purple"><Headphones size={21}/></div><span>تسليم للموظفين</span><strong>{humanCount}</strong><small>تواصل بشري مفعل</small></div>
              <div className="stat-card"><div className="stat-icon blue"><MessageCircle size={21}/></div><span>رسائل غير مقروءة</span><strong>{unreadCount}</strong><small>عبر قنوات المحادثة</small></div>
            </div>
            <div className="dashboard-grid">
              <section className="surface-card featured-panel">
                <div className="section-heading"><div><h2>العملاء الجاهزون للمتابعة</h2><p>ابدأ بالأعلى أولوية لتسريع التواصل</p></div><button className="link-btn" onClick={() => openView("leads")}>عرض الكل <ArrowLeft size={15}/></button></div>
                {leads.filter(lead => lead.priority === "hot").map(lead => <button key={lead.id} className="priority-lead" onClick={() => openLead(lead.id)}><div className="round-avatar">{initials(lead.name)}</div><div className="priority-lead-info"><strong>{lead.businessName}</strong><span>{lead.name} · {lead.businessType} · {lead.city}</span></div><PriorityBadge lead={lead}/><ChevronLeft size={17} className="muted" /></button>)}
              </section>
              <section className="surface-card status-panel">
                <div className="section-heading"><div><h2>حالة تجهيز النظام</h2><p>منظومة جاهزة للتطوير تدريجيًا</p></div><Sparkles size={21} className="green-text" /></div>
                <div className="setup-row"><CheckCircle2 size={18} className="green-text"/><span>واجهة ويب تفاعلية</span><b className="setup-done">تجريبية</b></div>
                <div className="setup-row"><Clock3 size={18} className="amber-text"/><span>ربط قاعدة البيانات</span><b>بانتظار الصلاحية</b></div>
                <div className="setup-row"><Clock3 size={18} className="amber-text"/><span>واتساب وماسنجر</span><b>بانتظار الربط</b></div>
                <div className="setup-row"><Clock3 size={18} className="amber-text"/><span>أيجنت المبيعات</span><b>مرحلة لاحقة</b></div>
                <button className="secondary-btn full-width" onClick={() => openView("agent")}>اعرف طريقة عمل الأيجنت <ArrowLeft size={17}/></button>
              </section>
            </div>
            <section className="surface-card overview-table">
              <div className="section-heading"><div><h2>آخر المحادثات</h2><p>اطّلع على العملاء الذين يحتاجون اهتمامًا</p></div><button className="link-btn" onClick={() => openView("inbox")}>مركز المحادثات <ArrowLeft size={15}/></button></div>
              <div className="table-scroll"><table><thead><tr><th>العميل</th><th>النشاط</th><th>القناة</th><th>الأولوية</th><th>الحالة</th><th></th></tr></thead><tbody>
                {leads.map(lead => <tr key={lead.id}><td><b>{lead.businessName}</b><span className="cell-subtitle">{lead.name}</span></td><td>{lead.businessType}</td><td><span className="channel-inline"><ChannelIcon channel={lead.source}/>{channelLabels[lead.source]}</span></td><td><PriorityBadge lead={lead}/></td><td><StageBadge stage={lead.stage}/></td><td><button className="table-action" onClick={() => openLead(lead.id)} aria-label={`فتح محادثة ${lead.name}`}><ArrowUpLeft size={17}/></button></td></tr>)}
              </tbody></table></div>
            </section>
          </>}

          {view === "inbox" && <>
            <div className="page-head compact"><div><p className="eyebrow">مركز التواصل الموحد</p><h1>صندوق المحادثات</h1><p>أكمل شات العميل أو جهز اتصالًا هاتفيًا لفريق المبيعات.</p></div><span className="demo-caption">كل المحادثات هنا للعرض فقط</span></div>
            <div className="inbox-grid">
              <section className="surface-card thread-list-pane">
                <div className="pane-heading"><h2>المحادثات <span>{visibleConversations.length}</span></h2></div>
                <div className="search-box"><Search size={17}/><input aria-label="بحث في المحادثات" value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث عن عميل أو نشاط..." /></div>
                <div className="filter-row">{([{id:"all",title:"الكل"},{id:"ai",title:"الأيجنت"},{id:"human",title:"الموظف"}] as const).map(item => <button key={item.id} className={filter === item.id ? "selected" : ""} onClick={() => setFilter(item.id)}>{item.title}</button>)}</div>
                <div className="thread-list">
                  {visibleConversations.map(thread => {
                    const lead = leads.find(item => item.id === thread.leadId);
                    if (!lead) return null;
                    return <button key={thread.id} className={`thread-row ${selectedId === thread.id ? "selected" : ""}`} onClick={() => openThread(thread.id)}>
                      <div className="round-avatar">{initials(lead.name)}</div>
                      <div className="thread-main"><div className="thread-title"><strong>{lead.businessName}</strong><small>{lead.lastActivity}</small></div><p>{thread.messages.at(-1)?.body}</p><div className="thread-bottom"><span><ChannelIcon channel={lead.source}/>{channelLabels[lead.source]}</span>{thread.mode === "human" && <i>موظف</i>}</div></div>
                      {thread.unread > 0 && <span className="unread-bubble">{thread.unread}</span>}
                    </button>;
                  })}
                  {!visibleConversations.length && <div className="empty-state">لا توجد محادثات مطابقة</div>}
                </div>
              </section>
              <section className="surface-card chat-pane">
                {selectedConversation && selectedLead ? <>
                  <div className="chat-header"><div className="round-avatar">{initials(selectedLead.name)}</div><div className="chat-header-info"><strong>{selectedLead.businessName}</strong><span>{selectedLead.name} · {channelLabels[selectedLead.source]}</span></div><span className={`mode-badge ${selectedConversation.mode}`}><span className="mode-dot" />{selectedConversation.mode === "ai" ? "الأيجنت مسؤول" : "الموظف مسؤول"}</span></div>
                  <div className="chat-history"><div className="chat-day">محادثة توضيحية</div>{selectedConversation.messages.map(msg => <div key={msg.id} className={`message-line ${msg.author}`}><div className="message-bubble">{msg.author !== "customer" && <span className="message-sender">{msg.author === "ai" ? "الأيجنت" : msg.author === "employee" ? "الموظف" : "النظام"}</span>}<p>{msg.body}</p><small>{msg.time}</small></div></div>)}</div>
                  <div className="chat-footer">
                    {selectedConversation.mode === "ai" ? <div className="handoff-actions"><div><strong><Bot size={17}/> الأيجنت يدير المحادثة</strong><p>اختار طريقة تسليم العميل للموظف</p></div><div className="button-pair"><button className="secondary-btn" onClick={() => handoff("chat")}><MessageCircle size={16}/> استلام الشات</button><button className="primary-btn" onClick={() => handoff("call")}><PhoneCall size={16}/> مهمة اتصال</button></div></div> : <><div className="handoff-info"><CheckCircle2 size={17}/> {selectedConversation.handoff === "call" ? "مهمة اتصال لفريق المبيعات — الأيجنت متوقف" : "المحادثة تحت إدارة الموظف — الأيجنت متوقف"}<button onClick={returnToAgent}>إرجاع للأيجنت</button></div><div className="composer"><textarea rows={2} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) {event.preventDefault();sendMessage();}}} placeholder="اكتب رد الموظف التجريبي..." aria-label="اكتب رسالة"/><button className="send-button" disabled={!draft.trim()} aria-label="إضافة رد تجريبي" onClick={sendMessage}><Send size={19}/></button></div></>}
                  </div>
                </> : <div className="empty-state">اختار محادثة لعرضها</div>}
              </section>
              <section className="surface-card customer-pane">
                {selectedLead ? <>
                  <div className="customer-heading"><div className="round-avatar large">{initials(selectedLead.name)}</div><h2>{selectedLead.businessName}</h2><p>{selectedLead.name}</p><PriorityBadge lead={selectedLead}/></div>
                  <div className="customer-section"><h3>معلومات العميل</h3><div className="info-row"><span>النشاط</span><b>{selectedLead.businessType}</b></div><div className="info-row"><span>المدينة</span><b>{selectedLead.city}</b></div><div className="info-row"><span>حجم النشاط</span><b>{selectedLead.branches}</b></div><div className="info-row"><span>الهاتف</span><b dir="ltr">{selectedLead.phone}</b></div><div className="info-row"><span>مرحلة البيع</span><b>{stageLabels[selectedLead.stage]}</b></div></div>
                  <div className="customer-section"><h3>المتطلبات الأولية</h3><p className="requirements-text">{selectedLead.requirements}</p></div>
                  <div className="ai-summary"><span><Sparkles size={15}/> ملخص تسليم ذكي (تجريبي)</span><p>{selectedLead.summary}</p></div>
                  <div className="customer-note"><ShieldCheck size={15}/> سعر الهاردوير والتركيب يحدده الموظف بعد المعاينة.</div>
                </> : null}
              </section>
            </div>
          </>}

          {view === "leads" && <>
            <div className="page-head"><div><p className="eyebrow">Sales CRM</p><h1>العملاء المحتملون</h1><p>متابعة مراحل البيع وتسليم العملاء المؤهلين للفريق البشري.</p></div><span className="demo-caption">بيانات تجريبية · {leads.length} عملاء</span></div>
            <div className="lead-cards-grid">{leads.map(lead => <article key={lead.id} className="surface-card lead-card"><div className="lead-card-top"><div className="round-avatar">{lead.segment === "clothing" ? <Factory size={20}/> : <Store size={20}/>}</div><PriorityBadge lead={lead}/></div><h2>{lead.businessName}</h2><p className="lead-person">{lead.name} · {lead.city}</p><div className="lead-meta"><span>{lead.businessType}</span><span>{lead.branches}</span></div><p className="lead-requirements">{lead.requirements}</p><div className="lead-card-footer"><StageBadge stage={lead.stage}/><button className="link-btn" onClick={() => openLead(lead.id)}>فتح المحادثة <ArrowLeft size={16}/></button></div></article>)}</div>
          </>}

          {view === "agent" && <>
            <div className="page-head"><div><p className="eyebrow">AI Control Center</p><h1>مركز قيادة الأيجنت</h1><p>القواعد اللي هنفعّلها بمجرد ربط الذكاء الاصطناعي وقنوات التواصل.</p></div><span className="demo-caption">تصور التشغيل · لم يتم التفعيل</span></div>
            <div className="agent-grid">
              <section className="surface-card agent-hero"><div className="agent-hero-icon"><Bot size={30}/></div><h2>مساعد المبيعات الذكي</h2><p>هيفهم نشاط العميل ويسأله عن عدد الفروع ونقاط البيع ومتطلبات المخازن والهاردوير، ويجهزه للتسليم للموظف.</p><div className="agent-state"><span/> غير متصل حاليًا</div></section>
              <section className="surface-card rules-card"><h2>قواعد العمل الأساسية</h2><div className="rule-item"><CheckCircle2 size={18}/><div><strong>إنسان يكمل الصفقة</strong><p>الأيجنت لا يعتمد أسعار هاردوير أو تركيب نهائية.</p></div></div><div className="rule-item"><CheckCircle2 size={18}/><div><strong>اختيار طريقة التواصل</strong><p>استمرار المحادثة أو اتصال هاتفي حسب احتياج العميل وتفضيله.</p></div></div><div className="rule-item"><CheckCircle2 size={18}/><div><strong>منع الردود المزدوجة</strong><p>يتوقف الأيجنت فور استلام موظف للمحادثة.</p></div></div><div className="rule-item"><CheckCircle2 size={18}/><div><strong>التكامل الرسمي</strong><p>الرسائل والتعليقات والإعلانات عبر صلاحيات وواجهات Meta الرسمية.</p></div></div></section>
            </div>
            <section className="surface-card integration-card"><div className="section-heading"><div><h2>خطوات ربط الخدمات</h2><p>لن يتم تشغيل أي تكامل قبل تجهيزه واختباره</p></div><ClipboardList size={21}/></div><div className="integration-grid"><div><span className="integration-icon"><Activity size={19}/></span><strong>Supabase</strong><p>قاعدة العملاء والمحادثات</p><em>بانتظار صلاحية المشروع</em></div><div><span className="integration-icon"><MessageCircle size={19}/></span><strong>Meta Business</strong><p>واتساب وماسنجر وتعليقات فيسبوك</p><em>بانتظار التطبيق والتصاريح</em></div><div><span className="integration-icon"><Bot size={19}/></span><strong>OpenAI API</strong><p>التأهيل والتلخيص وتوصية التسليم</p><em>غير مفعّل</em></div></div></section>
          </>}
        </main>
      </div>
    </div>
  );
}
