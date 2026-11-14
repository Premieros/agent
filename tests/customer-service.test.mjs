import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("customer service pages remain",()=>{
  for(const path of ["app/crm/page.tsx","app/crm/inbox/page.tsx","components/live-crm.tsx","components/live-inbox.tsx"])
    assert.ok(existsSync(new URL("../"+path,import.meta.url)),path);
  assert.match(read("app/page.tsx"),/redirect\("\/crm"\)/);
});
test("inbox retains actual message and handoff workflows",()=>{
  const inbox=read("components/live-inbox.tsx");
  for(const name of ["create_internal_thread","add_internal_note","takeover_conversation","handoff_tasks"])
    assert.ok(inbox.includes(name),name);
});
test("no removed navigation or public code execution API",()=>{
  for(const path of ["app/studio/page.tsx","app/assistant/page.tsx","app/api/assistant/work/route.ts",".github/workflows/agent-experiment.yml"])
    assert.ok(!existsSync(new URL("../"+path,import.meta.url)),path);
  for(const source of ["components/live-crm.tsx","components/live-inbox.tsx"])
    assert.doesNotMatch(read(source),/href="\/(?:studio|assistant)"/);
});
test("reply rule requires authenticated agent session",()=>{
  assert.match(read("app/api/assistant/reply-rule/route.ts"),/requireAgentSession\(req\)/);
});
