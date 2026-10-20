import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {planAgentTurn,agentToolSummary} from "../lib/agent-turn-planner.ts";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const plan=(prompt,opts={})=>planAgentTurn({
  prompt,skill:"auto",webEnabled:true,githubEnabled:true,
  libraryItemSelected:false,...opts
});

test("implicit fresh questions choose read-only web, no paid or arbitrary tools",()=>{
  const p=plan("ما الجديد في الذكاء الاصطناعي؟");
  assert.equal(p.goal,"fresh_research");
  assert.deepEqual(p.tools,["web"]);
  assert.equal(p.needsCitations,true);
  assert.match(p.responseInstructions,/أول سطر/);
  assert.match(p.responseInstructions,/لا تُظهر التفكير الداخلي/);
});

test("one request can use multiple enabled sources without extra permissions",()=>{
  const p=plan("ابحث عن آخر تطورات GitHub في المستودع، مع المصادر");
  assert.deepEqual(p.tools,["web","github"]);
  assert.deepEqual(p.blocked,[]);
  assert.equal(p.needsRecentEvidence,true);
  const status=agentToolSummary(p,{webSources:3,githubFiles:2,pageRead:false,libraryRead:false,workspaceRead:false});
  assert.match(status.join(" " ),/3 مصادر مفهرسة/);
  assert.match(status.join(" " ),/2 ملفات كود/);
});

test("disabled connectors cannot become active through a prompt or skill",()=>{
  const p=plan("ابحث عن آخر أخبار github في المستودع",{
    webEnabled:false,githubEnabled:false,skill:"github"
  });
  assert.deepEqual(p.tools,[]);
  assert.deepEqual(p.blocked,["web","github"]);
  const summary=agentToolSummary(p,{webSources:0,githubFiles:0,pageRead:false,libraryRead:false,workspaceRead:false});
  assert.equal(summary.length,2);
  assert.ok(summary.every(t=>t.includes("معطّل")));
});

test("internal workspace counts are read even if web/browser disabled",()=>{
  for(const question of ["كم عندي عميل؟","عدد العملاء والمتابعات","آخر العملاء"]){
    const p=plan(question,{webEnabled:false,githubEnabled:false});
    assert.ok(p.tools.includes("workspace"),question);
    assert.ok(!p.tools.includes("web"),question);
  }
  const src=read("lib/agent-workspace-reader.ts");
  assert.match(src,/requireAgentSession|AgentSession/);
  assert.match(src,/\.eq\("organization_id",organizationId\)/);
  assert.doesNotMatch(src,/service_role|SUPABASE_SERVICE_ROLE_KEY|\.insert\(|\.update\(|\.delete\(/);
  assert.match(read("app/api/assistant/route.ts"),/تعذرت قراءة بيانات المؤسسة/);
});

test("normal questions stay model-only and longer outputs remain possible",()=>{
  const simple=plan("اشرح لي لماذا السماء زرقاء");
  assert.deepEqual(simple.tools,[]);
  assert.match(simple.responseInstructions,/120 كلمة/);
  const detailed=plan("اشرح بالتفصيل وكيف تعمل هذه الخوارزمية");
  assert.doesNotMatch(detailed.responseInstructions,/120 كلمة/);
  assert.match(detailed.responseInstructions,/العمق اللازم/);
  assert.deepEqual(plan("حلل الملف",{libraryItemSelected:true}).tools,["library"]);
});

test("approved reusable skills are proposed, not silently activated",()=>{
  const code=read("lib/assistant-learning.ts");
  for(const title of ["بحث موثق ومقارنة المصادر","تحليل الملفات والمستندات","تشخيص الأخطاء التقنية"])
    assert.ok(code.includes(title));
  assert.match(code,/status:"suggested",source:"automatic"/);
  assert.match(code,/repeats<2/);
  assert.doesNotMatch(code,/status:"active",source:"automatic"/);
  const chat=read("components/general-assistant.tsx");
  assert.match(chat,/suggestLearningApproval\(id\)/);
  assert.match(chat,/approve_skill/);
});

test("chat hides model internals, leaving real tool activity visible",()=>{
  const chat=read("components/general-assistant.tsx");
  assert.match(chat,/toolSummary\?:string\[\]/);
  assert.match(chat,/data\.toolSummary\|\|\[\]/);
  assert.doesNotMatch(chat,/مشاركة التفكير الداخلي/);
  assert.doesNotMatch(chat,/· \$\{data\.attempts\?\?1\} محاولة/);
});
