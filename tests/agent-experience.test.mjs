import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rankModelOptions,taskDomain} from "../lib/agent-adaptive-routing.ts";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("domain classification covers coding, media, marketing and general goals",()=>{
  assert.equal(taskDomain("ساعدني في برمجة تطبيق"),"coding");
  assert.equal(taskDomain("صناعة محتوى لمنشور"),"writing");
  assert.equal(taskDomain("إدارة حملات التسويق"),"marketing");
  assert.equal(taskDomain("حلل ملف CSV"),"analysis");
  assert.equal(taskDomain("ابحث عن مراجع"),"research");
  assert.equal(taskDomain("أعطني خطة مشروع"),"planning");
});

test("AGENT learns model order from recorded user ratings rather than model claims",()=>{
  const candidates=[
    {provider:"openrouter",model:"fast:free",tier:"free-model",label:"Fast"},
    {provider:"openrouter",model:"careful:free",tier:"free-model",label:"Careful"}
  ];
  assert.equal(rankModelOptions(candidates,"analysis",[])[0].model,"fast:free");
  const feedback=[
    {model:"openrouter/fast:free",task_domain:"analysis",kind:"reply_feedback",outcome:"negative"},
    {model:"openrouter/careful:free",task_domain:"analysis",kind:"reply_feedback",outcome:"positive"},
    {model:"openrouter/careful:free",task_domain:"analysis",kind:"reply_feedback",outcome:"positive"}
  ];
  assert.equal(rankModelOptions(candidates,"analysis",feedback)[0].model,"careful:free");
  assert.equal(rankModelOptions(candidates,"coding",feedback)[0].model,"fast:free");
});

test("sandbox exits have weaker impact than explicit human feedback",()=>{
  const models=[
    {provider:"groq",model:"model-a",tier:"free-tier-conditional",label:"A"},
    {provider:"groq",model:"model-b",tier:"free-tier-conditional",label:"B"}
  ];
  const history=[
    ...Array.from({length:3},()=>({
      model:"groq/model-a",task_domain:"coding",kind:"sandbox_execution",outcome:"positive"
    })),
    {model:"groq/model-a",task_domain:"coding",kind:"reply_feedback",outcome:"negative"},
    {model:"groq/model-b",task_domain:"coding",kind:"reply_feedback",outcome:"positive"}
  ];
  assert.equal(rankModelOptions(models,"coding",history)[0].model,"model-b");
});

test("free-tier variants don't silently become a paid choice",()=>{
  const models=[
    {provider:"groq",model:"conditional",tier:"free-tier-conditional",label:"Conditional"},
    {provider:"openrouter",model:"free:free",tier:"free-model",label:"Free"}
  ];
  const feedback=Array.from({length:12},()=>({
    model:"groq/conditional",task_domain:"coding",kind:"reply_feedback",outcome:"positive"
  }));
  assert.equal(rankModelOptions(models,"coding",feedback)[0].model,"free:free");
  assert.match(read("lib/ai-providers.ts"),/native reasoning/);
  assert.doesNotMatch(read("lib/ai-providers.ts"),/thinkingBudget:\s*0/);
});

test("experience APIs enforce user and organization ownership",()=>{
  const src=read("app/api/assistant/experience/route.ts");
  assert.match(src,/requireAgentSession\(req\)/);
  assert.match(src,/assistant_threads/);
  assert.match(src,/\.eq\("user_id",s\.userId\)/);
  assert.match(src,/\.eq\("organization_id",s\.organizationId\)/);
  assert.match(src,/\.upsert\(row,/);
  assert.doesNotMatch(src,/SUPABASE_SERVICE_ROLE_KEY|service_role/);
  const sql=read("supabase/migrations/20261020_agent_experience_events.sql");
  assert.match(sql,/enable row level security/);
  assert.match(sql,/user_id=\(select auth\.uid\(\)\)/);
  assert.match(sql,/kind in \('reply_feedback','sandbox_execution'\)/);
});

test("sandbox experience is recorded only after real execution, not after text",()=>{
  const work=read("app/api/assistant/work/route.ts");
  assert.match(work,/recordSandboxExperience\(session/);
  const experience=read("lib/agent-experience.ts");
  assert.match(experience,/if\(!run\.sandbox_ran\|\|typeof succeeded!=="boolean"/);
  assert.match(experience,/exit=0; functional correctness unverified/);
  assert.match(experience,/source:"automatic",status:"suggested"/);
});

test("user feedback is a visible and reviewable adaptation signal",()=>{
  const chat=read("components/general-assistant.tsx");
  assert.match(chat,/rateReply\(m\.id,"positive"\)/);
  assert.match(chat,/rateReply\(m\.id,"negative"\)/);
  assert.match(chat,/loadFeedback\(id\)/);
  assert.match(read("app/api/assistant/route.ts"),/chooseExperiencedModels\(session,discovered/);
  assert.match(read("lib/agent-identity.ts"),/لا تدّعِ تدريب النموذج/);
  assert.match(read("app/api/assistant/route.ts"),/نموذج الرد غير متاح/);
});

test("learned research skills use an approved skill base instead of an unsupported browser ID",()=>{
  const learning=read("lib/agent-experience.ts");
  assert.match(learning,/research:"analysis"/);
  assert.doesNotMatch(learning,/research:"browser"/);
  assert.match(learning,/status:"suggested",source:"automatic"/);
});
