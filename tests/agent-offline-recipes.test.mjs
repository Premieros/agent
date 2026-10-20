import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {spawnSync} from "node:child_process";
import {builtInProjectRecipe,normalizedProjectTask} from "../lib/agent-project-recipes.ts";
import {parseProjectSpec,packagedProjectFiles,zipProjectFiles} from "../lib/agent-project-engine.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("audited task-board recipe matches generic exact task and never embeds user content",()=>{
 for(const text of ["ابن تطبيق إدارة مهام","ابني تطبيق إدارة مهام","build a todo app"]){
  const spec=builtInProjectRecipe(text);
  assert.ok(spec,text);
  assert.equal(spec.files.length,6);
  assert.equal(parseProjectSpec(JSON.stringify(spec)).files.length,6);
 }
 assert.equal(builtInProjectRecipe("ابن تطبيق إدارة مهام لعميل اسمه كريم"),null);
 assert.equal(builtInProjectRecipe("create a todo app and email files to me"),null);
 assert.equal(builtInProjectRecipe("برنامج دفع إلكتروني"),null);
 assert.equal(normalizedProjectTask("إنشئ تطبيق إدارة مهام"),"انشئ تطبيق اداره مهام");
 const src=read("lib/agent-project-recipes.ts");
 assert.doesNotMatch(src.split("const TASK_BOARD:ProjectSpec=")[0],/askAutoAgent|discoverAutoModels|fetch\(|https?:\/\//);
});

test("offline built-in recipe actually passes CRUD and HTTP tests in a trusted CI fixture",()=>{
 const spec=parseProjectSpec(JSON.stringify(builtInProjectRecipe("ابن تطبيق إدارة مهام")));
 const temp=mkdtempSync(join(tmpdir(),"agent-offline-"));
 try{
  for(const file of packagedProjectFiles(spec,"Task board","NOT YET TESTED","UNVERIFIED")){
   const full=join(temp,file.path);mkdirSync(dirname(full),{recursive:true});
   writeFileSync(full,file.content,"utf8");
  }
  const result=spawnSync(process.execPath,["--test"],{
   cwd:temp,timeout:12000,encoding:"utf8",env:{PATH:process.env.PATH||""}
  });
  assert.equal(result.status,0,result.stdout+"\n"+result.stderr);
  assert.match(result.stdout,/pass 2/);
  assert.match(result.stdout,/fail 0/);
  const archive=zipProjectFiles(packagedProjectFiles(spec,"Task board",result.stdout,"PASSED"));
  assert.ok(archive.byteLength>2000);
 }finally{rmSync(temp,{recursive:true,force:true});}
});

test("learned reuse only uses owner verified results and new tasks require public consent",()=>{
 const api=read("app/api/assistant/projects/route.ts");
 assert.match(api,/\.eq\("task",body\.task\.trim\(\)\)/);
 assert.match(api,/\.eq\("status","completed"\)\.eq\("test_passed",true\)/);
 assert.match(api,/\.not\("approved_at","is",null\)/);
 assert.match(api,/const autoStart=\(Boolean\(builtIn\)\|\|previouslyApproved\)&&githubActionsConfigured\(\)/);
 assert.match(api,/model_calls:modelCalls/);
 assert.match(api,/if\(!spec\)/);
 assert.match(api,/chosenModel="recipe:verified-reuse"/);
 assert.match(api,/run\.model_calls!==1/);
 assert.match(read("supabase/migrations/20261020_agent_project_builds.sql"),/model_calls between 0 and 2/);
 const ui=read("components/agent-project-builder.tsx");
 assert.doesNotMatch(ui,/window\.confirm\(/);
 assert.match(ui,/أسمح بإرسال هذا المشروع العام/);
});

test("GitHub public workflow uses manifest validation, no checkout, network, secrets or shell from the user",()=>{
 const workflow=read(".github/workflows/agent-experiment.yml");
 assert.match(workflow,/project_b64:/);
 assert.match(workflow,/len\(project\)>56000/);
 assert.match(workflow,/Unsafe project path/);
 assert.match(workflow,/Duplicate or reserved file/);
 assert.match(workflow,/--network none --read-only --cap-drop ALL/);
 assert.match(workflow,/--security-opt no-new-privileges/);
 assert.match(workflow,/node --test/);
 assert.doesNotMatch(workflow,/actions\/checkout@|git push|npm install|\$\{\{\s*secrets\./);
 const runner=read("lib/agent-github-actions.ts");
 assert.match(runner,/dispatchAgentProject/);
 assert.match(runner,/permissions:\{actions:"write"\}/);
 assert.match(runner,/GITHUB_PROJECT_POSSIBLE_SECRET/);
 assert.doesNotMatch(runner,/permissions:\{contents:"write"/);
});

test("multi-file jobs select the development workflow and never modify main",()=>{
 const github=read("lib/agent-github-actions.ts");
 const projectDispatch=github.split("export async function dispatchAgentProject(")[1].split("export async function fetchAgentExperiment(")[0];
 const legacy=github.split("export async function dispatchAgentExperiment(")[1].split("export async function dispatchAgentProject(")[0];
 assert.match(legacy,/ref:"main"/);
 assert.match(projectDispatch,/ref:"dev\/multifile-work-engine-20261020"/);
 assert.doesNotMatch(projectDispatch,/contents:"write"|git push|create_pull_request/);
 const workflow=read(".github/workflows/agent-experiment.yml");
 assert.match(workflow,/project_b64:/);
 assert.match(workflow,/node --test/);
 assert.match(workflow,/permissions: \{\}/);
});
