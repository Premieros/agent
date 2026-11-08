import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {parseMetaTextEvents,verifyMetaSignature,verifyMetaSubscription} from "../lib/support-channels/meta-webhook.ts";

const secret="realistic-test-secret-that-is-not-a-real-credential";
const signature=body=>"sha256="+createHmac("sha256",secret).update(body).digest("hex");

test("rejects forged and malformed Meta signatures; accepts exact raw payload",()=>{
 const raw='{"entry":[],"object":"page"}';
 assert.equal(verifyMetaSignature(raw,signature(raw),secret),true);
 assert.equal(verifyMetaSignature(raw+" ",signature(raw),secret),false);
 assert.equal(verifyMetaSignature(raw,null,secret),false);
 assert.equal(verifyMetaSignature(raw,"sha256=nothex",secret),false);
 assert.equal(verifyMetaSignature(raw,signature(raw),"short"),false);
});

test("verifies Meta subscription token and returns challenge only for exact match",()=>{
 assert.equal(verifyMetaSubscription("subscribe",secret,"123456",secret),"123456");
 assert.equal(verifyMetaSubscription("subscribe",secret+"x","123456",secret),null);
 assert.equal(verifyMetaSubscription("unsubscribe",secret,"123456",secret),null);
 assert.equal(verifyMetaSubscription("subscribe",secret,"evil\ntext",secret),null);
 assert.equal(verifyMetaSubscription("subscribe",secret,"123456",undefined),null);
});

test("parses WhatsApp text messages with correct phone-number routing and dedup",()=>{
 const message={id:"wamid.001",from:"201000000000",type:"text",text:{body:"  مرحبًا  "}};
 const payload={object:"whatsapp_business_account",entry:[{id:"WABA001",changes:[
  {field:"messages",value:{metadata:{phone_number_id:"PHONE123"},messages:[message,message]}}
 ]}]};
 assert.deepEqual(parseMetaTextEvents(payload),[{
  channel:"whatsapp",accountId:"PHONE123",senderId:"201000000000",messageId:"wamid.001",text:"مرحبًا"
 }]);
});

test("accepts Messenger customer text but never echos own outgoing messages",()=>{
 const payload={object:"page",entry:[{id:"PAGE123",messaging:[
  {sender:{id:"CUSTOMER01"},message:{mid:"m_1",text:"I need help"}},
  {sender:{id:"PAGE123"},message:{mid:"m_2",text:"Reply",is_echo:true}},
  {sender:{id:"CUSTOMER01"},message:{mid:"m_3",attachments:[{type:"image"}]}}
 ]}]};
 assert.deepEqual(parseMetaTextEvents(payload),[{
  channel:"messenger",accountId:"PAGE123",senderId:"CUSTOMER01",messageId:"m_1",text:"I need help"
 }]);
});

test("distinguishes Instagram from Facebook Page events",()=>{
 const payload={object:"instagram",entry:[{id:"IG_ACCOUNT01",messaging:[
  {sender:{id:"IG_USER01"},message:{mid:"IG_MSG001",text:"مرحبا"}}
 ]}]};
 assert.equal(parseMetaTextEvents(payload)[0].channel,"instagram");
 assert.equal(parseMetaTextEvents(payload)[0].accountId,"IG_ACCOUNT01");
});

test("rejects unknown payloads and overlong text",()=>{
 assert.deepEqual(parseMetaTextEvents({object:"unknown",entry:[]}),[]);
 assert.deepEqual(parseMetaTextEvents({object:"page",entry:[{id:"P123",messaging:[
  {sender:{id:"C123"},message:{mid:"m_3",text:"x".repeat(1501)}}
 ]}]}),[]);
 assert.deepEqual(parseMetaTextEvents(null),[]);
});
