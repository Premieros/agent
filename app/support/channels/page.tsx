import Link from "next/link";

export const metadata={title:"AGENT | ربط قنوات خدمة العملاء"};
type Channel={name:string,description:string,state:string,details:string};
const channels:Channel[]=[
 {name:"المواقع الإلكترونية",state:"مدعوم",description:"خدمة العملاء عبر الودجت الحالي مع قاعدة معرفة مستقلة لكل مشروع.",
  details:"لإضافة موقع ثالث، أضف رابط HTTPS جديدًا ومفتاح Widget مستقلًا من إعدادات المشروع. لن تتغير إعدادات الموقعين الحاليين."},
 {name:"WhatsApp Business",state:"قيد التجهيز",description:"استقبال الرسائل من WhatsApp Cloud API عبر Webhook رسمي.",
  details:"المطلوب: حساب أعمال معتمد، رقم مرتبط، التطبيق والصلاحيات المناسبة، وسر توقيع محفوظ بالخادم. لا يتم إرسال ردود واتساب حتى إكمال الربط والاختبار."},
 {name:"Facebook Messenger",state:"قيد التجهيز",description:"توجيه رسائل الصفحة إلى مشروع AGENT الصحيح.",
  details:"المطلوب: صفحة Facebook بصلاحية إدارة مناسبة، تطبيق Meta وإذن المراسلة، وتحقيق توقيع Webhook. كل صفحة ترتبط بمشروع واحد محدد."},
 {name:"Instagram",state:"مخطط",description:"رسائل حساب إنستجرام المهني من خلال واجهات Meta المصرح بها.",
  details:"معالجة أحداث الرسائل قابلة للاختبار في هذا الفرع، لكن الربط والصندوق وإرسال الردود لم تُفعّل بعد."},
 {name:"مواقع وتطبيقات أخرى",state:"قابل للتوسعة",description:"إضافات مستقلة لقنوات جديدة مع الحفاظ على صندوق المحادثات الموحد.",
  details:"مواقع الويب تستخدم Widget مع أصل HTTPS مصرح؛ التطبيقات تتطلب هوية ومصادقة مستقلة ولا يكفي مفتاح الودجت."}
];
export default function SupportChannelsPage(){
 return <main dir="rtl" style={{maxWidth:960,margin:"0 auto",padding:"24px 20px 56px",fontFamily:"inherit"}}>
   <div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap",alignItems:"center",marginBottom:18}}>
    <div><p style={{margin:"0 0 8px",opacity:.75}}>AGENT / خدمة العملاء</p>
     <h1 style={{fontSize:"clamp(23px,3vw,32px)",margin:0}}>قنوات التواصل وربط المنصات</h1></div>
    <Link href="/support" style={{padding:"10px 14px",border:"1px solid currentColor",borderRadius:10}}>إدارة المشاريع والمواقع</Link>
   </div>
   <p style={{lineHeight:1.8,marginBottom:20}}>اربط كل قناة بمشروع وقاعدة معرفة وصلاحيات محددة. سيظل ربط المواقع الحالية كما هو، ولن تتصل أي منصة خارجية أو ترسل رسائل دون اعتماد الربط.</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:14}}>
    {channels.map(channel=><section key={channel.name} style={{border:"1px solid #a6b2c540",borderRadius:14,padding:18,background:"rgba(125,140,170,.055)"}}>
     <p style={{fontSize:13,margin:"0 0 10px",opacity:.65}}>{channel.state}</p>
     <h2 style={{fontSize:19,margin:"0 0 8px"}}>{channel.name}</h2>
     <p style={{lineHeight:1.7,margin:"0 0 14px"}}>{channel.description}</p>
     <p style={{lineHeight:1.7,margin:0,fontSize:14,opacity:.78}}>{channel.details}</p>
    </section>)}
   </div>
   <p style={{marginTop:22,lineHeight:1.8}}>لا تُدخل رموز Meta أو مفاتيح API في الواجهة أو المحادثات. يجب حفظها في أسرار الخادم ومراجعة سياسات Meta قبل تفعيل القنوات الخارجية. إعداد Webhook في هذا الفرع مرحلة أمنية أولى، وليس اتصالًا حيًا بواتساب أو فيسبوك.</p>
 </main>;
}
