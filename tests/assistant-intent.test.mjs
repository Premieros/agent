import test from "node:test";
import assert from "node:assert/strict";
import {detectAgentIntent,requiresApproval} from "../lib/assistant-intent.ts";

test("workspace sections are opened from normal Arabic chat commands",()=>{
  const cases=[
    ["اعرض مساحة العمل","workspace-overview"],
    ["اعرض العملاء","customers-overview"],
    ["اعرض المتابعات","followups-overview"],
    ["اعرض صندوق الوارد","inbox-overview"],
    ["اعرض الإضافات","integrations-overview"],
    ["أضف عميل","workspace-lead-create"]
  ];
  for(const [prompt,intent] of cases){
    assert.equal(detectAgentIntent(prompt),intent,prompt);
    assert.equal(requiresApproval(intent),false,"Read/tool opening never runs a write");
  }
});
test("existing studio, site, learning and work routes are preserved",()=>{
  assert.equal(detectAgentIntent("اعرض صفحات ومهام AGENT"),"studio-overview");
  assert.equal(detectAgentIntent("افحص حالة موقع AGENT"),"site-diagnose");
  assert.equal(detectAgentIntent("اعرض الذاكرة والمهارات"),"learning-list");
  assert.equal(detectAgentIntent("أنشئ مهارة جديدة للمتابعة"),"skill-create");
  assert.equal(detectAgentIntent("شغل الوكلاء"),"studio-run");
  assert.equal(detectAgentIntent("اشرح لي كيفية متابعة العملاء"),"chat");
});
test("writing actions still require deliberate approval",()=>{
  assert.equal(requiresApproval("memory-save"),true);
  assert.equal(requiresApproval("skill-create"),true);
  assert.equal(requiresApproval("studio-run"),true);
  assert.equal(requiresApproval("studio-page-create"),true);
  assert.equal(requiresApproval("site-draft"),true);
  assert.equal(requiresApproval("work"),true);
  assert.equal(requiresApproval("site-diagnose"),false);
  assert.equal(requiresApproval("studio-overview"),false);
});
