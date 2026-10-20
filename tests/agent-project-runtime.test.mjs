import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {spawnSync} from "node:child_process";
import {parseProjectSpec,packagedProjectFiles,zipProjectFiles} from "../lib/agent-project-engine.ts";

// A trusted, static fixture runs in CI. Untrusted user/model projects are NEVER
// executed by this process; production always delegates to Vercel Sandbox.
const example={
 title:"Todo app",steps:["Create domain module","Add HTTP app","Write UI","Test CRUD"],files:[
 {path:"src/tasks.js",content:
  'let tasks=[];function add(title){if(!String(title).trim())throw Error("title required");const row={id:tasks.length+1,title};tasks.push(row);return row;}function list(){return [...tasks];}function remove(id){const old=tasks.length;tasks=tasks.filter(x=>x.id!==id);return tasks.length!==old;}module.exports={add,list,remove};\n'},
 {path:"server.js",content:
  'const {createServer}=require("node:http");const {add,list}=require("./src/tasks");const server=createServer((req,res)=>{res.setHeader("content-type","application/json");if(req.url==="/api/tasks"){res.end(JSON.stringify(list()));return;}res.writeHead(404);res.end(JSON.stringify({error:"not found"}));});if(require.main===module)server.listen(3000);module.exports={server,add};\n'},
 {path:"public/index.html",content:'<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><h1>Tasks</h1><script src="/app.js"></script></body></html>'},
 {path:"public/style.css",content:"body{font-family:sans-serif;margin:2rem}"},
 {path:"public/app.js",content:'fetch("/api/tasks").then(x=>x.json()).then(console.log);'},
 {path:"test/tasks.test.mjs",content:
  'import test from "node:test";import assert from "node:assert/strict";import tasks from "../src/tasks.js";test("CRUD task flow",()=>{const created=tasks.add("First");assert.equal(tasks.list().length,1);assert.equal(tasks.remove(created.id),true);assert.equal(tasks.list().length,0)});test("reject blank title",()=>assert.throws(()=>tasks.add("  ")));\n'}
]};
test("known-good standalone multi-file Node.js app is executable without npm or external network",()=>{
 const spec=parseProjectSpec(JSON.stringify(example));
 const archived=zipProjectFiles(packagedProjectFiles(spec,"Create todos","[exit=0]","PASSED"));
 assert.ok(archived.length>500,"standalone archive is assembled");
 const temp=mkdtempSync(join(tmpdir(),"agent-portable-fixture-"));
 try{
  for(const file of packagedProjectFiles(spec,"Create todos","[exit=0]","PASSED")){
   const path=join(temp,file.path);
   mkdirSync(dirname(path),{recursive:true});
   writeFileSync(path,file.content,"utf8");
  }
  const result=spawnSync(process.execPath,["--test"],{
   cwd:temp,encoding:"utf8",timeout:15000,env:{PATH:process.env.PATH||""}
  });
  assert.equal(result.status,0,result.stdout+"\n"+result.stderr);
  assert.match(result.stdout,/pass 2/);
  assert.match(result.stdout,/fail 0/);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
