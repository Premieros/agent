import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("terminal shows actual approved sandbox commands and bounded stdout",()=>{
 const api=read("app/api/assistant/work/route.ts");
 assert.match(api,/Sandbox\.create\(\{timeout:22_000,networkPolicy:"deny-all"\}\)/);
 assert.match(api,/sandbox\.runCommand\("node",\["--check","work\.js"\]\)/);
 assert.match(api,/sandbox\.runCommand\("node",\["work\.js"\]\)/);
 assert.match(api,/await result\.stdout\(\)/);
 assert.match(api,/await result\.stderr\(\)/);
 assert.match(api,/execution_log:executionLog\.slice\(0,7600\)/);
 assert.doesNotMatch(api,/runCommand\("sh"|runCommand\("bash"/);
});

test("terminal is pollable only by thread owner",()=>{
 const api=read("app/api/assistant/work/route.ts");
 assert.match(api,/requireAgentSession\(req\)/);
 assert.match(api,/\.eq\("organization_id",organizationId\)\.eq\("user_id",userId\)/);
 assert.match(api,/execution_log"\)/);
 const chat=read("components/general-assistant.tsx");
 assert.match(chat,/agent-work-stdout/);
 assert.match(chat,/pendingWork\.execution_log/);
 assert.match(chat,/setInterval\(\(\)=>\{void loadWorkState\(threadId\);\},1400\)/);
 assert.match(chat,/setPendingWork\(\{\.\.\.run,status:"running"/);
 assert.match(chat,/ليس التفكير الداخلي/);
});

test("save experiment artifacts in private existing library, never public GitHub",()=>{
 const api=read("app/api/assistant/work/route.ts");
 assert.match(api,/body\.action==="save_artifact"/);
 assert.match(api,/assistant_library_items/);
 assert.match(api,/storage\.upload\(path,bytes/);
 assert.match(api,/contentType:"text\/markdown"/);
 assert.match(api,/run\.code/);
 assert.match(api,/run\.execution_log/);
 assert.match(api,/\.eq\("user_id",userId\)/);
 assert.doesNotMatch(api,/git\s+push|gh\s+pr\s+create|git\.clone|GITHUB_TOKEN|service.role/i);
 const chat=read("components/general-assistant.tsx");
 assert.match(chat,/saveWorkArtifact/);
 assert.match(chat,/حفظ الكود والسجل/);
});

test("GitHub connection clearly documents public read-only scope",()=>{
 const api=read("app/api/assistant/github/route.ts");
 assert.match(api,/verifyPublicRepository/);
 assert.match(api,/mode:"public-read-only"/);
 assert.doesNotMatch(api,/create_pull_request|GITHUB_TOKEN|OAuth/);
 const ui=read("components/github-connection-panel.tsx");
 assert.match(ui,/قراءة كوده/);
 assert.match(ui,/Vercel Sandbox/);
 assert.match(ui,/لا يمنح AGENT صلاحية كتابة/);
});
