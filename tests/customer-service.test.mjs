import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("customer service pages and rules remain available",()=>{
 for(const file of ["app/crm/page.tsx","app/crm/inbox/page.tsx","components/live-crm.tsx","components/live-inbox.tsx","app/api/assistant/reply-rule/route.ts","app/api/assistant/workspace/route.ts","lib/agent-server.ts"])assert.ok(existsSync(new URL("../"+file,import.meta.url)),file);
 assert.match(read("app/page.tsx"),/redirect\("\/crm\/inbox"\)/);
 assert.match(read("components/live-inbox.tsx"),/AgentReplyRule/);
});
test("non-customer-service routes and execution dependencies are absent",()=>{
 for(const file of ["app/studio/page.tsx","app/assistant/page.tsx","app/api/assistant/work/route.ts","app/api/agents/run/route.ts",".github/workflows/agent-experiment.yml"])assert.equal(existsSync(new URL("../"+file,import.meta.url)),false,file);
 const pkg=JSON.parse(read("package.json"));
 assert.equal(Object.hasOwn(pkg.dependencies,"@vercel/sandbox"),false);
});
test("authentication and organization boundaries remain on customer APIs",()=>{
 for(const file of ["app/api/assistant/reply-rule/route.ts","app/api/assistant/workspace/route.ts"]){
  const content=read(file);
  assert.match(content,/requireAgentSession\(req\)/);
  assert.match(content,/organizationId/);
 }
});
