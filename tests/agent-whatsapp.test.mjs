import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {readFileSync} from "node:fs";
import {
 validMetaSignature,extractWhatsAppMessages,whatsappPilotTriggered,
 withinServiceWindow,WHATSAPP_PILOT_ACK,decideWhatsAppReply
} from "../lib/agent-whatsapp.ts";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sample=(override={})=>({
 object:"whatsapp_business_account",
 entry:[{changes:[{field:"messages",value:{
  metadata:{phone_number_id:"123456789012"},
  contacts:[{wa_id:"201001234567",profile:{name:"Test Customer"}}],
  messages:[{id:"wamid.HBgLMTIzNDU2Nzg5",from:"201001234567",type:"text",
   text:{body:"#مساعد"},timestamp:"1792590000",...override}]
 }}]}]
});
test("Meta POST requires a valid sha256 HMAC over exactly the raw bytes",()=>{
 const secret="AGENT-test-only-secret-1234567",body=Buffer.from(JSON.stringify(sample()));
 const signature="sha256="+createHmac("sha256",secret).update(body).digest("hex");
 assert.equal(validMetaSignature(body,secret,signature),true);
 assert.equal(validMetaSignature(Buffer.from("tampered"),secret,signature),false);
 assert.equal(validMetaSignature(body,secret,null),false);
 assert.equal(validMetaSignature(body,"wrong",signature),false);
 assert.equal(validMetaSignature(body,secret,"sha1="+signature.slice(7)),false);
});
test("Meta parser only accepts actual incoming customer messages, not delivery statuses",()=>{
 const messages=extractWhatsAppMessages(sample());
 assert.equal(messages.length,1);
 assert.equal(messages[0].sender,"201001234567");
 assert.equal(messages[0].text,"#مساعد");
 assert.equal(messages[0].phoneNumberId,"123456789012");
 assert.equal(extractWhatsAppMessages({
  object:"whatsapp_business_account",entry:[{changes:[{
   field:"messages",value:{metadata:{phone_number_id:"123456789012"},
    statuses:[{id:"wamid.foo",status:"delivered"}]}
  }]}]
 }).length,0);
 assert.equal(extractWhatsAppMessages({object:"page",entry:[]}).length,0);
 assert.equal(extractWhatsAppMessages(sample({from:"not-a-number"})).length,0);
});
test("AGENT keyword only fires at the beginning, not in other customers' chat",()=>{
 for(const x of ["#مساعد","#مساعد عايز استفسر"," #مساعد "])
  assert.equal(whatsappPilotTriggered(x),true,x);
 for(const x of ["مساعد","هل #مساعد موجود؟","سلام","#مساعدة",null])
  assert.equal(whatsappPilotTriggered(x),false,String(x));
 assert.equal(whatsappPilotTriggered("#تجربة اختبار","#تجربة"),true);
 assert.equal(whatsappPilotTriggered("#تجربة2","#تجربة"),false);
 assert.match(WHATSAPP_PILOT_ACK,/AGENT/);
});
test("never send an unsolicited or stale customer-service response",()=>{
 const now=Date.now(),recent=Math.floor((now-2*60_000)/1000);
 assert.equal(withinServiceWindow(recent,now),true);
 assert.equal(withinServiceWindow(recent-26*3600,now),false);
 assert.equal(withinServiceWindow(Math.floor((now+10*60_000)/1000),now),false);
 assert.equal(decideWhatsAppReply("عايز موظف",[],"اهلا").kind,"handoff");
});
test("webhook guards every real-send path with explicit owner opt-in",()=>{
 const route=read("app/api/whatsapp/webhook/route.ts");
 const sql=read("supabase/migrations/20261021_agent_whatsapp_pilot.sql");
 assert.match(route,/AGENT_WHATSAPP_PILOT_SEND_ENABLED!=="true"/);
 assert.match(route,/receipt\.keyword_enabled!==true/);
 assert.match(route,/receipt\.mode!=="ai"/);
 assert.match(route,/validMetaSignature\(body,secret,req\.headers\.get\("x-hub-signature-256"\)\)/);
 assert.match(route,/new URL\(url\)\.hostname!==project\+"\.supabase\.co"/);
 assert.match(route,/reply_state:"sending"/);
 assert.match(route,/reply_state:"sent"/);
 assert.match(sql,/unique \(organization_id,external_message_id\)/);
 assert.match(sql,/grant execute on function public\.agent_claim_whatsapp_incoming/);
 assert.match(sql,/to service_role;/);
 assert.doesNotMatch(route,/console\.log\(.+token|NEXT_PUBLIC_WHATSAPP/);
});
