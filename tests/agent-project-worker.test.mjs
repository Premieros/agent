import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {nextProjectWorkerAction,projectShouldRepair} from "../lib/agent-project-worker-logic.ts";
const file=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const before=new Date(2026,9,20,1,0,0).toISOString();
const after=new Date(2026,9,20,2,0,0).toISOString();
const now=new Date(2026,9,20,1,30,0).getTime();
test("no worker action without a prior owner approval, even if status is ready",()=>{
 for(const status of ["ready","repairing","testing","planned","completed","failed"])
  assert.equal(nextProjectWorkerAction(status,null,after,0,2,now),"none");
});
test("bounded worker state machine requires a valid unexpired deadline and attempts",()=>{
 assert.equal(nextProjectWorkerAction("ready",before,after,0,2,now),"dispatch");
 assert.equal(nextProjectWorkerAction("testing",before,after,1,2,now),"poll");
 assert.equal(nextProjectWorkerAction("repairing",before,after,1,2,now),"repair");
 assert.equal(nextProjectWorkerAction("ready",before,after,2,2,now),"none");
 assert.equal(nextProjectWorkerAction("repairing",before,after,2,2,now),"none");
 assert.equal(nextProjectWorkerAction("testing",before,before,1,2,now),"expire");
 assert.equal(nextProjectWorkerAction("ready",before,"invalid-date",0,2,now),"none");
});
test("repair requires genuine failure and one remaining test",()=>{
 assert.equal(projectShouldRepair(false,true,true,1,2,1,false),true);
 for(const x of [[true,true,true,1,2,1,false],[false,false,true,1,2,1,false],
  [false,true,false,1,2,1,false],[false,true,true,2,2,1,false],
  [false,true,true,1,2,2,false],[false,true,true,1,2,1,true]])
  assert.equal(projectShouldRepair(...x),false);
});
test("worker endpoint disabled without all AGENT-only credentials and cannot accept browser JWT",()=>{
 const route=file("app/api/assistant/projects/internal-tick/route.ts");
 const driver=file("lib/agent-project-background.ts");
 assert.match(route,/AGENT_BACKGROUND_WORKER_DISABLED/);
 assert.match(route,/AGENT_PROJECT_WORKER_SECRET/);
 assert.match(route,/timingSafeEqual/);
 assert.match(driver,/projectId!=="gldlgdycgneadbqftcrj"/);
 assert.match(driver,/AGENT_WORKER_DATABASE_MISMATCH/);
 assert.match(driver,/\.not\("approved_at","is",null\)/);
 assert.match(driver,/\bacceptanceKindForModel\(row.model\)/);
 assert.doesNotMatch(driver,/\bdelete\(/);
});
