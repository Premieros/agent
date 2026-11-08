import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizedSupportText,selectSupportSources,requiresVerifiedProjectKnowledge} from "../lib/support-preview-knowledge.ts";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const docs=[
 {id:"p1",title:"إضافة منتج جديد",content:"يمكن إضافة منتج من شاشة الأصناف بعد التحقق من صلاحيات الفرع."},
 {id:"p2",title:"تقارير المشروع",content:"طريقة قراءة تقرير حركة المبيعات."}
];

test("Arabic normalization removes vowel marks and normalizes spelling",()=>{
 assert.equal(normalizedSupportText("مُنْتَجًا جَدِيدًا"),"منتجا جديدا");
 assert.equal(normalizedSupportText("إضافة الأصناف"),"اضافه الاصناف");
});

test("Arabic customer questions find approved documents despite tanween",()=>{
 const found=selectSupportSources("كيف أضيف مُنتَجًا جديدًا؟",docs);
 assert.equal(found[0]?.id,"p1");
 assert.ok(found.length>0);
});

test("knowledge matching is limited to supplied project's documents",()=>{
 assert.deepEqual(selectSupportSources("كيف أضيف منتجًا؟",[]),[]);
 assert.deepEqual(selectSupportSources("كيف أضيف منتجًا؟",docs.filter(d=>d.id==="p2")),[]);
});

test("unverified pricing, policies and account information require project sources",()=>{
 for(const q of ["كم سعر الاشتراك؟","ما سياسة الاسترداد؟","ما رصيدي؟","What's your pricing and refund policy?"])
  assert.equal(requiresVerifiedProjectKnowledge(q),true,q);
 assert.equal(requiresVerifiedProjectKnowledge("كيف أضيف منتجًا جديدًا؟"),false);
});

test("preview no longer refuses generic questions before reaching AI",()=>{
 const source=read("app/api/support/preview/route.ts");
 assert.match(source,/const grounded=matched\.length>0/);
 assert.match(source,/!grounded&&requiresVerifiedProjectKnowledge/);
 assert.match(source,/mode:grounded\?"ai":"general-guidance"/);
 assert.match(source,/answerSupportWithFreeModels/);
 assert.doesNotMatch(source,/لا أجد معلومة معتمدة تجيب عن هذا السؤال في ملفات المشروع/);
 assert.match(source,/eq\("organization_id",session\.organizationId\)/);
 assert.match(source,/eq\("project_id",project\.id\)/);
});
