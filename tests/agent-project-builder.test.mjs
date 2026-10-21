import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseProjectSpec,validProjectPath,zipProjectFiles,packagedProjectFiles,
 canAdvanceProject,verifiedProjectTest,publicGithubProjectPreflight} from "../lib/agent-project-engine.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const fixture={title:"Task board",steps:["Generate","Test"],files:[
 {path:"server.js",content:"const http=require('node:http'); module.exports={http};\n"},
 {path:"public/index.html",content:"<!doctype html><title>Task board</title>"},
 {path:"public/style.css",content:"body { color: blue; }"},
 {path:"test/server.test.mjs",content:"import test from 'node:test'; test('ready',()=>{});\n"}
]};
function unzipStored(bytes){
 const out=new Map(),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let i=0,dec=new TextDecoder();
 while(i+30<bytes.length&&v.getUint32(i,true)===0x04034b50){
  const size=v.getUint32(i+18,true),n=v.getUint16(i+26,true),extra=v.getUint16(i+28,true);
  const name=dec.decode(bytes.subarray(i+30,i+30+n)),pos=i+30+n+extra;
  assert.ok(pos+size<=bytes.length);
  out.set(name,dec.decode(bytes.subarray(pos,pos+size)));i=pos+size;
 }
 assert.equal(v.getUint32(i,true),0x02014b50);
 assert.equal(v.getUint32(bytes.length-22,true),0x06054b50);
 assert.equal(v.getUint16(bytes.length-12,true),out.size);
 return out;
}
test("multi-file project with paths and test preserved in ZIP",()=>{
 const spec=parseProjectSpec(JSON.stringify(fixture));
 const entries=unzipStored(zipProjectFiles(packagedProjectFiles(spec,
  "Build a task board","$ node --test\n[exit=0]","PASSED")));
 assert.equal(entries.get("server.js"),fixture.files[0].content);
 assert.match(entries.get("public/index.html"),/Task board/);
 assert.match(entries.get("test/server.test.mjs"),/node:test/);
 assert.equal(JSON.parse(entries.get("package.json")).scripts.test,"node --test");
 assert.match(entries.get("TEST-RESULTS.txt"),/exit=0/);
 assert.match(entries.get("AGENT-README.md"),/NOT committed to or deployed/);
});
test("reject traversal, absolute paths, hidden repo and reserved packages",()=>{
 for(const path of ["../secrets.txt","/etc/passwd",".env","x/../../app.js",
  "src\\evil.js","node_modules/main.js","src/.git/config.json","src//main.js",
  "src/notallowed.sh","C:/settings.json"]){
  assert.equal(validProjectPath(path),false,path);
 }
 for(const path of ["public/index.html","src/lib/app.js","test/unit.test.mjs"])
  assert.equal(validProjectPath(path),true,path);
 const malicious={...fixture,files:fixture.files.map((f,i)=>
  i===0?{...f,path:"../../AGENT/app.js"}:f)};
 assert.throws(()=>parseProjectSpec(JSON.stringify(malicious)),/INVALID_PROJECT_FILE/);
});
test("reject duplicate case-insensitive paths, package overrides and missing tests",()=>{
 for(const bad of [
  {...fixture,files:[...fixture.files,{path:"PUBLIC/INDEX.HTML",content:"oops"}]},
  {...fixture,files:[...fixture.files,{path:"package.json",content:'{"scripts":{"test":"rm -rf /"}}'}]},
  {...fixture,files:fixture.files.map(f=>f.path.startsWith("test/")?
   {...f,path:"notes.txt"}:f)}
 ])assert.throws(()=>parseProjectSpec(JSON.stringify(bad)));
});
test("permission state and time/attempt boundaries enforced",()=>{
 const end=60000;
 assert.equal(canAdvanceProject("planned",false,0,2,end,10),false);
 assert.equal(canAdvanceProject("ready",true,0,2,end,10),true);
 assert.equal(canAdvanceProject("repairing",true,1,2,end,10),true);
 assert.equal(canAdvanceProject("ready",true,2,2,end,10),false);
 assert.equal(canAdvanceProject("repairing",true,1,2,end,end),false);
 assert.equal(canAdvanceProject("completed",true,0,2,end,10),false);
});
test("project runner uses free-eligible GitHub Actions, not host execution or paid Sandbox",()=>{
 const api=read("app/api/assistant/projects/route.ts");
 const action=read(".github/workflows/agent-experiment.yml");
 const auth=read("lib/agent-github-actions.ts");
 assert.match(api,/requireAgentSession\(req\)/);
 assert.match(api,/\.eq\("organization_id",s\.organizationId\)/);
 assert.match(api,/\.eq\("user_id",s\.userId\)/);
 assert.match(api,/discoverAutoModels\(false\)/);
 assert.match(api,/builtInProjectRecipe\(body\.task\)/);
 assert.match(api,/model_calls:modelCalls/);
 assert.match(api,/dispatchAgentProject\(/);
 assert.match(api,/fetchAgentExperiment\(/);
 assert.match(api,/github_request_id:requestId/);
 assert.match(api,/max_attempts/);
 assert.match(api,/\.eq\("status",status\)/);
 assert.match(action,/--network none --read-only --cap-drop ALL/);
 assert.match(action,/node --test/);
 assert.match(action,/project_b64:/);
 assert.match(auth,/permissions:\{actions:"write"\}/);
 assert.doesNotMatch(api,/Sandbox\.create|child_process|git\s+push|create_pull_request|deploy/);
 assert.doesNotMatch(action,/actions\/checkout@|npm install|git push/);
});
test("separate downloads and saved archives are owner-scoped",()=>{
 const dl=read("app/api/assistant/projects/download/route.ts");
 assert.match(dl,/requireAgentSession\(req\)/);
 assert.match(dl,/\.eq\("organization_id",s\.organizationId\)/);
 assert.match(dl,/\.eq\("user_id",s\.userId\)/);
 assert.match(dl,/Content-Disposition/);
 const api=read("app/api/assistant/projects/route.ts");
 assert.match(api,/storage\.from\("agent-library"\)/);
 assert.match(api,/mime_type:"application\/zip",kind:"other"/);
 assert.match(read("supabase/migrations/20261020_agent_project_builds.sql"),/enable row level security/);
});
test("work UI includes file review, cost approval and progress",()=>{
 const ui=read("components/agent-project-builder.tsx");
 assert.match(ui,/project\.files\.map/);
 assert.match(ui,/maxAttempts/);
 assert.match(ui,/"approve"/);
 assert.match(ui,/"advance"/);
 assert.match(ui,/تنزيل التطبيق ZIP/);
 assert.match(ui,/عرض الترمنال الفعلي/);
 assert.match(read("components/general-assistant.tsx"),/AgentProjectBuilder/);
});

test("a printed PASS cannot masquerade as real node --test evidence",()=>{
 assert.equal(verifiedProjectTest("PASS: جميع اختبارات المخزون نجحت\n[exit=0]","success"),false);
 assert.equal(verifiedProjectTest("# tests 0\n# pass 0\n# fail 0\n[exit=0]","success"),false);
 assert.equal(verifiedProjectTest("# tests 6\n# pass 6\n# fail 0\n[exit=0]","success"),true);
 assert.equal(verifiedProjectTest(
  "2026-10-20T14:13:34.125Z # tests 8\n2026-10-20T14:13:34.125Z # pass 8\n2026-10-20T14:13:34.125Z # fail 0\n2026-10-20T14:13:34.125Z [exit=0]",
  "success"),true);
 assert.equal(verifiedProjectTest("# tests 8\n# pass 7\n# fail 1\n[exit=0]","success"),false);
 assert.equal(verifiedProjectTest("# tests 8\n# pass 8\n# fail 0\n[exit=1]","success"),false);
 assert.equal(verifiedProjectTest("# tests 8\n# pass 8\n# fail 0\n[exit=0]","failure"),false);
});
test("previously approved successful exact projects can repeat without model or approval",()=>{
 const api=read("app/api/assistant/projects/route.ts");
 assert.match(api,/previouslyApproved=true/);
 assert.match(api,/const autoStart=\(Boolean\(builtIn\)\|\|previouslyApproved\)/);
 assert.match(api,/const success=verifiedProjectTest\(trace.log,trace.conclusion\)/);
});

test("public runner preflight protects approval from oversized manifests or secrets",()=>{
 assert.deepEqual(publicGithubProjectPreflight(fixture.files),{ok:true});
 const huge=fixture.files.map((f,i)=>i===0?{...f,content:"a".repeat(42000)}:f);
 assert.deepEqual(publicGithubProjectPreflight(huge),{ok:false,reason:"TOO_LARGE"});
 const leak=fixture.files.map((f,i)=>i===0?{...f,content:"const k='ghp_"+"x".repeat(32)+"'"}:f);
 assert.deepEqual(publicGithubProjectPreflight(leak),{ok:false,reason:"POSSIBLE_SECRET"});
 const code=read("app/api/assistant/projects/route.ts");
 assert.match(code,/const safety=publicGithubProjectPreflight\(spec.files\)/);
 assert.match(code,/PROJECT_PREFLIGHT_/);
 assert.match(code,/const safety=publicGithubProjectPreflight\(specFrom\(run\).files\)/);
});

test("draft owners can download source without public execution or a false test pass",()=>{
 const dl=read("app/api/assistant/projects/download/route.ts");
 const ui=read("components/agent-project-builder.tsx");
 assert.match(dl,/NOT TESTED - DRAFT/);
 assert.match(dl,/No per-project GitHub Actions tests have completed/);
 assert.match(dl,/\.eq\("user_id",s\.userId\)/);
 assert.match(ui,/تنزيل ملفات ZIP \(غير مختبرة بعد\)/);
 const files=packagedProjectFiles(fixture,"Taskboard","No execution","NOT TESTED - DRAFT");
 const status=files.find(f=>f.path==="AGENT-README.md");
 assert.match(status.content,/NOT TESTED - DRAFT/);
 assert.ok(zipProjectFiles(files).byteLength>100);
});

test("preview without GitHub App credentials gives a draft, never a fake approval",()=>{
 const ui=read("components/agent-project-builder.tsx");
 const server=read("app/api/assistant/projects/route.ts");
 assert.match(ui,/disabled=\{busy\|\|!project.runner_available\}/);
 assert.match(ui,/يمكنك تنزيل ملف ZIP غير المختبر الآن/);
 assert.match(server,/runner_available:githubActionsConfigured\(\)/);
});
