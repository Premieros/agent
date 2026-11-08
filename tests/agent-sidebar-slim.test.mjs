import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const shell=read("components/workspace-shell.tsx");
const assistant=read("components/general-assistant.tsx");

const extract=(source)=>[...source.matchAll(/\{href:"([^"]+)",label:"([^"]+)"/g)].map(m=>m[1]);

test("daily navigation contains six distinct, meaningful destinations",()=>{
 const primary=shell.slice(shell.indexOf("const groups:Group[]=["),shell.indexOf("// Less frequently"));
 assert.deepEqual(extract(primary),[
  "/assistant","/support/conversations","/support","/support/channels",
  "/crm?view=leads","/studio?section=agents"
 ]);
 assert.equal(new Set(extract(primary)).size,6);
 assert.doesNotMatch(primary,/\/support\/customer|\/crm\?view=tasks|\/studio\?section=models/);
});

test("extra destinations are available but collapsed by default",()=>{
 const extras=shell.slice(shell.indexOf("const extraItems:Item[]=["),shell.indexOf("export default function"));
 assert.deepEqual(extract(extras),["/assistant/library","/crm/inbox","/assistant/integrations"]);
 assert.match(shell,/useState\(false\)/);
 assert.match(shell,/id="agent-nav-secondary"/);
 assert.match(shell,/hidden=\{!moreOpen\}/);
 assert.match(shell,/aria-expanded=\{moreOpen\}/);
 assert.match(shell,/setMoreOpen\(v=>!v\)/);
 assert.match(read("app/sidebar-clean.css"),/\.agent-secondary-items\[hidden\]/);
});

test("saved conversations appear once, on demand, with no duplicate create button",()=>{
 assert.equal((shell.match(/className="workspace-new-chat"/g)||[]).length,1);
 assert.doesNotMatch(assistant,/className="assistant-new-chat"/);
 assert.doesNotMatch(assistant,/className="assistant-sidebar-title"/);
 assert.doesNotMatch(assistant,/className="assistant-sidebar-footer"/);
 assert.match(shell,/id="workspace-sidebar-slot"/);
 assert.match(shell,/hidden=\{!savedOpen\}/);
 assert.match(shell,/aria-expanded=\{savedOpen\}/);
 assert.match(shell,/agent:open-saved-conversations/);
 assert.match(assistant,/agent:open-saved-conversations/);
 assert.match(assistant,/threads\.map\(t=>/);
 assert.match(assistant,/removeThread\(t\.id\)/);
});

test("all existing business features remain accessible in their native modules",()=>{
 for(const route of [
  "app/assistant/page.tsx","app/assistant/library/page.tsx",
  "app/assistant/integrations/page.tsx","app/crm/page.tsx",
  "app/crm/inbox/page.tsx","app/studio/page.tsx",
  "app/support/page.tsx","app/support/conversations/page.tsx",
  "app/support/channels/page.tsx","app/support/customer/page.tsx",
  "app/api/support/premier-inbox/route.ts","app/api/support/johna-inbox/route.ts",
  "app/api/support/public/messages/route.ts","components/quick-pin-control.tsx"
 ])assert.equal(existsSync(new URL("../"+route,import.meta.url)),true,route);
 assert.match(shell,/<QuickPinControl\/>/);
 assert.match(read("app/layout.tsx"),/sidebar-clean\.css/);
});
