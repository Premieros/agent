// Exercise exact AGENT workflow scripts with synthetic inputs and no remote secrets.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {builtInProjectRecipe} from "../lib/agent-project-recipes.ts";

const workflow=readFileSync(new URL("../.github/workflows/agent-experiment.yml",import.meta.url),"utf8");
const lines=workflow.split(/\r?\n/);
const titles=[
 "Prepare approved JavaScript without logging input",
 "Prepare independent AGENT acceptance tests",
 "Execute without network or GitHub credentials"
];
function stepScript(title){
 const start=lines.findIndex(l=>l==="      - name: "+title);
 if(start<0)throw Error("MISSING_WORKFLOW_STEP: "+title);
 const run=lines.findIndex((l,i)=>i>start&&l==="        run: |");
 const end=lines.findIndex((l,i)=>i>run&&l.startsWith("      - name: "));
 if(run<0)throw Error("MISSING_WORKFLOW_RUN: "+title);
 const content=lines.slice(run+1,end<0?undefined:end);
 if(content.length<3||content.some(l=>l&&!l.startsWith("          ")))
  throw Error("UNEXPECTED_WORKFLOW_INDENT: "+title);
 return content.map(l=>l?l.slice(10):"").join("\n")+"\n";
}
const scripts=titles.map(stepScript);
if(!workflow.includes("permissions: {}")||
 !workflow.includes("--network none --read-only --cap-drop ALL")||
 workflow.includes("actions/checkout@")||workflow.includes("$"+"{{ secrets."))
 throw Error("WORKFLOW_SANDBOX_INVARIANT_FAILED");
function runScript(path,env,expectSuccess=true){
 const run=spawnSync("bash",[path],{env,cwd:process.cwd(),encoding:"utf8",
  timeout:70_000,maxBuffer:2_000_000});
 const good=run.status===0&&!run.error;
 if(good!==expectSuccess)throw Error("WORKFLOW_STEP_UNEXPECTED_EXIT "+
  path+" status="+run.status+" error="+String(run.error||"")+"\n"+
  (run.stdout||"").slice(-2500)+"\n"+(run.stderr||"").slice(-1500));
 return (run.stdout||"")+"\n"+(run.stderr||"");
}
const payloadFor=files=>Buffer.from(JSON.stringify({files}),"utf8").toString("base64");
const root=mkdtempSync(join(tmpdir(),"agent-workflow-contract-"));
try{
 const paths=titles.map((_,i)=>{
  const path=join(root,"stage-"+i+".sh");
  writeFileSync(path,scripts[i],{mode:0o600});return path;
 });
 function verifyCase(name,{files,kind="none",code="",expectedFailure=false}){
  const dir=mkdtempSync(join(root,name+"-"));
  const env={...process.env,
   RUNNER_TEMP:dir,AGENT_REQUEST_ID:"11111111-1111-4111-8111-111111111111",
   AGENT_CODE_B64:code?Buffer.from(code,"utf8").toString("base64"):"",
   AGENT_PROJECT_B64:files?payloadFor(files):"",
   AGENT_ACCEPTANCE_KIND:kind};
  runScript(paths[0],env,!expectedFailure);
  if(expectedFailure){console.log("AGENT workflow rejected "+name);return;}
  runScript(paths[1],env);
  const log=runScript(paths[2],env);
  if(!log.includes("[exit=0]"))throw Error("MISSING_PROCESS_EXIT: "+name);
  if(files&&(!log.includes("# pass ")||
    !log.includes("AGENT_INDEPENDENT_ACCEPTANCE_PASSED:"+kind)))
   throw Error("MISSING_INDEPENDENT_ACCEPTANCE: "+name+"\n"+log.slice(-2500));
  if(code&&!log.includes("AGENT_LEGACY_WORKS"))
   throw Error("LEGACY_EXPERIMENT_BROKEN");
  console.log("AGENT isolated workflow contract passed: "+name);
 }
 const task=builtInProjectRecipe("ابن تطبيق إدارة مهام");
 const inventory=builtInProjectRecipe("ابن تطبيق إدارة مخزون");
 if(!task||!inventory)throw Error("MISSING_AUDITED_RECIPES");
 verifyCase("tasks",{files:task.files,kind:"task_board"});
 verifyCase("inventory",{files:inventory.files,kind:"inventory"});
 verifyCase("legacy",{code:'console.log("AGENT_LEGACY_WORKS")'});
 verifyCase("path-traversal",{files:task.files.map((f,i)=>i===0?
  {...f,path:"../outside.js"}:f),kind:"task_board",expectedFailure:true});
 verifyCase("two-inputs",{files:task.files,code:'console.log("must not run")',
  expectedFailure:true});
}finally{rmSync(root,{recursive:true,force:true});}
