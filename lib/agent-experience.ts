/** Owner-scoped experience evidence; no private prompts or model internals stored. */
import type {AgentSession} from "@/lib/agent-server";
import {rankModelOptions,taskDomain,type AgentDomain,type ExperienceSignal,type ModelOption} from "@/lib/agent-adaptive-routing";

export async function chooseExperiencedModels<T extends ModelOption>(
  s:AgentSession,candidates:T[],domain:AgentDomain
):Promise<T[]>{
  if(candidates.length<2)return candidates;
  const {data,error}=await s.db.from("assistant_experience_events")
    .select("model,task_domain,kind,outcome")
    .eq("organization_id",s.organizationId).eq("user_id",s.userId)
    .eq("task_domain",domain).order("created_at",{ascending:false}).limit(160);
  if(error){
    console.warn("AGENT experience selection unavailable",error.code||"read");
    return candidates;
  }
  return rankModelOptions(candidates,domain,(data||[]) as ExperienceSignal[]);
}

/** Evidence is sandbox process exit, never a model's self-reported success. */
export async function recordSandboxExperience(s:AgentSession,run:{
  id:string;task:string;model:string|null;sandbox_ran:boolean;
},succeeded:boolean|null,runner:"sandbox"|"github"="sandbox"){
  if(!run.sandbox_ran||typeof succeeded!=="boolean"||!run.model?.trim())return;
  const row={
    organization_id:s.organizationId,user_id:s.userId,
    kind:"sandbox_execution",reference_id:run.id,
    task_domain:taskDomain(run.task),model:run.model.slice(0,180),
    outcome:succeeded?"positive":"negative",
    evidence:succeeded?(runner==="github"?"GitHub Actions exit=0; functionality not fully verified.":"Sandbox process exit=0; functional correctness unverified."):
      (runner==="github"?"GitHub Actions test failed; see runner log.":"Sandbox failed or unavailable; cause requires review."),
    updated_at:new Date().toISOString()
  };
  const {error}=await s.db.from("assistant_experience_events").upsert(row,{
    onConflict:"organization_id,user_id,kind,reference_id"
  });
  if(error)console.warn("AGENT work outcome not recorded",error.code||"write");
}

const lessonNames:Record<AgentDomain,string>={
  coding:"البرمجة",writing:"الكتابة",marketing:"التسويق",
  analysis:"التحليل",research:"البحث",planning:"التخطيط",general:"المهام العامة"
};
/** Only positive, repeated user ratings produce a suggested learning note. */
export async function proposeValidatedExperienceLesson(s:AgentSession,domain:AgentDomain){
  const {data,error}=await s.db.from("assistant_experience_events")
    .select("reference_id,outcome,model")
    .eq("organization_id",s.organizationId).eq("user_id",s.userId)
    .eq("task_domain",domain).eq("kind","reply_feedback")
    .order("created_at",{ascending:false}).limit(12);
  if(error)return;
  const positive=(data||[]).filter(x=>x.outcome==="positive");
  if(positive.length<3)return;
  const subject="خبرة من تقييمات حقيقية: "+lessonNames[domain];
  const {data:dupe}=await s.db.from("assistant_memories").select("id")
    .eq("organization_id",s.organizationId).eq("user_id",s.userId)
    .eq("subject",subject).limit(1);
  if(!dupe?.length)await s.db.from("assistant_memories").insert({
    organization_id:s.organizationId,user_id:s.userId,thread_id:null,
    scope:"global",category:"lesson",subject,
    content:"حصل AGENT على ثلاث تقييمات إيجابية على الأقل في "+lessonNames[domain]+
      ". هذا دليل تفضيل من المستخدم وليس إثبات صحة كل الإجابات. راجع الدروس قبل اعتمادها.",
    source:"automatic",status:"suggested"
  });

  // Extract only observable presentation techniques from positively-rated
  // responses; never copy their private content into a global skill.
  const title="أسلوب مجرّب من التقييمات: "+lessonNames[domain];
  const {data:exists}=await s.db.from("assistant_custom_skills").select("id")
    .eq("organization_id",s.organizationId).eq("user_id",s.userId)
    .eq("title",title).limit(1);
  if(exists?.length)return;
  const samples=await s.db.from("assistant_messages").select("content")
    .eq("organization_id",s.organizationId).eq("role","assistant")
    .in("id",positive.slice(0,5).map(e=>e.reference_id));
  if(samples.error||!samples.data?.length)return;
  const replies=samples.data.map(x=>String(x.content||""));
  const concise=replies.filter(x=>x.length<1200).length>=Math.ceil(replies.length/2);
  const cited=replies.filter(x=>x.includes("https://")).length>=2;
  const codeFences=replies.filter(x=>x.includes(String.fromCharCode(96).repeat(3))).length>=2;
  const steps=replies.filter(x=>/^\s*(?:[-*]|\d+[.)])\s/m.test(x)).length>=2;
  const instructions=[
    "اقتراح من سمات مرئية لإجابات قيّمها المستخدم بإيجابية؛ ليست تدريبًا للنموذج أو ضمان صحة المعلومة.",
    "ابدأ بالنتيجة، وافصل المؤكد عن غير المتحقق، واستخدم الأدوات المتاحة فعلًا فقط.",
    ...(concise?["قدّم النتيجة بإيجاز قبل التوسع."]:[]),
    ...(cited?["أضف روابط المصادر التي تمت قراءتها بالفعل عندما تكون مفيدة."]:[]),
    ...(codeFences?["قدّم كودًا واضحًا قابلًا للاختبار، دون ادعاء أنه نُفّذ."]:[]),
    ...(steps?["رتّب خطوات الحل العملية عند الحاجة."]:[]),
    "كل صلاحيات الاتصال والتنفيذ تبقى خاضعة لتفويض المستخدم."
  ].join(" ").slice(0,1000);
  const bases:Record<AgentDomain,string>={
    coding:"coding",writing:"writing",marketing:"marketing",
    analysis:"analysis",research:"analysis",planning:"planning",general:"general"
  };
  const phrases:Record<AgentDomain,string[]>={
    coding:["راجع الكود","أصلح الخطأ","برمجة تطبيق"],
    writing:["اكتب نص","صياغة محتوى","مراجعة كتابة"],
    marketing:["خطة تسويق","إدارة حملة","محتوى تسويقي"],
    analysis:["حلل البيانات","تحليل ملف","تفسير النتائج"],
    research:["ابحث عن","مصادر موثوقة","تحقق من"],
    planning:["خطة مشروع","خطة تنفيذ","رتب الخطوات"],
    general:["أعطني أفضل إجابة","ساعدني في","اشرح لي"]
  };
  const {count}=await s.db.from("assistant_custom_skills")
    .select("id",{head:true,count:"exact"}).eq("organization_id",s.organizationId)
    .eq("user_id",s.userId);
  if(count!==null&&count>=30)return;
  await s.db.from("assistant_custom_skills").insert({
    organization_id:s.organizationId,user_id:s.userId,title,
    description:"أسلوب مقترح بعد تقييمات إيجابية متكررة في "+lessonNames[domain],
    instructions,phrases:phrases[domain],base_skill:bases[domain],
    status:"suggested",source:"automatic"
  });
}
