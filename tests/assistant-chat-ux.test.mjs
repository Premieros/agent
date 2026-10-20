import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("active conversation stays focused on results, not duplicate shortcuts",()=>{
  const component=read("components/general-assistant.tsx");
  assert.doesNotMatch(component,/className="assistant-chat-shortcuts"/);
  assert.match(component,/assistant-studio-tools-toggle/);
  assert.match(component,/aria-expanded=\{showStudioControls\}/);
  assert.match(component,/showStudioControls&&<div id="assistant-studio-tools-panel"/);
  assert.match(component,/setShowStudioControls\(false\)/);
  assert.match(component,/setShowStudioControls\(intent==="studio-prepare"\)/);
});

test("existing read-only studio data and approved writes are retained",()=>{
  const component=read("components/general-assistant.tsx");
  assert.match(component,/studioRequest\(id,action/);
  assert.match(component,/requestApproval\("studio-confirm"/);
  assert.match(component,/onClick=\{\(\)=>void runStudioMission\(\)\}/);
  assert.match(component,/onClick=\{\(\)=>void confirmStudioDraft\(\)\}/);
  assert.match(component,/studioMissions\.map\(/);
  assert.match(component,/href="\/studio\?section=outputs"/);
  const backend=read("app/api/assistant/studio/route.ts");
  assert.match(backend,/if\(body\.action==="overview"\)/);
});

test("welcome uses a small set of task-oriented starters",()=>{
  const component=read("components/general-assistant.tsx");
  const starters=component.slice(component.indexOf("const starters=["),component.indexOf("export default function GeneralAssistant"));
  assert.equal((starters.match(/\{label:/g)||[]).length,4);
  assert.doesNotMatch(starters,/Premier.OS/);
});

test("list markers don't falsely signal a connected page",()=>{
  const css=read("app/workspace-dark.css");
  assert.match(css,/\.assistant-md li::marker\{\s*color:#a9b9c9!important/);
});
