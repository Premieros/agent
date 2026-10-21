import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {
 validMetaSignature,safeEqual,extractWhatsAppMessages,withinServiceWindow,
 whatsappPilotTriggered,WHATSAPP_PILOT_ACK
} from "@/lib/agent-whatsapp";

export const runtime="nodejs";
export const maxDuration=45;
const quiet=(status=200)=>new NextResponse(null,{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const phoneId=/^[0-9]{5,25}$/;
const MAX_BODY=64_000;

/** Meta subscribes its chosen WhatsApp Business Account to this callback.
 * Verification must not grant access to customer data or test the send token.
 */
export async function GET(req:NextRequest){
 const token=process.env.AGENT_WHATSAPP_VERIFY_TOKEN||"";
 const params=new URL(req.url).searchParams;
 const given=params.get("hub.verify_token")||"";
 const challenge=params.get("hub.challenge")||"";
 if(!token||token.length<16||params.get("hub.mode")!=="subscribe"||
   !given||!safeEqual(token,given)||!/^[0-9]{1,100}$/.test(challenge))
  return quiet(403);
 return new NextResponse(challenge,{
  status:200,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}
 });
}
type Receipt={
 claimed:boolean;conversation_id?:string;mode?:string;
 keyword_enabled?:boolean;keyword?:string;
};
function agentDatabase(){
 const project="gldlgdycgneadbqftcrj";
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
 const key=process.env.AGENT_WHATSAPP_DB_KEY||"";
 const org=process.env.AGENT_WHATSAPP_ORGANIZATION_ID||"";
 if(!url||!key||!uuid.test(org))return null;
 if(new URL(url).hostname!==project+".supabase.co")return null;
 return {org,db:createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
}
async function sendPilotAck(phone:string){
 const id=process.env.AGENT_WHATSAPP_PHONE_NUMBER_ID||"";
 const token=process.env.AGENT_WHATSAPP_ACCESS_TOKEN||"";
 const version=process.env.AGENT_WHATSAPP_GRAPH_VERSION||"v23.0";
 if(!phoneId.test(id)||!token||!/^v[0-9]{1,2}\.0$/.test(version))
  throw new Error("WHATSAPP_SEND_NOT_CONFIGURED");
 const abort=new AbortController();
 const timeout=setTimeout(()=>abort.abort(),12000);
 try{
  const response=await fetch("https://graph.facebook.com/"+version+"/"+id+"/messages",{
   method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify({messaging_product:"whatsapp",recipient_type:"individual",
    to:phone,type:"text",text:{preview_url:false,body:WHATSAPP_PILOT_ACK}}),
   signal:abort.signal,cache:"no-store"
  });
  if(!response.ok)throw new Error("META_SEND_FAILED");
  const result=await response.json() as {messages?:Array<{id?:string}>};
  const messageId=result.messages?.[0]?.id||"";
  if(!messageId||messageId.length>250)throw new Error("META_NO_MESSAGE_ID");
  return messageId;
 }finally{clearTimeout(timeout);}
}
export async function POST(req:NextRequest){
 const secret=process.env.AGENT_WHATSAPP_META_APP_SECRET||"";
 const expectedId=process.env.AGENT_WHATSAPP_PHONE_NUMBER_ID||"";
 if(secret.length<16||!phoneId.test(expectedId))return quiet(503);
 if(Number(req.headers.get("content-length"))>MAX_BODY)return quiet(413);
 const body=Buffer.from(await req.arrayBuffer());
 if(body.length>MAX_BODY)return quiet(413);
 if(!validMetaSignature(body,secret,req.headers.get("x-hub-signature-256")))
  return quiet(401);
 let parsed:unknown;
 try{parsed=JSON.parse(body.toString("utf8"));}catch{return quiet(400);}
 const events=extractWhatsAppMessages(parsed).filter(m=>m.phoneNumberId===expectedId);
 if(!events.length)return quiet(200); // Meta statuses and other phone IDs are not customer messages.
 const connection=agentDatabase();
 if(!connection)return quiet(503);
 for(const event of events){
  const text=event.text||("[رسالة غير نصية: "+event.type.slice(0,32)+"]");
  const {data,error}=await connection.db.rpc("agent_claim_whatsapp_incoming",{
   p_organization_id:connection.org,p_message_id:event.messageId,p_sender:event.sender,
   p_customer_name:event.name,p_body:text
  });
  if(error)return quiet(503);
  const receipt=data as Receipt|null;
  // Duplicates, human-owned chats, disabled rules and all other messages are saved only.
  if(!receipt?.claimed||receipt.mode!=="ai"||receipt.keyword_enabled!==true||
    !whatsappPilotTriggered(event.text,receipt.keyword||"#مساعد")||
    !withinServiceWindow(event.timestamp)||
    process.env.AGENT_WHATSAPP_PILOT_SEND_ENABLED!=="true")
   continue;
  // One-way state transition before the provider call prevents duplicate replies
  // when Meta re-delivers a webhook or network delivery status is ambiguous.
  const {data:claimed,error:claimError}=await connection.db
   .from("agent_whatsapp_pilot_events")
   .update({reply_state:"sending",updated_at:new Date().toISOString()})
   .eq("organization_id",connection.org).eq("external_message_id",event.messageId)
   .eq("reply_state","none").select("id").maybeSingle();
  if(claimError)return quiet(503);
  if(!claimed)continue;
  try{
   const sentId=await sendPilotAck(event.sender);
   const {error:sentError}=await connection.db.from("agent_whatsapp_pilot_events")
    .update({reply_state:"sent",reply_external_id:sentId,updated_at:new Date().toISOString()})
    .eq("id",claimed.id).eq("organization_id",connection.org).eq("reply_state","sending");
   if(sentError)throw new Error("WHATSAPP_MESSAGE_TRACKING_FAILED");
   const {error:messageError}=await connection.db.from("messages").insert({
    organization_id:connection.org,conversation_id:receipt.conversation_id,
    direction:"outgoing",author_type:"ai",body:WHATSAPP_PILOT_ACK,
    external_message_id:sentId
   });
   if(messageError)throw new Error("WHATSAPP_OUTGOING_RECORD_FAILED");
  }catch{
   // Provider could already have sent the message. Never retry automatically.
   await connection.db.from("agent_whatsapp_pilot_events")
    .update({reply_state:"failed",updated_at:new Date().toISOString()})
    .eq("id",claimed.id).eq("organization_id",connection.org)
    .eq("reply_state","sending");
   console.warn("AGENT WhatsApp pilot send/record failed; no automatic retry.");
  }
 }
 return quiet(200);
}
