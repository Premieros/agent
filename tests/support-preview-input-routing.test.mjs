import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isMeaningfulSupportQuestion} from "../lib/support-preview-knowledge.ts";
import {preferSupportConversationModels} from "../lib/support-chat-models.ts";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("preview declines screenshots' punctuation input before model calls",()=>{
 for(const input of ["|||","...","؟؟؟","1234","١٢٣٤","\n - -- "])
  assert.equal(isMeaningfulSupportQuestion(input),false,input);
 for(const input of ["كيف أضيف منتجًا جديدًا؟","How do I create a product?","POS","مرحبا"])
  assert.equal(isMeaningfulSupportQuestion(input),true,input);
 assert.equal(isMeaningfulSupportQuestion("x".repeat(1501)),false);
});
test("prefer conversational models, retain coding models only as late fallback",()=>{
 const candidates=[
  {model:"cohere/north-mini-code:free",provider:"openrouter"},
  {model:"provider/general:free",provider:"openrouter"},
  {model:"provider/chat-instruct:free",provider:"openrouter"},
  {model:"provider/deepseek-coder:free",provider:"openrouter"}
 ];
 const ranked=preferSupportConversationModels(candidates);
 assert.deepEqual(ranked.map(x=>x.model),[
  "provider/chat-instruct:free","provider/general:free",
  "cohere/north-mini-code:free","provider/deepseek-coder:free"
 ]);
 assert.equal(ranked.length,candidates.length);
 assert.equal(ranked[0].provider,"openrouter");
 assert.deepEqual(preferSupportConversationModels([{model:"cohere/north-mini-code:free"}]),
  [{model:"cohere/north-mini-code:free"}]);
});
test("validation and model preferences are used on both server and frontend",()=>{
 const preview=read("app/api/support/preview/route.ts"),ui=read("app/support/page.tsx");
 const service=read("lib/support-auto-ai.ts");
 assert.match(preview,/!isMeaningfulSupportQuestion\(body\.question\)/);
 assert.match(ui,/disabled=\{busy\|\|!isMeaningfulSupportQuestion\(question\)\}/);
 assert.match(service,/preferSupportConversationModels\(candidates\)/);
 assert.match(service,/discoverAutoModels\(allowConditional\)/);
});
