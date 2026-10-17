"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, CircleAlert, ClipboardList, Image as ImageIcon, LoaderCircle, Megaphone, MessageCircle, Plus, RefreshCcw, Rocket, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase-browser";

type Member = { organization_id: string; role: string };
type Page = {
  id: string; name: string; platform: "facebook" | "instagram";
  product_context: string; target_audience: string; brand_voice: string;
  connection_status: string; created_at: string;
};
type Mission = {
  id: string; page_id: string; objective: string; brief: string;
  budget_egp: number | null; status: string; created_at: string;
};
type Output = { id: string; agent_role: string; content: string; model: string };
type Asset = { id: string; storage_path: string; prompt: string; signedUrl?: string };
type ProviderId = "openai" | "gemini" | "openrouter" | "groq" | "deepseek" | "mistral" | "together" | "anthropic";
type ReadyStatus = { aiReady: boolean; imageReady: boolean; metaConnected: boolean; canPublish: boolean; configuredProviders?: ProviderId[] };
const providers: { id: ProviderId; title: string; model: string; image: boolean }[] = [
  { id: "gemini", title: "Google Gemini", model: "gemini-2.5-flash-lite", image: true },
  { id: "openai", title: "OpenAI", model: "gpt-4.1-mini", image: true },
  { id: "openrouter", title: "OpenRouter", model: "openai/gpt-4o-mini", image: false },
  { id: "groq", title: "Groq", model: "llama-3.3-70b-versatile", image: false },
  { id: "deepseek", title: "DeepSeek", model: "deepseek-chat", image: false },
  { id: "mistral", title: "Mistral", model: "mistral-small-latest", image: false },
  { id: "together", title: "Together AI", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", image: false },
  { id: "anthropic", title: "Anthropic", model: "claude-haiku-4-5", image: false }
];
type Objective = "content" | "campaign" | "replies" | "launch";

const agents = [
  { id: "director", label: "مدير الوكلاء", detail: "الهدف، توزيع الأدوار والتسليم", icon: Bot },
  { id: "strategist", label: "وكيل التسويق", detail: "الجمهور والخطة الأسبوعية", icon: Megaphone },
  { id: "copywriter", label: "وكيل المحتوى", detail: "المنشورات والرسائل الإعلانية", icon: ClipboardList },
  { id: "designer", label: "وكيل التصميم", detail: "اتجاه بصري وتصميمات مقترحة", icon: ImageIcon },
  { id: "media_buyer", label: "وكيل الإعلانات", detail: "جمهور وإعلانات وميزانية مقترحة", icon: Rocket },
  { id: "support", label: "وكيل الردود", detail: "ردود وأسئلة تأهيل وتسليم بشري", icon: MessageCircle },
  { id: "reviewer", label: "وكيل المراجعة", detail: "الالتزام وجودة المسودات", icon: ShieldCheck }
];
const objectives: { id: Objective; label: string }[] = [
  { id: "content", label: "محتوى أسبوعي" },
  { id: "campaign", label: "حملة إعلانية" },
  { id: "replies", label: "ردود على العملاء" },
  { id: "launch", label: "إطلاق منتج أو خدمة" }
];
const statusLabels: Record<string,string> = {
  queued: "جاهزة للتشغيل", running: "الوكلاء يعملون",
  review: "بانتظار موافقتك", approved: "معتمدة داخليًا", failed: "فشل — يمكن إعادة المحاولة"
};
const initialPage = { name: "", platform: "facebook" as Page["platform"], product_context: "", target_audience: "", brand_voice: "مصري احترافي وواضح" };

export default function AgentStudio() {
  const db = getSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<Page[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [pageId, setPageId] = useState("");
  const [missionId, setMissionId] = useState("");
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ready, setReady] = useState<ReadyStatus | null>(null);
  const [aiProvider, setAiProvider] = useState<ProviderId>("gemini");
  const [aiKey, setAiKey] = useState("");
  const [aiModel, setAiModel] = useState("gemini-2.5-flash-lite");
  const [showAiSettings, setShowAiSettings] = useState(true);
  const [aiTestResult, setAiTestResult] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [pageEditor, setPageEditor] = useState<"closed" | "new" | "edit">("closed");
  const [pageForm, setPageForm] = useState(initialPage);
  const [missionFormOpen, setMissionFormOpen] = useState(false);
  const [objective, setObjective] = useState<Objective>("content");
  const [brief, setBrief] = useState("");
  const [budget, setBudget] = useState("");
  const [activeTab, setActiveTab] = useState<"manager" | "output" | "creatives">("manager");

  const selectedPage = pages.find(p => p.id === pageId) || null;
  const relevantMissions = missions.filter(m => m.page_id === pageId);
  const selectedMission = missions.find(m => m.id === missionId) || null;
  const approvedCount = missions.filter(m => m.status === "approved").length;
  const selectedProvider = providers.find(p => p.id === aiProvider) || providers[0];
  const aiReady = Boolean(aiKey.trim()) || Boolean(ready?.configuredProviders?.includes(aiProvider));
  const canGenerateImage = aiReady && selectedProvider.image;

  const loadWorkspace = useCallback(async (activeUser: User | null) => {
    if (!db || !activeUser) {
      setMember(null); setPages([]); setMissions([]); setLoading(false); return;
    }
    setLoading(true);
    const { data: memberships, error: membershipError } = await db.from("organization_members")
      .select("organization_id,role").eq("user_id", activeUser.id)
      .in("role", ["admin","manager"]).limit(1);
    if (membershipError) { setError(membershipError.message); setLoading(false); return; }
    const currentMember = (memberships?.[0] ?? null) as Member | null;
    setMember(currentMember);
    if (!currentMember) { setLoading(false); return; }
    const org = currentMember.organization_id;
    const [p, m] = await Promise.all([
      db.from("marketing_pages").select("id,name,platform,product_context,target_audience,brand_voice,connection_status,created_at")
        .eq("organization_id", org).order("created_at", { ascending: true }).limit(80),
      db.from("agent_missions").select("id,page_id,objective,brief,budget_egp,status,created_at")
        .eq("organization_id", org).order("created_at", { ascending: false }).limit(150)
    ]);
    if (p.error || m.error) setError(p.error?.message || m.error?.message || "تعذر تحميل البيانات");
    else {
      const pageRows = (p.data || []) as Page[];
      const missionRows = (m.data || []) as Mission[];
      setPages(pageRows); setMissions(missionRows);
      setPageId(old => old && pageRows.some(item => item.id === old) ? old : (pageRows[0]?.id || ""));
      setMissionId(old => old && missionRows.some(item => item.id === old) ? old : (missionRows[0]?.id || ""));
    }
    setLoading(false);
  }, [db]);

  const loadDetails = useCallback(async (id: string, organizationId: string) => {
    if (!db) return;
    const [out, images] = await Promise.all([
      db.from("agent_outputs").select("id,agent_role,content,model")
        .eq("organization_id", organizationId).eq("mission_id", id),
      db.from("creative_assets").select("id,storage_path,prompt")
        .eq("organization_id", organizationId).eq("mission_id", id).order("created_at", { ascending: false })
    ]);
    if (out.error || images.error) { setError(out.error?.message || images.error?.message || "تعذر عرض النتائج"); return; }
    setOutputs((out.data || []) as Output[]);
    const assetRows = (images.data || []) as Asset[];
    const urls = await Promise.all(assetRows.map(async item => {
      const { data } = await db.storage.from("marketing-creatives").createSignedUrl(item.storage_path, 3600);
      return { ...item, signedUrl: data?.signedUrl || undefined };
    }));
    setAssets(urls);
  }, [db]);

  async function authHeaders() {
    if (!db) throw new Error("برجاء تسجيل الدخول.");
    const { data: { session } } = await db.auth.getSession();
    if (!session?.access_token) throw new Error("جلسة الدخول انتهت. سجل الدخول مرة أخرى.");
    return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
  }

  const statusCheck = useCallback(async () => {
    if (!db) return;
    const { data: { session } } = await db.auth.getSession();
    if (!session) return;
    try {
      const r = await fetch("/api/agents/status", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (r.ok) setReady(await r.json() as ReadyStatus);
    } catch { /* Remains unknown rather than claiming ready. */ }
  }, [db]);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    let active = true;
    void db.auth.getUser().then(({ data }) => {
      if (active) { setUser(data.user); void loadWorkspace(data.user); if (data.user) void statusCheck(); }
    });
    const { data: listener } = db.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user || null);
      setTimeout(() => { if (active) { void loadWorkspace(session?.user || null); if (session?.user) void statusCheck(); } }, 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [db, loadWorkspace, statusCheck]);

  useEffect(() => {
    if (member && missionId) void loadDetails(missionId, member.organization_id);
    else { setOutputs([]); setAssets([]); }
  }, [missionId, member, loadDetails]);

  const switchPage = (id: string) => {
    setPageId(id); setPageEditor("closed"); setMissionFormOpen(false); setMissionId(missions.find(m=>m.page_id===id)?.id || ""); setError(""); setNotice("");
  };

  async function savePage() {
    if (!db || !member || !pageForm.name.trim()) return;
    setBusy("page"); setError(""); setNotice("");
    const data = {
      name: pageForm.name.trim(), product_context: pageForm.product_context.trim(),
      target_audience: pageForm.target_audience.trim(), brand_voice: pageForm.brand_voice.trim()
    };
    const response = pageEditor==="edit" && selectedPage
      ? await db.from("marketing_pages").update(data).eq("id", selectedPage.id).eq("organization_id", member.organization_id)
      : await db.from("marketing_pages").insert({ ...data, platform: pageForm.platform, organization_id: member.organization_id });
    if (response.error) setError(response.error.message);
    else { setNotice("تم حفظ ملف الصفحة. الربط بحساب Meta لسه محتاج تفويض رسمي."); setPageEditor("closed"); await loadWorkspace(user); }
    setBusy("");
  }

  async function createMission() {
    if (!db || !member || !user || !pageId || brief.trim().length < 10) return;
    const numberBudget = budget.trim() ? Number(budget) : null;
    if (numberBudget !== null && (!Number.isFinite(numberBudget) || numberBudget < 0 || numberBudget > 100000000)) {
      setError("ادخل ميزانية رقمية صحيحة أو سيبها فاضية."); return;
    }
    setBusy("create"); setError(""); setNotice("");
    const { data, error: issue } = await db.from("agent_missions").insert({
      organization_id: member.organization_id, page_id: pageId, objective,
      brief: brief.trim(), budget_egp: numberBudget, requested_by: user.id
    }).select("id").single();
    if (issue) setError(issue.message);
    else {
      setMissionFormOpen(false); setBrief(""); setBudget(""); setMissionId(data.id);
      setNotice("تم تسجيل المهمة فعليًا. اضغط تشغيل الوكلاء لتوليد المسودات.");
      await loadWorkspace(user);
    }
    setBusy("");
  }

  async function testProvider() {
    if (!aiReady || busy) return;
    if (!window.confirm("اختبار الاتصال يرسل طلب AI واحدًا، وقد يُخصم من حصة المزوّد. هل توافق؟")) return;
    setBusy("test"); setError(""); setAiTestResult("");
    try {
      const response = await fetch("/api/agents/test", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ ai: { provider: aiProvider, apiKey: aiKey.trim(), model: aiModel.trim() } })
      });
      const data = await response.json() as { ok?: boolean; error?: string; model?: string };
      if (!response.ok) setError(data.error || "فشل اختبار المفتاح.");
      else setAiTestResult(`نجح اتصال ${selectedProvider.title} بالنموذج ${data.model || aiModel}.`);
    } catch (e) { setError(e instanceof Error ? e.message : "فشل الاختبار."); }
    finally { setBusy(""); }
  }

  async function callAgentAPI(endpoint: string, id: string, busyKey: string) {
    if (!db || !member) return;
    if (!aiReady) { setShowAiSettings(true); setError("اختار مزوّد الذكاء الاصطناعي وحط مفتاحه الأول."); return; }
    if (!window.confirm(busyKey==="design" ? "توليد الصورة قد يستهلك من حصة المزوّد المختار. هل تريد المتابعة؟" : "تشغيل 7 وكلاء يستخدم حصة أو رصيد المزوّد المختار وينتج مسودات فقط. هل توافق؟")) return;
    setBusy(busyKey); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({ missionId: id, ai: { provider: aiProvider, model: aiModel.trim(), apiKey: aiKey.trim() } })
      });
      const result = await response.json() as { error?: string; agents?: number };
      if (!response.ok) { setError(result.error || "تعذر تشغيل الوكيل."); return; }
      setNotice(busyKey==="design" ? "تم إنشاء تصميم حقيقي وحفظه في مكتبة خاصة." : `اكتمل عمل ${result.agents || 7} وكلاء. كل المخرجات تنتظر مراجعتك.`);
      setActiveTab(busyKey==="design"?"creatives":"output");
      await loadWorkspace(user);
      await loadDetails(id, member.organization_id);
    } catch (e) { setError(e instanceof Error ? e.message : "حدث خطأ أثناء التنفيذ."); }
    finally { setBusy(""); }
  }

  async function approveMission() {
    if (!db || !member || !selectedMission || outputs.length===0) return;
    if (!window.confirm("اعتماد المحتوى داخل المنصة فقط؛ لن يتم نشره أو إنفاق أي ميزانية. هل توافق؟")) return;
    setBusy("approve"); setError("");
    const { error: issue } = await db.from("agent_missions")
      .update({ status: "approved" }).eq("organization_id", member.organization_id)
      .eq("id", selectedMission.id).eq("status", "review");
    if (issue) setError(issue.message);
    else { setNotice("تم اعتماد المخرجات داخليًا، بدون نشر خارجي."); await loadWorkspace(user); }
    setBusy("");
  }

  function openNewPage() { setPageForm(initialPage); setPageEditor("new"); }
  function openEditPage() {
    if (!selectedPage) return;
    setPageForm({
      name: selectedPage.name, platform: selectedPage.platform,
      product_context: selectedPage.product_context, target_audience: selectedPage.target_audience,
      brand_voice: selectedPage.brand_voice
    }); setPageEditor("edit");
  }

  const orderedOutputs = useMemo(() => agents
    .map(agent => ({ ...agent, output: outputs.find(o => o.agent_role === agent.id) }))
    , [outputs]);

  return <div className="crm-root studio-root">
    <div className="crm-wrap">
      <header className="crm-header">
        <div><strong>AGENT</strong><span> · استوديو الوكلاء الذكي</span></div>
        <nav className="crm-actions" aria-label="التنقل">
          <Link href="/crm"><ArrowRight size={16}/> العملاء</Link>
          <Link href="/crm/inbox">المحادثات</Link>
          <Link href="/">النموذج الأولي</Link>
        </nav>
      </header>
      <div className="crm-title">
        <div><span className="crm-overline">Multi-page AI Operations</span><h1>مدير الوكلاء والتسويق</h1><p>مساحة تشغيل حقيقية لإدارة محتوى وصفحات متعددة ومراجعة الحملات والتصاميم والردود.</p></div>
        <span className="crm-status"><ShieldCheck size={15}/> مراجعة بشرية قبل أي نشر</span>
      </div>
      {error && <p className="crm-error" role="alert">{error} <button onClick={()=>setError("")}>×</button></p>}
      {notice && <p className="crm-success studio-notice" role="status"><CheckCircle2 size={16}/>{notice}</p>}
      {!db && <section className="crm-card">إعدادات Supabase غير مكتملة.</section>}
      {db && loading && <section className="crm-card"><LoaderCircle size={18} className="crm-spin"/> جارٍ التحميل...</section>}
      {db && !loading && !user && <section className="crm-card studio-gate">
        <h2>سجل الدخول أولًا</h2><p>النظام مرتبط بحسابك على Supabase. انتقل لصفحة تسجيل الدخول علشان تبدأ إدارة الصفحات.</p><Link href="/crm">تسجيل الدخول</Link>
      </section>}
      {db && !loading && user && !member && <section className="crm-card studio-gate">
        <h2>يلزم صلاحية مدير</h2><p>هذه المساحة مخصصة لمدير الشركة ومدير التسويق فقط.</p>
      </section>}
      {db && !loading && member && <>
        <div className="studio-metrics">
          <div><span>الصفحات المسجلة</span><strong>{pages.length}</strong></div>
          <div><span>المهمات</span><strong>{missions.length}</strong></div>
          <div><span>بانتظار مراجعتك</span><strong>{missions.filter(m=>m.status==="review").length}</strong></div>
          <div><span>اعتماد داخلي</span><strong>{approvedCount}</strong></div>
        </div>
        <section className="studio-ai-settings">
          <div className="studio-ai-settings-head">
            <div><strong><Sparkles size={17}/> إعدادات الذكاء الاصطناعي</strong>
              <p>اختار المزوّد واستخدم مفتاحه مباشرة لتشغيل وكلائك. مش لازم مفتاح OpenAI.</p></div>
            <button type="button" onClick={()=>setShowAiSettings(v=>!v)}>{showAiSettings?"إخفاء الإعدادات":"تعديل المزوّد"}</button>
          </div>
          {showAiSettings && <div className="studio-ai-config">
            <label>مزوّد AI
              <select value={aiProvider} onChange={e=>{
                const picked = providers.find(p=>p.id===e.target.value);
                if (!picked) return;
                setAiProvider(picked.id); setAiModel(picked.model); setAiKey(""); setAiTestResult("");
              }}>
                {providers.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
            <label>مفتاح API الخاص بالمزوّد
              <input type="password" autoComplete="off" spellCheck={false} placeholder="الصق المفتاح هنا" value={aiKey} onChange={e=>{setAiKey(e.target.value);setAiTestResult("");}} />
            </label>
            <label>نموذج الكتابة
              <input dir="ltr" spellCheck={false} autoComplete="off" value={aiModel} onChange={e=>{setAiModel(e.target.value);setAiTestResult("");}} placeholder="Model ID"/>
            </label>
            <button type="button" disabled={!aiKey} onClick={()=>{setAiKey("");setAiTestResult("");}}>مسح المفتاح</button>
            <button type="button" className="studio-test-provider" disabled={!aiReady||Boolean(busy)} onClick={()=>void testProvider()}>{busy==="test"?"جارٍ الاختبار...":"اختبار المفتاح"}</button>
          </div>}
          {aiTestResult && <p className="studio-success-note">{aiTestResult}</p>}
          <p className="studio-privacy-note"><ShieldCheck size={13}/> المفتاح موجود في الصفحة دي مؤقتًا فقط، مش بيتحفظ في قاعدة البيانات أو المتصفح. عند تحديث الصفحة هتحتاج تدخله تاني. لو فيه مفتاح مُعدّ على Vercel للمزوّد المختار تقدر تسيب الخانة فاضية.</p>
        </section>
        <div className="studio-readiness">
          <CircleAlert size={16}/>
          <span>{aiReady ? `مزوّد ${selectedProvider.title} جاهز من ناحية إدخال المفتاح (لسه محتاج اختبار صلاحية المفتاح)` : `اختار مفتاح ${selectedProvider.title} لتشغيل الوكلاء`} · {selectedProvider.image ? "يدعم توليد الصور بنموذج صور منفصل حسب الحصة" : "هذا المزوّد مخصص للمهام النصية هنا"} · {ready?.metaConnected ? "Meta متصل" : "Meta غير متصل، لا نشر ولا إعلان ممول ولا رد خارجي"}</span>
          <button type="button" onClick={()=>void statusCheck()} title="فحص الإعدادات"><RefreshCcw size={15}/></button>
        </div>
        <div className="studio-layout">
          <aside className="studio-pages">
            <div className="studio-side-head"><h2>الصفحات</h2><button title="إضافة صفحة" onClick={openNewPage}><Plus size={16}/></button></div>
            {pages.length===0 && <p className="studio-muted">سجّل أول صفحة أو علامة تجارية. ده ملف إدارة داخلي، مش تفويض Meta.</p>}
            {pages.map(p=><button type="button" className={"studio-page-choice "+(p.id===pageId?"current":"")} key={p.id} onClick={()=>switchPage(p.id)}>
              <span className="studio-platform">{p.platform==="facebook"?"f":"◎"}</span>
              <span><strong>{p.name}</strong><small>{p.platform==="facebook"?"فيسبوك":"إنستجرام"} · غير مربوطة رسميًا</small></span>
            </button>)}
            {pageEditor!=="closed" && <form className="studio-page-form" onSubmit={e=>{e.preventDefault();void savePage();}}>
              <h3>{pageEditor==="new"?"إضافة صفحة":"تعديل الملف"}</h3>
              <label>اسم الصفحة<input value={pageForm.name} required minLength={2} maxLength={120} onChange={e=>setPageForm(v=>({...v,name:e.target.value}))}/></label>
              {pageEditor==="new" && <label>المنصة<select value={pageForm.platform} onChange={e=>setPageForm(v=>({...v,platform:e.target.value as Page["platform"]}))}><option value="facebook">فيسبوك</option><option value="instagram">إنستجرام</option></select></label>}
              <label>الخدمات والمنتجات<textarea rows={3} maxLength={4000} placeholder="مثال: نظام POS للمطاعم، نقاط البيع والأجهزة..." value={pageForm.product_context} onChange={e=>setPageForm(v=>({...v,product_context:e.target.value}))}/></label>
              <label>الجمهور المستهدف<textarea rows={2} maxLength={2000} value={pageForm.target_audience} onChange={e=>setPageForm(v=>({...v,target_audience:e.target.value}))}/></label>
              <label>نبرة العلامة<input maxLength={500} value={pageForm.brand_voice} onChange={e=>setPageForm(v=>({...v,brand_voice:e.target.value}))}/></label>
              <div><button type="submit" disabled={busy==="page"}>حفظ الصفحة</button><button type="button" onClick={()=>setPageEditor("closed")}>إلغاء</button></div>
            </form>}
            {selectedPage && pageEditor==="closed" && <button className="studio-edit-page" onClick={openEditPage}>تعديل وصف الصفحة والجمهور</button>}
            <p className="studio-footnote">يمكنك إعداد أي عدد من الصفحات داخليًا؛ النشر والردود يحتاجان ربط Meta بصلاحيات الصفحات.</p>
          </aside>
          <main className="studio-center">
            {!selectedPage ? <div className="studio-empty"><Sparkles size={32}/><h2>أضف أول صفحة للبدء</h2><p>كل صفحة لها بياناتها وخططها ومخرجات وكلائها، منفصلة عن الصفحات الأخرى.</p><button onClick={openNewPage}>إضافة صفحة</button></div> : <>
              <div className="studio-page-banner">
                <div><span className="crm-overline">ملف الإدارة الحالي</span><h2>{selectedPage.name}</h2><p>{selectedPage.target_audience || "أضف الجمهور المستهدف لتحسين دقة خطة الوكلاء."}</p></div>
                <span className="studio-disconnected">غير متصلة بـMeta</span>
              </div>
              <div className="studio-section-head"><h2>مهام الوكلاء</h2><button onClick={()=>setMissionFormOpen(v=>!v)}><Plus size={16}/> مهمة جديدة</button></div>
              {missionFormOpen && <form className="studio-mission-form" onSubmit={e=>{e.preventDefault();void createMission();}}>
                <label>الهدف<select value={objective} onChange={e=>setObjective(e.target.value as Objective)}>{objectives.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
                <label>ميزانية مقترحة (اختياري، ج.م)<input type="number" min={0} max={100000000} step="any" placeholder="مش معناها صرف فعلي" value={budget} onChange={e=>setBudget(e.target.value)} /></label>
                <label className="studio-brief">التكليف لمدير الوكلاء<textarea required minLength={10} maxLength={5000} rows={4} placeholder="مثال: اعمل حملة تعريفية لنظام إدارة المطاعم تستهدف أصحاب الكافيهات، بمحتوى مفهوم وبدون أسعار ثابتة..." value={brief} onChange={e=>setBrief(e.target.value)} /></label>
                <div><button disabled={busy==="create"||brief.trim().length<10}>حفظ المهمة</button><button type="button" onClick={()=>setMissionFormOpen(false)}>إلغاء</button></div>
              </form>}
              <div className="studio-mission-list">
                {relevantMissions.length===0 && <p className="studio-muted">لا توجد مهمات للصفحة دي. أنشئ تكليفًا لمدير الوكلاء.</p>}
                {relevantMissions.map(m=><button key={m.id} onClick={()=>{setMissionId(m.id);setActiveTab("manager");}} className={"studio-mission-row "+(missionId===m.id?"selected":"")}>
                  <span><strong>{objectives.find(o=>o.id===m.objective)?.label || m.objective}</strong><small>{m.brief}</small></span>
                  <em className={"studio-status "+m.status}>{statusLabels[m.status] || m.status}</em>
                </button>)}
              </div>
              {selectedMission && selectedMission.page_id===pageId && <section className="studio-workspace">
                <div className="studio-section-head"><div><h2>مهمة الوكلاء المحددة</h2><p>{statusLabels[selectedMission.status]}</p></div>
                  {["queued","failed"].includes(selectedMission.status) && <button className="studio-run" disabled={Boolean(busy)||!aiReady} onClick={()=>void callAgentAPI("/api/agents/run",selectedMission.id,"run")}><WandSparkles size={16}/>{busy==="run"?"الوكلاء يعملون...":"تشغيل مدير الوكلاء"}</button>}
                  {selectedMission.status==="review" && outputs.length>0 && <button className="studio-approve" disabled={Boolean(busy)} onClick={()=>void approveMission()}><CheckCircle2 size={16}/> اعتماد المسودات</button>}
                </div>
                <div className="studio-tabs">
                  <button className={activeTab==="manager"?"active":""} onClick={()=>setActiveTab("manager")}>المدير والفريق</button>
                  <button className={activeTab==="output"?"active":""} onClick={()=>setActiveTab("output")}>مخرجات الوكلاء ({outputs.length})</button>
                  <button className={activeTab==="creatives"?"active":""} onClick={()=>setActiveTab("creatives")}>التصميمات ({assets.length})</button>
                </div>
                {activeTab==="manager" && <div className="studio-agent-list">{agents.map(a=><div key={a.id} className="studio-agent-item">
                  <a.icon size={18}/><div><strong>{a.label}</strong><p>{a.detail}</p></div><span>{outputs.some(o=>o.agent_role===a.id)?"أنجز المهمة":selectedMission.status==="running"?"يعمل":"بانتظار التشغيل"}</span>
                </div>)}</div>}
                {activeTab==="output" && <div className="studio-output-list">
                  {orderedOutputs.every(a=>!a.output) && <p className="studio-muted">المخرجات هتظهر بعد تشغيل الوكلاء باستخدام API فعلي.</p>}
                  {orderedOutputs.filter(a=>a.output).map(a=><article key={a.id} className="studio-output">
                    <h3><a.icon size={17}/>{a.label}</h3><p>{a.output?.content}</p><small>الطراز: {a.output?.model}</small>
                  </article>)}
                  {selectedMission.status==="approved" && <p className="studio-success-note">المسودات معتمدة داخليًا فقط. لم يحدث نشر أو إنفاق.</p>}
                </div>}
                {activeTab==="creatives" && <div className="studio-creatives">
                  <p>صورة دعائية مولّدة فعليًا عبر OpenAI أو Gemini عند توفر نموذج صور في حسابك؛ تُحفظ في مساحة خاصة ولا تُنشر دون موافقة.</p>
                  <button disabled={Boolean(busy)||!canGenerateImage||!["review","approved"].includes(selectedMission.status)||assets.length>=3} onClick={()=>void callAgentAPI("/api/agents/design",selectedMission.id,"design")}><ImageIcon size={17}/>{busy==="design"?"جارٍ توليد الصورة...":"توليد تصميم بالذكاء الاصطناعي"}</button>
                  {assets.length>=3 && <small>وصلت للحد الأقصى 3 تصاميم لهذه المهمة.</small>}
                  <div className="studio-image-grid">{assets.map(a=><figure key={a.id}>
                    {a.signedUrl ? <img src={a.signedUrl} alt="تصميم دعائي مولّد بالذكاء الاصطناعي" /> : <div className="studio-image-missing">تعذر تحميل الصورة</div>}
                    <figcaption>صورة خاصة · لم تُنشر</figcaption>
                  </figure>)}</div>
                </div>}
              </section>}
            </>}
          </main>
        </div>
      </>}
    </div>
  </div>;
}
