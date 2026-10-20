import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("the assistant conversation uses readable calm typography, not compact admin style",()=>{
 const css=read("app/workspace-dark.css");
 assert.match(css,/Conversational workspace V4/);
 assert.match(css,/--agent-chat-font:"Segoe UI","Noto Sans Arabic",Tahoma,Arial,sans-serif/);
 assert.match(css,/\.assistant-message-text\{\s*font:400 var\(--agent-chat-font-size,16px\)/);
 assert.match(css,/\.assistant-chat-scroll\{\s*padding:24px/);
 assert.match(css,/\.assistant-bubble\.user \.assistant-message-text\{/);
 assert.match(css,/\.assistant-bubble\.assistant \.assistant-message-text/);
 assert.match(css,/\.assistant-bubble \.assistant-avatar\{\s*display:none!important/);
 assert.match(css,/\.assistant-bubble\.assistant \.assistant-message-heading\{\s*order:3/);
 assert.match(css,/@media\(max-width:600px\)/);
});
test("code samples have a safe built-in copy action",()=>{
 const source=read("components/assistant-markdown.tsx");
 assert.match(source,/className="assistant-md-code-head"/);
 assert.match(source,/aria-label="نسخ الكود"/);
 assert.match(source,/navigator\.clipboard\.writeText\(code\)/);
 assert.match(source,/codeLines\.join\("\\n"\)/);
 assert.doesNotMatch(source,/dangerouslySetInnerHTML/);
});
test("real actions stay attached to the test result instead of making a second dashboard",()=>{
 const ui=read("components/general-assistant.tsx");
 assert.match(ui,/className="agent-inline-work-result"/);
 assert.match(ui,/latestEvidenceReply/);
 assert.match(ui,/m\.id===latestEvidenceReply/);
 assert.match(ui,/onClick=\{\(\)=>void proposeWorkRepair\(pendingWork\)\}/);
 assert.match(ui,/onClick=\{\(\)=>void saveWorkArtifact\(pendingWork\.id\)\}/);
 assert.match(ui,/pendingWork&&!finishedWork/);
 assert.match(ui,/useState\(16\)/);
 assert.doesNotMatch(ui,/className="assistant-chat-shortcuts"/);
});
test("the response style focuses on useful answer, no invented tools or fake reasoning",()=>{
 const identity=read("lib/agent-identity.ts");
 const planner=read("lib/agent-turn-planner.ts");
 assert.match(identity,/أسلوب محادثة طبيعي وواضح/);
 assert.match(identity,/لا تكرر رسائل الحالة/);
 assert.match(planner,/عناوين عند الحاجة فقط/);
 assert.match(planner,/التفاصيل التقنية اختياريّة/);
 assert.match(identity,/لا تدّعِ تدريب النموذج تلقائيًا/);
});
