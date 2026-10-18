/**
 * Server-owned, allowlisted connector catalogue.
 * A status is NOT proof of OAuth scopes, access or a successful API call.
 * Do not pass secret values or service-role credentials to the browser.
 */
import { configuredProviders } from "@/lib/ai-providers";

export type ConnectorStatus = "read-only" | "internal" | "credentials-present" | "setup-required" | "planned";
export type ConnectorId = "ai-models" | "github" | "browser" | "agent-database" | "pos-database" | "facebook" | "whatsapp";
export type ConnectorDescriptor = {
  id: ConnectorId; title: string; description: string;
  category: "ai" | "developer" | "browser" | "database" | "social";
  status: ConnectorStatus; statusLabel:string;
  capability:string; requiredKeys:string[]; docsUrl:string;
};

type Definition = Omit<ConnectorDescriptor,"status"|"statusLabel"> & {
  envKeys?:string[]; implementation:"read-only"|"internal"|"planned";
};
const definitions:Definition[]=[
  {id:"ai-models",title:"مزودو الذكاء الاصطناعي",category:"ai",
    description:"Gemini وGroq وباقي النماذج. اختيار اقتصادي وانتقال تلقائي عند الفشل.",
    capability:"محادثات وإنشاء محتوى نصي",requiredKeys:["GEMINI_API_KEY","GROQ_API_KEY","OPENROUTER_API_KEY"],
    docsUrl:"https://vercel.com/docs/environment-variables",implementation:"internal"},
  {id:"github",title:"GitHub",category:"developer",
    description:"قراءة الوثائق ومقتطفات ملفات كود مشروع الاختبار Premieros/.com.",
    capability:"قراءة علنية فقط؛ Pull Requests والتعديل يحتاجان مرحلة صلاحيات منفصلة",
    requiredKeys:[],docsUrl:"https://docs.github.com/en/apps/creating-github-apps",
    implementation:"read-only"},
  {id:"browser",title:"متصفح الصفحات العامة",category:"browser",
    description:"بحث عام محدود في فهارس Bing RSS وGoogle News وWikipedia، وقراءة HTML لمواقع محددة فقط؛ دون مفاتيح أو Sandbox.",
    capability:"بحث قراءة فقط مع روابط ومقتطفات وتواريخ، بلا تحقق تلقائي من المقالات الكاملة أو نقرات",
    requiredKeys:[],docsUrl:"https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API",
    implementation:"read-only"},
  {id:"agent-database",title:"قاعدة بيانات AGENT",category:"database",
    description:"حفظ المحادثات والمهام والعملاء داخل مؤسسة AGENT عبر Supabase وصلاحيات RLS.",
    capability:"وظائف AGENT الداخلية المصرح بها، وليس وصولًا عامًا لـSQL",
    requiredKeys:["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    docsUrl:"https://supabase.com/docs/guides/auth/row-level-security",
    implementation:"internal"},
  {id:"pos-database",title:"قاعدة بيانات المشاريع الخارجية",category:"database",
    description:"وصلة مستقبلية منفصلة لكل مشروع بصلاحيات قراءة محددة. لا نستخدم قاعدة Premier.OS الإنتاجية كتجربة.",
    capability:"قيد التخطيط: اتصال محدود النطاق وقراءة فقط بعد تفويض منفصل",
    requiredKeys:[],docsUrl:"https://supabase.com/docs/guides/database",
    implementation:"planned"},
  {id:"facebook",title:"Facebook / Instagram",category:"social",
    description:"Meta OAuth وربط الصفحات والرسائل ومراجعة المنشورات قبل النشر.",
    capability:"لم يتم ربط حساب Meta فعليًا؛ المفاتيح وحدها لا تمنح صلاحيات صفحات",
    requiredKeys:["META_APP_ID","META_APP_SECRET"],envKeys:["META_APP_ID","META_APP_SECRET"],
    docsUrl:"https://developers.facebook.com/docs/facebook-login/",implementation:"planned"},
  {id:"whatsapp",title:"WhatsApp Business",category:"social",
    description:"WhatsApp Cloud API والـWebhooks وقوالب الرسائل وموافقات الإرسال.",
    capability:"لا إرسال رسائل حقيقي حتى اكتمال تهيئة Meta والموافقات",
    requiredKeys:["WHATSAPP_ACCESS_TOKEN","WHATSAPP_PHONE_NUMBER_ID"],
    envKeys:["WHATSAPP_ACCESS_TOKEN","WHATSAPP_PHONE_NUMBER_ID"],
    docsUrl:"https://developers.facebook.com/docs/whatsapp/cloud-api/",implementation:"planned"}
];

export function listConnectorDescriptors(): ConnectorDescriptor[]{
  return definitions.map(({implementation,envKeys,...item})=>{
    const allKeys=envKeys||item.requiredKeys;
    const hasCredentials=allKeys.length>0 && allKeys.every(k=>Boolean(process.env[k]?.trim()));
    const status:ConnectorStatus=implementation==="internal"
      ? item.id==="ai-models" && configuredProviders().length===0 ? "setup-required" : "internal"
      : implementation==="read-only" ? "read-only"
      : hasCredentials ? "credentials-present" : "planned";
    const statusLabel=status==="internal"?"متاح الآن":status==="read-only"?"قراءة فقط":
      status==="credentials-present"?"المفاتيح موجودة · الربط لم يكتمل":
      status==="setup-required"?"يحتاج مفتاحًا":"قيد الإعداد";
    return {...item,status,statusLabel};
  });
}
