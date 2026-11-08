import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {chooseSiteFile,isEditable} from "../lib/site-manager.ts";

const resource=path=>new URL("../"+path,import.meta.url);
const read=path=>readFileSync(resource(path),"utf8");

test("one home redirect and live assistant for unified AGENT",()=>{
 assert.match(read("app/page.tsx"),/redirect\(["']\/assistant["']\)/);
 assert.match(read("app/assistant/page.tsx"),/GeneralAssistant/);
 const shell=read("components/workspace-shell.tsx");
 assert.doesNotMatch(shell,/href:"\/",label:"لوحة التحكم"/);
 assert.match(shell,/href:"\/assistant",label:"المحادثات الذكية"/);
 assert.match(shell,/href:"\/assistant" className="workspace-logo"/);
});

test("new navigation preserves support channels, support inbox, CRM and Studio",()=>{
 const shell=read("components/workspace-shell.tsx");
 for(const entry of ["/support","/support/conversations","/support/channels","/crm/inbox","/studio?section=agents"])
  assert.ok(shell.includes('href:"'+entry+'"'),entry);
 for(const route of ["app/support/page.tsx","app/support/channels/page.tsx","app/support/conversations/page.tsx","app/crm/page.tsx","app/studio/page.tsx"])
  assert.equal(existsSync(resource(route)),true,route);
 assert.match(read("app/layout.tsx"),/agent-light-theme\.css/);
});

test("current two-site support service implementations remain in source",()=>{
 for(const path of ["app/api/support/public/messages/route.ts",
  "app/api/support/public/sessions/route.ts",
  "app/api/support/premier-inbox/route.ts",
  "app/api/support/johna-inbox/route.ts"])
  assert.equal(existsSync(resource(path)),true,path);
});

test("site self-editor cannot write to retired homepage",()=>{
 for(const label of ["الصفحة الرئيسية","تعديل dashboard","homepage"])
  assert.equal(chooseSiteFile(label),"components/general-assistant.tsx");
 assert.equal(isEditable("components/agent-home.tsx"),false);
 assert.equal(isEditable("components/general-assistant.tsx"),true);
});

test("legacy duplicate demo modules are not shipped",()=>{
 for(const path of ["components/agent-home.tsx","components/sales-workspace.tsx","lib/demo.ts"])
  assert.equal(existsSync(resource(path)),false,path);
});
