import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {describeWorkEvidence,workEvidenceReport} from "../lib/agent-work-evidence.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("a real failing Node.js assertion is explained without claiming success",()=>{
  const log=[
    "2026-10-20T11:17:37Z node:assert:150",
    "AssertionError [ERR_ASSERTION]: should be one task after delete",
    "0 !== 1",
    "at Object.<anonymous> (/workspace/work.js:36:8)",
    "[exit=1]"
  ].join("\n");
  const e=describeWorkEvidence({
    status:"executed",attempted:true,succeeded:false,
    log,runner:"github"
  });
  assert.equal(e.failed,true);
  assert.equal(e.passed,false);
  assert.match(e.cause,/0/);
  assert.match(e.cause,/1/);
  assert.match(e.next,/وظيفة الحذف وشرط الاختبار/);
  const report=workEvidenceReport({
    status:"executed",attempted:true,succeeded:false,log,runner:"github"
  });
  assert.match(report,/فشل/);
  assert.match(report,/لم يُنشر/);
  assert.doesNotMatch(report,/اكتمل التطبيق بنجاح|اختبرنا كل الحالات/);
});

test("success means only executed tests passed, not a fully correct app",()=>{
  const e=describeWorkEvidence({status:"completed",attempted:true,succeeded:true,
    log:"PASS\n[exit=0]",runner:"github"});
  assert.equal(e.passed,true);
  assert.match(e.cause,/لا تثبت/);
});
test("missing evidence is not reported as passed",()=>{
  const e=describeWorkEvidence({status:"executed",attempted:false,succeeded:null,
    log:"Failed to retrieve job log",runner:"github"});
  assert.equal(e.passed,false);
  assert.equal(e.failed,false);
  assert.match(e.phase,/لا يوجد دليل/);
});
test("syntax, missing-module and timeout are not confused with failed assertions",()=>{
  for(const [log,pattern] of [
    ["SyntaxError: Unexpected token","صياغة"],
    ["Error: Cannot find module 'some-package'","استيراد"],
    ["[exit=124]","المهلة"]
  ]){
    const e=describeWorkEvidence({status:"failed",attempted:true,succeeded:false,
      log,runner:"sandbox"});
    assert.match(e.cause,new RegExp(pattern));
  }
});

test("GitHub completion finalizes to a deterministic chat answer, not another paid AI call",()=>{
  const api=read("app/api/assistant/work/route.ts");
  assert.match(api,/workEvidenceReport\(/);
  assert.match(api,/if\(run\.github_request_id\|\|/);
  assert.match(api,/model="agent-execution-evidence"/);
  const ui=read("components/general-assistant.tsx");
  assert.match(ui,/finalizedWorkRef\.current\.add\(pendingWork\.id\)/);
  assert.match(ui,/void finishWork\(pendingWork,threadId\)/);
  assert.match(ui,/className="agent-work-verdict"/);
  assert.match(ui,/عرض سجل الأوامر التقني/);
  assert.match(ui,/useState\(false\)/);
});

test("repair proposal uses real owned run, original source and logs with limits",()=>{
  const api=read("app/api/assistant/work/route.ts");
  assert.match(api,/body\.action==="repair"/);
  assert.match(api,/run\.sandbox_succeeded!==false/);
  assert.match(api,/\.eq\("organization_id",organizationId\)/);
  assert.match(api,/\.eq\("user_id",userId\)/);
  assert.match(api,/previousLog=String\(run\.execution_log\|\|""\)\.slice\(-5200\)/);
  assert.match(api,/corrected\.code\.trim\(\)===run\.code\.trim\(\)/);
  assert.match(api,/status:"planned",model:revised\.model/);
  assert.match(api,/count\|\|0\)>=3/);
  const ui=read("components/general-assistant.tsx");
  assert.match(ui,/اقترح إصلاحًا وراجعه/);
  assert.match(ui,/onClick=\{\(\)=>void proposeWorkRepair\(pendingWork\)\}/);
  assert.match(ui,/setPendingWork\(\{id:data\.run\.id,status:"planned"/);
  assert.doesNotMatch(api.slice(api.indexOf('if(body.action==="repair")'),
    api.indexOf('if(body.action==="save_artifact")')),/dispatchAgentExperiment|Sandbox\.create/);
});
