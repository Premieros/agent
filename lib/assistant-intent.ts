/**
 * Deterministic, conservative command routing for AGENT chat.
 * It selects only the app tool; actual permission checks stay server-side.
 * Ordinary questions, explanations and content writing stay with the LLM.
 */
export type AgentIntent =
  "chat"|"learning-list"|"learning-hide"|"memory-save"|"skill-create"|"studio-page-create"|"studio-overview"|"studio-summary"|
  "studio-prepare"|"studio-run"|"site-diagnose"|"site-draft"|"work"|
  "workspace-overview"|"customers-overview"|"followups-overview"|"inbox-overview"|"integrations-overview"|"workspace-lead-create";
const normal=(s:string)=>s.trim().toLocaleLowerCase("ar")
  .replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/ـ/g,"").replace(/[\u064b-\u065f]/g,"");
export const requiresApproval=(intent:AgentIntent)=>!["chat","learning-list","learning-hide",
  "workspace-overview","customers-overview","followups-overview","inbox-overview",
  "integrations-overview","workspace-lead-create","studio-overview","studio-summary",
  "site-diagnose"].includes(intent);

export function detectAgentIntent(text:string,lastAssistantModel?:string|null):AgentIntent{
  const q=normal(text);
  const latestStudio=lastAssistantModel==="studio-data";
  if(!q||q.length>4500)return "chat";

  // Chat-first workspace: route only explicit commands. Informational questions
  // and requests for marketing/studio/site work retain their normal routing.
  if(/^(?:اعرض|وريني|افتح|راجع|شوف|هات|show|open)\s+(?:لي\s+)?(?:مساحه\s+العمل|ملخص\s+(?:الشغل|المؤسسه|المؤسسة)|لوحه\s+التحكم|الرئيسيه|داشبورد|workspace|dashboard)/iu.test(q)||
     /^(?:حاله|ملخص)\s+(?:الشغل|مساحه\s+العمل|المؤسسه|المؤسسة)/iu.test(q))
    return "workspace-overview";
  if(/^(?:اضف|انشئ|سجل|اعمل|create|add)\s+(?:لي\s+)?(?:عميل|lead|customer)(?:\s|$)/iu.test(q))
    return "workspace-lead-create";
  if(/^(?:اعرض|وريني|افتح|راجع|شوف|هات|قائمه|show|list)\s+(?:لي\s+)?(?:العملاء|عملائي|الليدز|leads|customers)(?:\s|$)/iu.test(q))
    return "customers-overview";
  if(/^(?:اعرض|وريني|افتح|راجع|شوف|هات|قائمه|show|list)\s+(?:لي\s+)?(?:المتابعات|مهام\s+المتابعه|متابعات\s+العملاء|followups)(?:\s|$)/iu.test(q))
    return "followups-overview";
  if(/^(?:اعرض|وريني|افتح|راجع|شوف|هات|show|open)\s+(?:لي\s+)?(?:صندوق\s+الوارد|الوارد|محادثات\s+العملاء|inbox)(?:\s|$)/iu.test(q))
    return "inbox-overview";
  if(/^(?:اعرض|وريني|افتح|راجع|شوف|هات|show|open)\s+(?:لي\s+)?(?:الاضافات|الاضافات\s+المتصله|مركز\s+الاضافات|التكاملات|الاتصالات|integrations|connectors)(?:\s|$)/iu.test(q)||
     /^(?:حاله|ما\s+حاله)\s+(?:الاضافات|التكاملات|connectors)/iu.test(q))
    return "integrations-overview";

  // The library is invisible until requested through the conversation.
  if(/^(?:اعرض|وريني|افتح|راجع|شوف|show|list)\s+(?:لي\s+)?(?:ذاكرتي|الذاكره|الذاكرة|مهاراتي|المهارات|المعلومات\s+المحفوظة|المعلومات\s+المحفوظة|memory|skills)(?:\s|$)/iu.test(q))
    return "learning-list";
  if(/^(?:اقفل|اغلق|اخفي|اخف|close|hide)\s+(?:الذاكره|الذاكرة|المهارات|قائمه\s+المهارات|memory|skills)/iu.test(q))
    return "learning-hide";
  if(/^(?:اضف|انشئ|سجل|اعمل|جهز|create|add)\s+(?:لي\s+)?(?:صفحه|صفحة|حساب\s+تسويق|marketing\s+page|page)(?:\s|$)/iu.test(q)||
     /^(?:صفحه|صفحة)\s+جديده\s+(?:باسم|اسمها|على|في)/iu.test(q))
    return "studio-page-create";

  // Persistent data is only stored after explicit user request and approval.
  if(/^(?:افتكر|احفظ\s+(?:في\s+)?(?:الذاكره|المعلومه)|تذكر|سجل\s+(?:في\s+)?الذاكره|remember\s+that)\s*[:،-]?\s+/iu.test(q))
    return "memory-save";
  if(/(?:انشئ|اصنع|اضف|اعمل|جهز|create|add)\s+(?:لي\s+)?(?:مهاره|skill)/iu.test(q)||
     /(?:مهاره\s+جديده|new\s+skill)/iu.test(q)&&/(?:عايز|اريد|انشئ|create)/iu.test(q))
    return "skill-create";

  const site=/\b(?:agent|premieros-ai-sales-agent)\b|(?:موقعي|موقعنا|موقع\s+agent|الموقع\s+بتاعنا|كود\s+الموقع|الموقع\s+الخاص\s+بنا)/iu.test(q);
  const siteOps=/(?:افحص|راجع|تحقق|راقب|حاله|status|diagnos|check|اصلح|عدّل|عدل|غير|حسن|ظبط|رتب|طور)/iu.test(q);
  const siteWrite=/(?:اصلح|عدّل|عدل|غير|حسن|ظبط|رتب|طور|اضف|انشئ|اصنع|تعديل)/iu.test(q);
  const siteTarget=/(?:موقع|الموقع|كود|واجهة|تصميم|قائمه|قائمة|صفحات)\s*.{0,55}(?:agent|premieros-ai-sales-agent)|(?:agent|premieros-ai-sales-agent)\s*.{0,55}(?:موقع|واجهة|صفحه|الصفحة|تصميم|قائمة|قائمه|كود)|(?:موقعي|موقعنا|الموقع\s+بتاعنا|كود\s+الموقع|الموقع\s+الخاص\s+بنا)/iu.test(q);
  if(site&&siteTarget&&siteOps){
    return siteWrite?"site-draft":"site-diagnose";
  }
  // Follow-up to a persisted site-manager result is still scoped to AGENT.
  if(lastAssistantModel==="site-manager"&&
    /^(?:افحص|راجع|تعديل|عدل|عدّل|حسن|ظبط)\s+(?:الصفحه|القائمه|الموقع|التصميم)/iu.test(q))
    return /^(?:عدل|عدّل|حسن|ظبط|تعديل)/iu.test(q)?"site-draft":"site-diagnose";

  // Explicit coding execution takes precedence over similar words in
  // marketing tasks ("إدارة المهام" is a CLI app, not a studio mission).
  // Regular questions about Work/GitHub Actions remain ordinary chat.
  const explaining=/^(?:كيف|ازاي|لماذا|ما\s+(?:هو|هي)|ماهي|ايه|اشرح|وضح|علمني|what\s+is|how\s+(?:do|to))(?=\s|$|[؟?!])/iu.test(q);
  const workMode=/(?:وضع\s+(?:ال)?عمل|sandbox|ساندبوكس|بيئه\s+معزوله|github\s+actions|جيت\s*هب\s+اكشنز)/iu;
  const explicitWork=/(?:باستخدام|داخل|في|عبر|على)\s+(?:وضع\s+(?:ال)?عمل|sandbox|ساندبوكس|بيئه\s+معزوله|github\s+actions|جيت\s*هب\s+اكشنز)/iu.test(q)||
    /(?:شغل|فعل|نفذ|استخدم|طبق|ابدا|اختبر|جرب)\s+.{0,45}(?:وضع\s+(?:ال)?عمل|sandbox|ساندبوكس|بيئه\s+معزوله|github\s+actions|جيت\s*هب\s+اكشنز)/iu.test(q);
  const execution=/\b(?:run|execute|test)\s+(?:the\s+)?(?:code|script|tests)\b/i.test(text)||
    /(?:شغل|نفذ|اختبر|جرب)\s+.{0,55}(?:الكود|البرنامج|سكريبت|الاختبارات)/iu.test(q);
  if(!explaining&&(explicitWork||execution&&
    (workMode.test(q)||/(?:الكود|البرنامج|سكريبت|الاختبارات)/iu.test(q))))
    return "work";

  const missionTerms=/(?:مهمه|مهام|الوكلاء|وكلاء|فريق\s+التسويق|الصفحات\s+المسجله|الصفحه\s+المسجله|مدير\s+الوكلاء|marketing\s+task|agent\s+mission)/iu.test(q);
  const taskCreate=/(?:انشئ|اضف|اعمل|سجل|جهز|حضر|create|add|new)\s+.{0,45}(?:مهمه|مهام|تكليف|mission|task)|(?:مهمه\s+جديده|تكليف\s+جديد)/iu.test(q);
  const taskRun=/(?:شغل|تشغيل|وزع|نفذ|ابد[أا]|run|start)\s+.{0,45}(?:الوكلاء|المهمه|المهام|agents|mission)/iu.test(q)||
    (latestStudio&&/^(?:شغلها|نفذها|ابدأ\s+فيها)/iu.test(q));
  const taskSummary=/(?:لخص|ملخص|تلخيص|نتائج|مخرجات|summary)/iu.test(q)&&
    (missionTerms||latestStudio||/(?:الحمله|الحملات)\s+(?:السابقه|المحفوظة)/iu.test(q));
  const taskOverview=/(?:اعرض|وريني|استعرض|قائمه|راجع|ايه|ما\s+هي|حاله|عدد|show|list)/iu.test(q)&&
    missionTerms;
  if(taskRun&&missionTerms||taskRun&&latestStudio)return "studio-run";
  if(taskCreate&&missionTerms)return "studio-prepare";
  if(taskSummary)return "studio-summary";
  if(taskOverview)return "studio-overview";

  return "chat";
}
export function describeAgentIntent(intent:AgentIntent){
  const text:Record<AgentIntent,{title:string;detail:string;cost:string}>={
    chat:{title:"محادثة عادية",detail:"إجابة نصية؛ البحث والقراءة عند الطلب يعملان تلقائيًا دون موافقة مسبقة.",cost:""},
    "workspace-overview":{title:"بيانات مساحة العمل",detail:"قراءة مؤشرات العملاء والمحادثات والمتابعات المصرح بها في AGENT.",cost:"قراءة مجانية بدون نموذج AI"},
    "customers-overview":{title:"عرض العملاء",detail:"عرض آخر العملاء من قاعدة المؤسسة داخل المحادثة.",cost:"قراءة مجانية"},
    "followups-overview":{title:"متابعات العملاء",detail:"قراءة المتابعات وإنشاء متابعة فقط بعد تأكيد منفصل.",cost:"بدون نموذج AI"},
    "inbox-overview":{title:"صندوق الوارد",detail:"عرض قائمة محادثات العملاء من البيانات الفعلية.",cost:"قراءة فقط"},
    "integrations-overview":{title:"حالة الإضافات",detail:"عرض الإضافات الفعلية؛ تعديل صلاحيات القراءة بتأكيد مستقل.",cost:"بدون نموذج AI"},
    "workspace-lead-create":{title:"إضافة عميل",detail:"فتح نموذج داخل المحادثة؛ لا حفظ قبل مراجعة وتأكيد صريحين.",cost:"بدون نموذج AI"},
    "learning-list":{title:"عرض الذاكرة والمهارات",detail:"فتح إدارة الذاكرة والمهارات عند الطلب فقط.",cost:"بدون AI"},
    "learning-hide":{title:"إخفاء الذاكرة والمهارات",detail:"إغلاق إدارة الذاكرة والمهارات.",cost:"بدون AI"},
    "studio-page-create":{title:"إضافة صفحة تسويق في AGENT",detail:"سيُحفظ ملف صفحة جديدة داخل قاعدة AGENT بعد مراجعة بياناته. هذا ليس ربطًا بحساب Meta ولا نشرًا خارجيًا.",cost:"بدون Sandbox أو استدعاء نموذج AI"},
    "memory-save":{title:"حفظ معلومة في ذاكرة AGENT",detail:"ستبقى محفوظة في Supabase ويمكن حذفها لاحقًا.",cost:"بدون Sandbox أو نموذج إضافي"},
    "skill-create":{title:"إنشاء مهارة مخصصة",detail:"سيُحفظ مقترح مهارة للمراجعة، ولن يُفعّل قبل موافقتك.",cost:"بدون Sandbox"},
    "studio-overview":{title:"قراءة الصفحات والمهام",detail:"استعراض بيانات المؤسسة المصرّح لك بها، بدون تعديل.",cost:"بدون Sandbox أو نموذج AI"},
    "studio-summary":{title:"تلخيص مخرجات الوكلاء",detail:"عرض ملخص من النتائج المحفوظة بالفعل؛ لا ينفذ نشرًا.",cost:"بدون Sandbox أو نموذج AI"},
    "studio-prepare":{title:"تجهيز مهمة للتسويق",detail:"تحضير مهمة للمراجعة فقط؛ الحفظ والتشغيل يحتاجان موافقة لاحقة.",cost:"بدون Sandbox"},
    "studio-run":{title:"تشغيل الوكلاء",detail:"ينشئ مسودات داخلية لمهمة موجودة، دون نشر أو إنفاق إعلاني.",cost:"يستخدم حصة نموذج AI (الوضع الاقتصادي)"},
    "site-diagnose":{title:"فحص موقع AGENT",detail:"قراءة حالة الموقع وGitHub وقاعدة بيانات AGENT المصرح بها.",cost:"بدون Sandbox"},
    "site-draft":{title:"تجهيز مقترح تعديل الموقع",detail:"ينشئ مسودة مراجعة داخل AGENT، ولا يغيّر GitHub أو ينشر تلقائيًا.",cost:"قد يستهلك حصة نموذج AI"},
    work:{title:"تحضير تجربة برمجية",detail:"سينشئ AGENT خطة وكودًا للمراجعة أولًا. لن يُرسل إلى GitHub Actions أو Sandbox إلا بعد موافقتك على الكود والبيئة.",cost:"التخطيط يستخدم النموذج المتاح؛ التنفيذ قد يستهلك حصة GitHub Actions أو Sandbox حسب اختيارك"}
  };
  return text[intent];
}
export function extractMemory(text:string){
  const stripped=text.trim().replace(/^(?:افتكر|احفظ\s+(?:في\s+)?(?:الذاكرة|الذاكره|المعلومة|المعلومه)|تذكر|سجل\s+(?:في\s+)?الذاكرة|remember\s+that)\s*[:،-]?\s*/iu,"").trim();
  return stripped.slice(0,900);
}
