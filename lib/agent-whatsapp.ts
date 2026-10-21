/** Pure guardrails and rules for the official Meta WhatsApp Cloud API.
 * No direct external sends or model calls from this module.
 */
import {createHmac,timingSafeEqual} from "node:crypto";

export type WhatsAppFaq={question:string;answer:string};
export type IncomingWhatsApp={
 phoneNumberId:string;messageId:string;sender:string;name:string;
 text:string|null;type:string;timestamp:number;
};
export function safeEqual(a:string,b:string):boolean{
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&timingSafeEqual(x,y);
}
export function validMetaSignature(raw:Buffer,secret:string,signature:string|null){
 if(!secret||!signature||!/^sha256=[0-9a-f]{64}$/i.test(signature))return false;
 const expected="sha256="+createHmac("sha256",secret).update(raw).digest("hex");
 return safeEqual(expected,signature.toLowerCase());
}
export function extractWhatsAppMessages(payload:unknown):IncomingWhatsApp[]{
 if(!payload||typeof payload!=="object")return [];
 const root=payload as {object?:unknown;entry?:unknown};
 if(root.object!=="whatsapp_business_account"||!Array.isArray(root.entry))return [];
 const out:IncomingWhatsApp[]=[];
 for(const entry of root.entry.slice(0,8)){
  const changes=(entry as {changes?:unknown})?.changes;
  if(!Array.isArray(changes))continue;
  for(const change of changes.slice(0,5)){
   const c=change as {field?:unknown;value?:unknown};
   if(c.field!=="messages"||!c.value||typeof c.value!=="object")continue;
   const v=c.value as Record<string,unknown>;
   const phoneId=(v.metadata as {phone_number_id?:unknown}|undefined)?.phone_number_id;
   const contacts=Array.isArray(v.contacts)?v.contacts:[];
   const messages=Array.isArray(v.messages)?v.messages:[];
   if(typeof phoneId!=="string"||!/^[0-9]{5,25}$/.test(phoneId))continue;
   for(const message of messages.slice(0,8)){
    const m=message as Record<string,unknown>;
    const sender=m.from,id=m.id,type=m.type,stamp=m.timestamp;
    if(typeof sender!=="string"||!/^[0-9]{7,20}$/.test(sender)||
      typeof id!=="string"||!/^wamid\.[a-zA-Z0-9._=-]{5,230}$/.test(id)||
      typeof type!=="string")continue;
    const value=type==="text"?(m.text as {body?:unknown}|undefined)?.body:null;
    const text=typeof value==="string"&&value.trim().length>0?
     value.trim().slice(0,3000):null;
    const ts=Number(stamp);
    const contact=contacts.find((x:{wa_id?:unknown})=>x.wa_id===sender) as
      {profile?:{name?:unknown}}|undefined;
    const name=typeof contact?.profile?.name==="string"?
      contact.profile.name.trim().slice(0,100):"عميل واتساب";
    if(!Number.isSafeInteger(ts)||ts<=0)continue;
    out.push({phoneNumberId:phoneId,messageId:id,sender,name,
      text,type,timestamp:ts});
    if(out.length>=12)return out;
   }
  }
 }
 return out;
}
export function withinServiceWindow(timestamp:number,now=Date.now()){
 return Number.isSafeInteger(timestamp)&&timestamp*1000<=now+5*60_000&&
  timestamp*1000>=now-24*60*60_000+60_000;
}
function normalize(value:string){
 return value.normalize("NFKC").toLowerCase().replace(/[\u064b-\u065f\u0670]/g,"")
  .replace(/[إأآ]/g,"ا").replace(/ة/g,"ه").replace(/\s+/g," ").trim();
}
export function sanitizeWhatsAppFaq(input:unknown):WhatsAppFaq[]{
 if(!Array.isArray(input)||input.length>12)throw Error("INVALID_FAQ");
 return input.map(item=>{
  if(!item||typeof item!=="object")throw Error("INVALID_FAQ");
  const r=item as Record<string,unknown>;
  const question=typeof r.question==="string"?r.question.trim():"";
  const answer=typeof r.answer==="string"?r.answer.trim():"";
  if(question.length<2||question.length>100||answer.length<2||answer.length>900)
   throw Error("INVALID_FAQ");
  return {question,answer};
 });
}
export function decideWhatsAppReply(text:string|null,faq:WhatsAppFaq[],
 welcome:string):{kind:"reply"|"handoff"|"ignore";reply:string;reason:string}{
 if(!text)return {kind:"handoff",reply:"",reason:"unsupported_message"};
 const message=normalize(text).slice(0,3000);
 if(/(^|\s)(موظف|انسان|بشري|خدمه العملاء|مندوب|اكلم حد)(\s|$)/u.test(message))
  return {kind:"handoff",reply:"",reason:"requested_human"};
 for(const item of faq){
  const key=normalize(item.question);
  if(key.length>=2&&(message===key||message.includes(key))){
   return {kind:"reply",reply:item.answer.slice(0,900),reason:"verified_faq"};
  }
 }
 if(/^(اهلا|اهلين|مرحبا|السلام عليكم|وعليكم السلام|صباح الخير|مساء الخير|هاي|hello|hi|start|بدء)[!؟?.\s]*$/u.test(message)
  &&welcome.trim().length>1)
  return {kind:"reply",reply:welcome.trim().slice(0,900),reason:"welcome"};
 return {kind:"handoff",reply:"",reason:"unanswered_question"};
}
