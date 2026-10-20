import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createPortableExperimentZip} from "../lib/agent-project-bundle.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

const fixture={
  id:"123e4567-e89b-12d3-a456-426614174000",
  task:"Create a simple Node.js task manager",
  code:'console.log("example app");\n',
  steps:["Create an app","Run tests"],
  status:"failed",sandbox_ran:true,sandbox_succeeded:false,
  execution_log:"AssertionError 0 !== 1\n[exit=1]",
  github_run_id:12345678
};
function unzipStored(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const decoder=new TextDecoder();
  const files=new Map();
  let at=0;
  while(at+30<bytes.length&&view.getUint32(at,true)===0x04034b50){
    assert.equal(view.getUint16(at+8,true),0,"files are ZIP-stored without dependencies");
    const size=view.getUint32(at+18,true);
    const nameLength=view.getUint16(at+26,true);
    const extraLength=view.getUint16(at+28,true);
    const name=decoder.decode(bytes.subarray(at+30,at+30+nameLength));
    const from=at+30+nameLength+extraLength;
    assert.ok(from+size<=bytes.byteLength,"no invalid ZIP offsets");
    files.set(name,decoder.decode(bytes.subarray(from,from+size)));
    at=from+size;
  }
  assert.equal(view.getUint32(at,true),0x02014b50,"ZIP central directory exists");
  const end=bytes.byteLength-22;
  assert.equal(view.getUint32(end,true),0x06054b50,"valid end of directory");
  assert.equal(view.getUint16(end+10,true),files.size);
  return files;
}
test("detached ZIP contains app, run instructions and actual result",()=>{
  const zip=createPortableExperimentZip(fixture);
  assert.ok(zip.length>300);
  const entries=unzipStored(zip);
  assert.deepEqual([...entries.keys()],["README.md","program.js","package.json","TEST-RESULTS.txt"]);
  assert.equal(entries.get("program.js"),fixture.code);
  const pkg=JSON.parse(entries.get("package.json"));
  assert.equal(pkg.scripts.start,"node program.js");
  assert.match(entries.get("README.md"),/NOT committed, merged, or deployed/);
  assert.match(entries.get("TEST-RESULTS.txt"),/FAILED/);
  assert.match(entries.get("TEST-RESULTS.txt"),/0 !== 1/);
  assert.doesNotMatch(entries.get("README.md"),/completed successfully and verified all features/i);
});
test("ZIP does not claim unverified code passed",()=>{
  const files=unzipStored(createPortableExperimentZip({
    ...fixture,status:"completed",sandbox_ran:false,sandbox_succeeded:null
  }));
  assert.match(files.get("TEST-RESULTS.txt"),/NOT VERIFIED/);
});
test("ZIP never includes arbitrary user-controlled filenames or parent paths",()=>{
  assert.throws(()=>createPortableExperimentZip({...fixture,id:"../../../evil"}));
  const zip=createPortableExperimentZip({...fixture,task:"../private/key"});
  const names=[...unzipStored(zip).keys()];
  assert.ok(names.every(name=>!name.includes("/")&&!name.includes("..")));
});
test("secure project download only uses owner-scoped stored work, not a Github push",()=>{
  const route=read("app/api/assistant/work/download/route.ts");
  assert.match(route,/requireAgentSession\(req\)/);
  assert.match(route,/\.eq\("organization_id",session\.organizationId\)/);
  assert.match(route,/\.eq\("user_id",session\.userId\)/);
  assert.match(route,/\.select\("id,task,steps,code,status/);
  assert.match(route,/Content-Disposition/);
  assert.match(route,/private, no-store/);
  assert.doesNotMatch(route,/dispatchAgentExperiment|git\s+push|create_pull_request|service_role/);
});
test("existing GitHub Actions worker cannot change AGENT source repo",()=>{
  const workflow=read(".github/workflows/agent-experiment.yml");
  assert.match(workflow,/permissions: \{\}/);
  assert.match(workflow,/--network none --read-only --cap-drop ALL/);
  assert.doesNotMatch(workflow,/actions\/checkout@|git\s+push|git\s+commit|\$\{\{\s*secrets\./);
  const github=read("lib/agent-github-actions.ts");
  assert.match(github,/permissions:\{actions:"write"\}/);
  assert.doesNotMatch(github,/contents:"write"|pull_requests:"write"|workflows:"write"/);
});
test("a completed Work reply lets owner download ZIP in conversation",()=>{
  const ui=read("components/general-assistant.tsx");
  assert.match(ui,/downloadWorkProgram\(runId:string\)/);
  assert.match(ui,/\/api\/assistant\/work\/download\?runId=/);
  assert.match(ui,/URL\.createObjectURL\(await res\.blob\(\)\)/);
  assert.match(ui,/تنزيل البرنامج ZIP/);
  assert.match(ui,/pendingWork\.code/);
});
