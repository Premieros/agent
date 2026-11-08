import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {chooseSiteFile,isEditable} from "../lib/site-manager.ts";

const file=path=>new URL("../"+path,import.meta.url);
const read=path=>readFileSync(file(path),"utf8");

test("AGENT has one primary home: the authenticated assistant",()=>{
  assert.match(read("app/page.tsx"),/redirect\(["']\/assistant["']\)/);
  assert.match(read("app/assistant/page.tsx"),/GeneralAssistant/);
});

test("site change drafts target the live homepage, never an orphaned component",()=>{
  for(const text of ["الصفحة الرئيسية","تعديل dashboard","homepage"])
    assert.equal(chooseSiteFile(text),"components/general-assistant.tsx");
  assert.equal(isEditable("components/general-assistant.tsx"),true);
  assert.equal(isEditable("components/agent-home.tsx"),false);
  assert.equal(isEditable("components/workspace-shell.tsx"),true);
});

test("inactive duplicate demo screens are not shipped as maintained source",()=>{
  for(const path of ["components/agent-home.tsx","components/sales-workspace.tsx","lib/demo.ts"])
    assert.equal(existsSync(file(path)),false,path);
});

test("live CRM, inbox, and Studio entries remain available",()=>{
  assert.match(read("app/crm/page.tsx"),/LiveCrm/);
  assert.match(read("app/crm/inbox/page.tsx"),/LiveInbox/);
  assert.match(read("app/studio/page.tsx"),/AgentStudio/);
});
