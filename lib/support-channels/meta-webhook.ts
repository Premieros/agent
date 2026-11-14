import {createHmac,timingSafeEqual} from "node:crypto";

/** Provider payloads are untrusted. Parsing never provisions access or sends a reply. */
export type SupportMetaChannel="whatsapp"|"messenger"|"instagram";
export type SupportMetaTextEvent={
 channel:SupportMetaChannel;
 accountId:string;
 senderId:string;
 messageId:string;
 text:string;
};
const id=(x:unknown)=>typeof x==="string"&&/^[A-Za-z0-9._:+-]{2,150}$/.test(x)?x:null;
const record=(v:unknown):Record<string,unknown>|null=>
 v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;
const list=(x:unknown):unknown[]=>Array.isArray(x)?x.slice(0,80):[];
const bodyText=(text:unknown):string|null=>
 typeof text==="string"&&text.trim().length>0&&text.length<=1500?text.trim():null;

/** Constant-time HMAC check over the EXACT HTTP request body. */
export function verifyMetaSignature(raw:string,signature:string|null,appSecret:string|undefined):boolean{
 if(!appSecret||appSecret.length<16||!signature||!/^sha256=[a-f0-9]{64}$/i.test(signature))return false;
 const claimed=Buffer.from(signature.slice(7),"hex");
 const actual=createHmac("sha256",appSecret).update(raw,"utf8").digest();
 return claimed.length===actual.length&&timingSafeEqual(actual,claimed);
}

/** Constant-time verification for Meta's hub.challenge subscription handshake. */
export function verifyMetaSubscription(
 mode:string|null,token:string|null,challenge:string|null,configured:string|undefined
):string|null{
 if(mode!=="subscribe"||!configured||configured.length<16||!token||!challenge||
    challenge.length>256||!/^[A-Za-z0-9._-]+$/.test(challenge))return null;
 const a=Buffer.from(configured),b=Buffer.from(token);
 if(a.length!==b.length||!timingSafeEqual(a,b))return null;
 return challenge;
}

/**
 * Distinguish account IDs before tenant/project lookup.
 * WhatsApp: phone_number_id from change.value.metadata.
 * Messenger / Instagram: entry.id (the subscribed business account).
 * No outgoing messages and no customer lookup occur here.
 */
export function parseMetaTextEvents(payload:unknown):SupportMetaTextEvent[]{
 const root=record(payload);if(!root)return [];
 const object=root.object;
 const channel:SupportMetaChannel|null=object==="whatsapp_business_account"?"whatsapp":
   object==="page"?"messenger":object==="instagram"?"instagram":null;
 if(!channel)return [];
 const result:SupportMetaTextEvent[]=[];
 const seen=new Set<string>();
 for(const entryValue of list(root.entry)){
  const entry=record(entryValue);if(!entry)continue;
  if(channel==="whatsapp"){
   for(const changeValue of list(entry.changes)){
    const change=record(changeValue);
    if(!change||change.field!=="messages")continue;
    const value=record(change.value),meta=record(value?.metadata);
    const accountId=id(meta?.phone_number_id);if(!accountId)continue;
    for(const messageValue of list(value?.messages)){
     const msg=record(messageValue);
     if(!msg||msg.type!=="text")continue;
     const senderId=id(msg.from),messageId=id(msg.id),text=bodyText(record(msg.text)?.body);
     if(!senderId||!messageId||!text)continue;
     const identity=channel+":"+accountId+":"+messageId;
     if(seen.has(identity))continue;seen.add(identity);
     result.push({channel,accountId,senderId,messageId,text});
     if(result.length>=40)return result;
    }
   }
  }else{
   const accountId=id(entry.id);if(!accountId)continue;
   for(const eventValue of list(entry.messaging)){
    const event=record(eventValue),message=record(event?.message);
    if(!message||message.is_echo===true)continue;
    const senderId=id(record(event?.sender)?.id);
    const messageId=id(message.mid);
    const text=bodyText(message.text);
    if(!senderId||!messageId||!text)continue;
    const identity=channel+":"+accountId+":"+messageId;
    if(seen.has(identity))continue;seen.add(identity);
    result.push({channel,accountId,senderId,messageId,text});
    if(result.length>=40)return result;
   }
  }
 }
 return result;
}
