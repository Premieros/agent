/** Task-specific model selection from observed AGENT outcomes.
 * Provider claims/model names are hints, not benchmarks or security claims.
 * No tool permissions or billing authorization is derived from this file.
 */
export type AgentDomain="coding"|"writing"|"marketing"|"analysis"|"research"|"planning"|"general";
export type ExperienceSignal={
  model:string;task_domain:AgentDomain;kind:"reply_feedback"|"sandbox_execution";
  outcome:"positive"|"negative";
};
export type ModelOption={
  provider:string;model:string;tier:"free-model"|"free-tier-conditional";label:string
};
export function taskDomain(text:string,skill="auto"):AgentDomain{
  const q=text.toLowerCase();
  if(/(?:\b(?:code|program|typescript|javascript|python|build|debug|bug|github|git|app|compile|deploy)\b|برمج|تطبيق|كود|مستودع|خطأ\s+البرنام|اختبار\s+الكود)/iu.test(q)||
    ["coding","github","pos_development"].includes(skill))return "coding";
  if(/(?:\b(?:research|source|citation|news|web search)\b|مصادر|ابحث|أخبار|اخبار|مراجع|تطورات)/iu.test(q)||
    skill==="browser")return "research";
  if(/(?:\b(?:campaign|advert|marketing|social media)\b|تسويق|اعلان|إعلان|حملات|الصفحات|منشور)/iu.test(q)||skill==="marketing")return "marketing";
  if(/(?:\b(?:draft|rewrite|story|article|write)\b|اكتب|صياغ|تحرير|مقال|قصة|محتوى)/iu.test(q)||
    skill==="writing")return "writing";
  if(/(?:\b(?:analyze|analyse|analysis|calculate|csv|json)\b|حلل|تحليل|احسب|بيانات|أرقام|ارقام)/iu.test(q)||
    skill==="analysis")return "analysis";
  if(/(?:\b(?:plan|roadmap|strategy)\b|خطة|خطوات|تخطيط|مشروع)/iu.test(q)||
    skill==="planning")return "planning";
  return "general";
}
function typeHint(model:string,domain:AgentDomain){
  const name=model.toLowerCase();
  // Labels are advisory only, used for cold-start tie-breaking.
  if(domain==="coding"&&/(coder|coding|code|devstral)/.test(name))return 3;
  if(domain==="analysis"&&/(reason|thinking|math)/.test(name))return 2;
  if(domain==="writing"&&/(creative|writer)/.test(name))return 2;
  return 0;
}
export function rankModelOptions<T extends ModelOption>(
  options:readonly T[],domain:AgentDomain,history:readonly ExperienceSignal[]
):T[]{
  const count=new Map<string,{pos:number;neg:number}>();
  for(const e of history){
    if(e.task_domain!==domain)continue;
    if(!["reply_feedback","sandbox_execution"].includes(e.kind))continue;
    const r=count.get(e.model)||{pos:0,neg:0};
    const weight=e.kind==="reply_feedback"?3:1;
    if(e.outcome==="positive")r.pos+=weight;
    else r.neg+=weight;
    count.set(e.model,r);
  }
  const score=(m:T)=>{
    const r=count.get(m.provider+"/"+m.model)||
      count.get(m.model)||{pos:0,neg:0};
    const total=r.pos+r.neg;
    // Sparse history only changes order gently. Trust explicit human feedback
    // more than process exit=0 (which does NOT prove factual correctness).
    const experience=total>=3?(r.pos-r.neg)/Math.max(5,total)*10:0;
    return experience+typeHint(m.model+" "+m.label,domain);
  };
  return options.map((item,index)=>({item,index}))
    .sort((a,b)=>{
      // Preserve the user's current opt-in cost policy: strict :free variants
      // are preferred. A provider's free-tier quota is never assumed.
      const classDiff=(a.item.tier==="free-model"?1:0)-(b.item.tier==="free-model"?1:0);
      if(classDiff)return -classDiff;
      return score(b.item)-score(a.item)||a.index-b.index;
    }).map(x=>x.item);
}
