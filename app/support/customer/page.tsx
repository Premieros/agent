"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {ArrowLeft,ArrowUp,CheckCircle2,Headphones,MessageCircle,RotateCcw,ShieldCheck,Sparkles} from "lucide-react";

type ChatMessage={id:number;kind:"visitor"|"assistant"|"notice";body:string};
type VisitorSession={conversationId:string;visitorToken:string};
type Reply={answer?:string;error?:string};
const demoReplies=[
 {match:/سعر|اسعار|أسعار|تكلف|بكام|price/i,reply:"هذه واجهة عرض تجريبية، لذلك لا توجد قائمة أسعار حقيقية مرتبطة بها. في النسخة الفعلية سأعرض الأسعار المعتمدة في ملفات المشروع، أو أحوّل سؤالك إلى مسؤول المبيعات."},
 {match:/تواصل|موظف|بشر|هاتف|اتصال|دعم/i,reply:"يمكن تحويل المحادثة إلى موظف الدعم بعد تفعيل المشروع وربط صندوق الوارد. هذه التجربة لا ترسل طلبات فعلية إلى الموظفين."},
 {match:/شحن|توصيل|طلب|حجز/i,reply:"في النسخة الفعلية أستطيع شرح سياسة الطلب والتوصيل وفق معلومات المشروع المعتمدة. لم تتم إضافة معلومات متجر حقيقي إلى هذه التجربة."},
 {match:/مواعيد|مواعيد العمل|فاتحين|ساعات/i,reply:"ساعات العمل تختلف حسب المشروع. في النسخة الفعلية تُقرأ من قاعدة معرفة المشروع، أما هذه الصفحة فهي معاينة لواجهة العملاء فقط."}
];
function demoAnswer(question:string):string {
 return demoReplies.find(x=>x.match.test(question))?.reply||
 "أهلًا بك! هذه تجربة توضيحية لواجهة خدمة العملاء من AGENT. بعد ربط مشروع حقيقي وإضافة قاعدة المعرفة، ستظهر الإجابات المعتمدة الخاصة بهذا المشروع بدل الردود التجريبية.";
}
let seed=0;
export default function CustomerChatPage(){
 const [widgetKey,setWidgetKey]=useState("");
 const [ready,setReady]=useState(false);
 const [messages,setMessages]=useState<ChatMessage[]>([
  {id:++seed,kind:"assistant",body:"أهلًا وسهلًا 👋 كيف أقدر أساعدك النهارده؟"}
 ]);
 const [draft,setDraft]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [session,setSession]=useState<VisitorSession|null>(null);
 const boxRef=useRef<HTMLDivElement>(null);
 const live=widgetKey.length===48;
 useEffect(()=>{
  const key=new URLSearchParams(window.location.search).get("key")||"";
  setWidgetKey(/^[a-f0-9]{48}$/.test(key)?key:"");
  setReady(true);
 },[]);
 useEffect(()=>{boxRef.current?.scrollTo({top:boxRef.current.scrollHeight,behavior:"smooth"});},[messages,busy]);
 function add(kind:ChatMessage["kind"],body:string){setMessages(v=>[...v,{id:++seed,kind,body}]);}
 async function call(path:string,data:unknown){
  const res=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),cache:"no-store"});
  const parsed=await res.json() as Reply & Partial<VisitorSession>;
  if(!res.ok)throw new Error(parsed.error||"تعذر الاتصال بخدمة العملاء");
  return parsed;
 }
 async function getVisitorSession():Promise<VisitorSession>{
  if(session)return session;
  const result=await call("/api/support/public/sessions",{widgetKey});
  if(!result.conversationId||!result.visitorToken)throw new Error("تعذر بدء جلسة العملاء");
  const value={conversationId:result.conversationId,visitorToken:result.visitorToken};
  setSession(value);
  return value;
 }
 async function submit(e?:FormEvent){
  e?.preventDefault();
  const question=draft.trim();
  if(!question||busy||!ready)return;
  setDraft("");setNotice("");add("visitor",question);
  setBusy(true);
  try {
   if(!live){add("assistant",demoAnswer(question));return;}
   const current=await getVisitorSession();
   const result=await call("/api/support/public/messages",{widgetKey,...current,text:question});
   add("assistant",result.answer||"لم تتوفر إجابة مؤكدة حاليًا. يرجى التواصل مع موظف الدعم.");
  }catch(e){setNotice(e instanceof Error?e.message:"تعذر الرد الآن. حاول لاحقًا.");}
  finally{setBusy(false);}
 }
 function reset(){setMessages([{id:++seed,kind:"assistant",body:"أهلًا وسهلًا 👋 كيف أقدر أساعدك النهارده؟"}]);setSession(null);setNotice("");setDraft("");}
 return <main className="customer-surface" dir="rtl">
  <style>{`
   .customer-surface{min-height:100vh;background:radial-gradient(circle at 8% 7%,#e0f4fc,transparent 38%),radial-gradient(circle at 95% 100%,#dceeea,transparent 38%),#f7fafc;color:#1b3540;font-family:inherit;padding:36px 18px}
   .customer-main{max-width:1100px;margin:auto;display:grid;grid-template-columns:minmax(290px,.9fr) minmax(350px,1.15fr);gap:36px;align-items:center;min-height:calc(100vh - 72px)}
   .customer-brand{display:flex;gap:9px;align-items:center;color:#087b8f;font-weight:900;font-size:19px;margin-bottom:34px}
   .customer-brand span{display:inline-flex;background:#d8f6f2;width:38px;height:38px;align-items:center;justify-content:center;border-radius:12px}
   .customer-copy h1{font-size:clamp(31px,4vw,55px);line-height:1.18;margin:12px 0 20px;letter-spacing:-1px}
   .customer-copy p{font-size:17px;line-height:1.9;color:#53717c;max-width:480px}
   .customer-feature{display:flex;align-items:center;gap:11px;font-size:14px;margin-top:19px;font-weight:700;color:#365e68}
   .customer-feature svg{color:#079d83}
   .customer-chat{box-shadow:0 25px 80px #173a4830;border:1px solid #dbe8ea;border-radius:23px;background:#fff;overflow:hidden;display:flex;flex-direction:column;height:min(750px,calc(100vh - 72px));min-height:520px}
   .customer-head{display:flex;align-items:center;gap:12px;padding:20px 23px;background:#0b5f76;color:white}
   .customer-avatar{width:44px;height:44px;display:grid;place-items:center;background:#ffffff24;border:1px solid #ffffff40;border-radius:15px}
   .customer-status{font-size:12px;color:#bde6e4;margin-top:4px}
   .customer-reset{margin-right:auto;display:grid;place-items:center;border:1px solid #ffffff5b;border-radius:12px;color:#fff;background:#ffffff15;width:36px;height:36px;cursor:pointer}
   .customer-mode{padding:12px 20px;font-size:12px;line-height:1.7;border-bottom:1px solid #e6edef;background:#fff9e9;color:#825b19}
   .customer-mode.live{background:#f0fcf7;color:#087d63}
   .customer-messages{overflow:auto;flex:1;display:flex;flex-direction:column;gap:16px;padding:24px;background:linear-gradient(180deg,#f8fcfd,#fff)}
   .customer-msg{max-width:86%;padding:14px 17px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;border-radius:17px;box-shadow:0 2px 8px #12415408}
   .customer-msg.assistant{align-self:flex-start;background:#e9f4f7;border-top-right-radius:4px}
   .customer-msg.visitor{align-self:flex-end;background:#0b758b;color:#fff;border-top-left-radius:4px}
   .customer-thinking{align-self:flex-start;padding:12px 17px;border-radius:16px;background:#e9f4f7;color:#65838c;font-size:13px}
   .customer-notice{margin:0 20px;padding:10px;color:#9f3535;background:#fff0f0;border-radius:12px;font-size:13px}
   .customer-suggestions{display:flex;flex-wrap:wrap;gap:8px;padding:12px 19px 4px}
   .customer-suggestions button{padding:9px 13px;font-size:12px;color:#1c6b7b;border:1px solid #cde2e7;background:#fff;border-radius:25px;cursor:pointer}
   .customer-form{padding:16px;display:flex;gap:10px;align-items:center}
   .customer-form input{width:100%;flex:1;min-width:0;border:1px solid #d1dfe3;background:#f9fcfd;border-radius:15px;padding:15px;color:#1b3540;font:inherit;outline:none}
   .customer-form input:focus{border-color:#0d859d}
   .customer-form button{background:#0d758b;color:white;border:0;border-radius:14px;width:50px;height:50px;display:grid;place-items:center;cursor:pointer}
   .customer-form button:disabled{opacity:.45;cursor:not-allowed}
   .customer-foot{font-size:11px;color:#869da5;padding:0 20px 15px;text-align:center}
   @media(max-width:850px){.customer-main{grid-template-columns:1fr;max-width:600px;gap:20px}.customer-copy h1{font-size:32px}.customer-copy p,.customer-feature{display:none}.customer-brand{margin-bottom:10px}.customer-chat{height:min(660px,80vh);min-height:490px}.customer-surface{padding:18px 12px}}
  `}</style>
  <div className="customer-main">
   <div className="customer-copy">
    <div className="customer-brand"><span><Sparkles size={21}/></span> AGENT <small style={{fontWeight:500,color:"#668793",fontSize:13}}>Customer Experience</small></div>
    <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"9px 13px",borderRadius:30,background:"#dff6f1",color:"#00795c",fontSize:12,fontWeight:700}}><Headphones size={15}/> الدعم الذكي</div>
    <h1>إجابات واضحة.<br/><span style={{color:"#0b8295"}}>خدمة أسرع.</span></h1>
    <p>اسأل عن المنتجات والخدمات أو تفاصيل الطلب، وتواصل مع مساعد العملاء من مكان واحد.</p>
    <div className="customer-feature"><CheckCircle2 size={19}/> واجهة عربية تدعم المحادثة المباشرة</div>
    <div className="customer-feature"><ShieldCheck size={19}/> معرفة مستقلة لكل مشروع عند تفعيل الاتصال</div>
    <div className="customer-feature"><MessageCircle size={19}/> إمكانية متابعة المحادثات من لوحة AGENT بعد التفعيل</div>
   </div>
   <section className="customer-chat" aria-label="تجربة محادثة خدمة العملاء">
    <div className="customer-head">
     <div className="customer-avatar"><Headphones size={22}/></div>
     <div><strong>مساعد خدمة العملاء</strong><div className="customer-status">{live?"قناة المشروع — الاتصال قيد التحقق":"معاينة تصميم العملاء"}</div></div>
     <button className="customer-reset" title="بدء محادثة جديدة" aria-label="بدء محادثة جديدة" onClick={reset}><RotateCcw size={17}/></button>
    </div>
    <div className={"customer-mode"+(live?" live":"")}>
     {live?"وضع مشروع حقيقي: يتطلب تفعيل الشات العام ومطابقة نطاق الموقع في إعدادات AGENT.":"وضع تجريبي — الإجابات هنا أمثلة توضيحية، وليست ذكاءً اصطناعيًا متصلًا ببيانات عملاء حقيقية."}
    </div>
    <div className="customer-messages" ref={boxRef} role="log" aria-live="polite">
     {messages.map(m=><div className={"customer-msg "+m.kind} key={m.id}>{m.body}</div>)}
     {busy&&<div className="customer-thinking">جارٍ إعداد الرد…</div>}
    </div>
    {notice&&<p className="customer-notice" role="alert">{notice}</p>}
    <div className="customer-suggestions">
     {["ما هي الأسعار؟","ما مواعيد العمل؟","عايز أكلم موظف"].map(q=>
      <button key={q} type="button" onClick={()=>setDraft(q)} disabled={busy}>{q}</button>
     )}
    </div>
    <form className="customer-form" onSubmit={submit}>
     <input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={1500} disabled={busy} placeholder="اكتب سؤالك هنا..." aria-label="رسالة العميل"/>
     <button aria-label="إرسال" type="submit" disabled={!draft.trim()||busy}><ArrowUp size={21}/></button>
    </form>
    <div className="customer-foot">مدعوم بواسطة AGENT {live?"• لا تشارك معلومات حساسة في المحادثة":"• نسخة عرض تجريبية"}</div>
   </section>
  </div>
 </main>;
}
