import test from "node:test";
import assert from "node:assert/strict";
import {johnaPublicAnswer} from "../lib/johna-public-help.ts";

test("Johna-S employees receive safe troubleshooting for an unsaved order",()=>{
 const answer=johnaPublicAnswer("الاودر مش بيسجل");
 assert.ok(answer,"should not silently hand off common order errors");
 assert.match(answer,/سجل|قائمة الطلبات/);
 assert.match(answer,/لا تكرر/);
});

test("Johna-S still hands sensitive backend and credential questions to staff",()=>{
 assert.equal(johnaPublicAnswer("عايز كود قاعدة البيانات"),null);
 assert.equal(johnaPublicAnswer("ممكن تفاصيل صلاحيات super admin؟"),null);
});

test("unknown questions still require staff instead of a guessed project fact",()=>{
 assert.equal(johnaPublicAnswer("ممكن سياسة استرداد الفواتير؟"),null);
});
