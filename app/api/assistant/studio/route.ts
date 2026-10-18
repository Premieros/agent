import {NextRequest,NextResponse} from "next/server";
import {requireAgentSession,errorResponse,type AgentSession} from "@/lib/agent-server";

export const runtime="nodejs";
export const maxDuration=60;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore={"Cache-Control":"no-store"};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:noStore});
type Page={id:string;name:string;platform:string;connection_status:string;target_audience:string;product_context:string};
type Mission={id:string;page_id:string;objective:string;brief:string;status:string;created_at:string};
type Draft={id:string;page_id:string;objective:string;brief:string;status:"draft"|"creating"|"created";mission_id:string|null};
const objectives:Record<string,string>={
  content:"محتوى أسبوعي",campaign:"حملة إعلانية",replies:"ردود على العملاء",launch:"إطلاق منتج أو خدمة"
};
const statusNames:Record<string,string>={
  queued:"جاهزة للتشغيل",running:"قيد التشغيل",review:"بانتظار مراجعتك",
  approved:"معتمدة داخليًا",failed:"فشلت"
};
const roleNames:Record<string,string>={
  director:"مدير الوكلاء",strategist:"الاستراتيجية",copywriter:"المحتوى",
  designer:"التصميم",media_buyer:"الإعلانات",support:"ردود العملاء",reviewer:"المراجعة"
};
async function checkThread(s:AgentSession,id:unknown):Promise<string>{
  if(typeof id!=="string"||!uuid.test(id))throw new Error("STUDIO_THREAD_INVALID");
  const {data,error}=await s.db.from("assistant_threads").select("id")
    .eq("id",id).eq("organization_id",s.organizationId)
    .eq("user_id",s.userId).maybeSingle();
  if(error||!data)throw new Error("STUDIO_THREAD_INVALID");
  return data.id as string;
}
async function snapshot(s:AgentSession,threadId:string){
  const [p,m,d]=await Promise.all([
    s.db.from("marketing_pages").select("id,name,platform,connection_status,target_audience,product_context")
      .eq("organization_id",s.organizationId).order("created_at",{ascending:true}).limit(80),
    s.db.from("agent_missions").select("id,page_id,objective,brief,status,created_at")
      .eq("organization_id",s.organizationId).order("created_at",{ascending:false}).limit(80),
    s.db.from("assistant_studio_drafts").select("id,page_id,objective,brief,status,mission_id")
      .eq("organization_id",s.organizationId).eq("user_id",s.userId)
      .eq("thread_id",threadId).order("created_at",{ascending:false}).limit(8)
  ]);
  if(p.error||m.error||d.error)throw p.error||m.error||d.error;
  return {pages:(p.data||[]) as Page[],missions:(m.data||[]) as Mission[],drafts:(d.data||[]) as Draft[]};
}
async function saveExchange(s:AgentSession,threadId:string,request:string,answer:string){
  const now=Date.now();
  const {data,error}=await s.db.from("assistant_messages").insert([
    {organization_id:s.organizationId,thread_id:threadId,role:"user",
      skill:"marketing",content:request.slice(0,4500),created_at:new Date(now).toISOString()},
    {organization_id:s.organizationId,thread_id:threadId,role:"assistant",
      skill:"marketing",model:"studio-data",content:answer.slice(0,11000),
      created_at:new Date(now+2).toISOString()}
  ]).select("id,role,content,model,skill,created_at");
  if(error)throw error;
  await s.db.from("assistant_threads").update({updated_at:new Date().toISOString()})
    .eq("id",threadId).eq("organization_id",s.organizationId)
    .eq("user_id",s.userId);
  return data||[];
}
function studioError(e:unknown){
  const code=e instanceof Error?e.message:"";
  const known:Record<string,[string,number]>={
    STUDIO_THREAD_INVALID:["المحادثة مش موجودة أو خارج حسابك.",404],
    STUDIO_PAGE_UNCLEAR:["حدد الصفحة المطلوبة من القائمة قبل تجهيز المهمة.",422],
    STUDIO_NO_PAGES:["لا توجد صفحات مسجلة. أضف صفحة أولًا من مدير الوكلاء.",422],
    STUDIO_MISSION_NOT_FOUND:["المهمة غير موجودة في مؤسستك.",404],
    STUDIO_DRAFT_NOT_FOUND:["المقترح غير موجود أو سبق استخدامه.",409]
  };
  if(known[code])return reply({error:known[code][0]},known[code][1]);
  const err=errorResponse(e);
  return reply({error:err.message},err.status);
}
function objectiveFrom(task:string):keyof typeof objectives{
  if(/(?:إعلان|اعلان|حملة|ترويج|campaign|ads)/i.test(task))return "campaign";
  if(/(?:ردود|رسائل العملاء|أسئلة العملاء|خدمة العملاء|replies)/i.test(task))return "replies";
  if(/(?:إطلاق|اطلاق|تدشين|launch)/i.test(task))return "launch";
  return "content";
}
function choosePage(pages:Page[],task:string,selected?:unknown){
  if(typeof selected==="string"&&uuid.test(selected)){
    return pages.find(p=>p.id===selected)||null;
  }
  const norm=task.toLocaleLowerCase("ar");
  const ranked=pages.filter(p=>p.name.length>1&&norm.includes(p.name.toLocaleLowerCase("ar")));
  if(ranked.length===1)return ranked[0];
  return pages.length===1?pages[0]:null;
}
export async function GET(req:NextRequest){
  try{
    const s=await requireAgentSession(req);
    const threadId=await checkThread(s,new URL(req.url).searchParams.get("threadId"));
    return reply(await snapshot(s,threadId));
  }catch(e){return studioError(e);}
}
export async function POST(req:NextRequest){
  try{
    const s=await requireAgentSession(req);
    const body=await req.json() as{
      action?:unknown;threadId?:unknown;task?:unknown;pageId?:unknown;
      objective?:unknown;draftId?:unknown;missionId?:unknown;
      pageName?:unknown;platform?:unknown;productContext?:unknown;
      targetAudience?:unknown;brandVoice?:unknown
    };
    const threadId=await checkThread(s,body.threadId);
    if(body.action==="create_page"){
      const field=(value:unknown,max:number)=>typeof value==="string"?value.trim().slice(0,max+1):"";
      const name=field(body.pageName,120);
      const platform=body.platform;
      const productContext=field(body.productContext,4000);
      const targetAudience=field(body.targetAudience,2000);
      const brandVoice=field(body.brandVoice,500)||"مصري احترافي وواضح";
      if(name.length<2||name.length>120||
        (platform!=="facebook"&&platform!=="instagram")||
        productContext.length>4000||targetAudience.length>2000||
        brandVoice.length>500)
        return reply({error:"راجع اسم الصفحة (2–120 حرفًا)، والمنصة، ومعلومات النشاط."},400);
      const {data:known,error:lookupError}=await s.db.from("marketing_pages")
        .select("id,name,created_at").eq("organization_id",s.organizationId)
        .order("created_at",{ascending:false}).limit(90);
      if(lookupError)throw lookupError;
      if((known||[]).length>=80)
        return reply({error:"وصلت للحد الحالي من الصفحات المسجلة في الاستوديو."},429);
      if((known||[]).some(p=>p.name.trim().toLocaleLowerCase("ar")===name.toLocaleLowerCase("ar")))
        return reply({error:"فيه صفحة بنفس الاسم مسجلة بالفعل. اختر اسمًا مختلفًا."},409);
      const tenMinutesAgo=Date.now()-10*60_000;
      if((known||[]).filter(p=>Date.parse(p.created_at)>=tenMinutesAgo).length>=5)
        return reply({error:"الحد 5 صفحات جديدة في 10 دقائق؛ حاول لاحقًا."},429);
      const {data:page,error:createError}=await s.db.from("marketing_pages")
        .insert({organization_id:s.organizationId,name,platform,
          product_context:productContext,target_audience:targetAudience,
          brand_voice:brandVoice})
        .select("id,name,platform").single();
      if(createError||!page)throw createError||new Error("PAGE_CREATE_FAILED");
      let messages=[];
      try{
        messages=await saveExchange(s,threadId,
          "أضف صفحة التسويق "+name,
          "**تم إنشاء ملف صفحة "+name+" داخل AGENT** ✅\n\n"+
          "المنصة: "+(platform==="facebook"?"Facebook":"Instagram")+
          "\nالحالة: غير متصلة بحساب Meta. ده ملف إدارة داخلي فقط؛ لم يتم نشر محتوى أو ربط حساب خارجي.");
      }catch{console.warn("AGENT page created but chat history unavailable");}
      const data=await snapshot(s,threadId);
      return reply({ok:true,pageId:page.id,page,messages,...data});
    }
    if(body.action==="overview"){
      const data=await snapshot(s,threadId);
      const pageNames=new Map(data.pages.map(p=>[p.id,p.name]));
      const pagesText=data.pages.length?
        data.pages.map(p=>"- "+p.name+" ("+(p.platform==="facebook"?"فيسبوك":"إنستجرام")+
          "، "+(p.connection_status==="connected"?"متصلة":"غير متصلة")+")").join("\n"):
        "لا توجد صفحات مسجلة.";
      const requested=typeof body.task==="string"?body.task.toLocaleLowerCase("ar"):"";
      const target=data.pages.find(p=>requested.includes(p.name.toLocaleLowerCase("ar")));
      const pageDetails=target?"\n\n**تفاصيل "+target.name+"**\n"+
        "الجمهور: "+(target.target_audience||"غير محدد")+"\n"+
        "وصف النشاط: "+(target.product_context||"غير محدد"):"";
      const missionsText=data.missions.length?
        data.missions.slice(0,8).map(m=>"- "+(pageNames.get(m.page_id)||"صفحة غير معروفة")+
          " · "+(objectives[m.objective]||m.objective)+" · "+
          (statusNames[m.status]||m.status)).join("\n"):
        "لا توجد مهام مسجلة.";
      const answer="**صفحات AGENT المسجلة ("+data.pages.length+")**\n"+
        pagesText+pageDetails+"\n\n**المهام الحالية**\n"+missionsText+"\n\n"+
        "البيانات مقروءة من Supabase الخاصة بمؤسستك. "+
        "لإضافة مهمة، اكتب المطلوب ثم راجع المقترح قبل الحفظ. لا يوجد نشر خارجي.";
      const messages=await saveExchange(s,threadId,typeof body.task==="string"?body.task:"اعرض صفحات ومهام AGENT",answer);
      return reply({ok:true,messages,...data});
    }
    if(body.action==="prepare"){
      const task=typeof body.task==="string"?body.task.trim():"";
      if(task.length<10||task.length>1800)return reply({error:"اكتب تكليفًا واضحًا بين 10 و1800 حرف."},400);
      const data=await snapshot(s,threadId);
      if(!data.pages.length)throw new Error("STUDIO_NO_PAGES");
      const page=choosePage(data.pages,task,body.pageId);
      if(!page)return reply({error:"حدد الصفحة المطلوبة من القائمة، عندك "+data.pages.length+" صفحات."},422);
      const objective=typeof body.objective==="string"&&body.objective in objectives?
        body.objective:objectiveFrom(task);
      const {count,error:countError}=await s.db.from("assistant_studio_drafts")
        .select("id",{head:true,count:"exact"}).eq("organization_id",s.organizationId)
        .eq("user_id",s.userId)
        .gte("created_at",new Date(Date.now()-600000).toISOString());
      if(countError)throw countError;
      if((count||0)>=8)return reply({error:"تم بلوغ 8 مقترحات في 10 دقائق؛ حاول بعد قليل."},429);
      const {data:draft,error}=await s.db.from("assistant_studio_drafts").insert({
        organization_id:s.organizationId,user_id:s.userId,thread_id:threadId,
        page_id:page.id,objective,brief:task,status:"draft"
      }).select("id,page_id,objective,brief,status,mission_id").single();
      if(error||!draft)throw error||new Error("STUDIO_DRAFT_SAVE_FAILED");
      const answer="**مهمة مقترحة للمراجعة**\n\nالصفحة: **"+page.name+
        "**\nالنوع: **"+objectives[objective]+"**\n\nالتكليف: "+task+
        "\n\n**لم تُحفظ كمهمة فعلية بعد.** راجع البيانات واضغط «تأكيد إضافة المهمة» أدناه.";
      const messages=await saveExchange(s,threadId,task,answer);
      return reply({ok:true,draft,messages,...{pages:data.pages,missions:data.missions}});
    }
    if(body.action==="confirm"){
      if(typeof body.draftId!=="string"||!uuid.test(body.draftId))
        return reply({error:"المقترح غير صحيح."},400);
      const {data:draft,error:readError}=await s.db.from("assistant_studio_drafts")
        .select("id,page_id,objective,brief,status,mission_id").eq("id",body.draftId)
        .eq("organization_id",s.organizationId).eq("user_id",s.userId)
        .eq("thread_id",threadId).maybeSingle();
      if(readError||!draft)throw new Error("STUDIO_DRAFT_NOT_FOUND");
      if(draft.status!=="draft")throw new Error("STUDIO_DRAFT_NOT_FOUND");
      const {data:page,error:pageError}=await s.db.from("marketing_pages")
        .select("id,name").eq("id",draft.page_id)
        .eq("organization_id",s.organizationId).maybeSingle();
      if(pageError||!page)throw new Error("STUDIO_NO_PAGES");
      const {data:claim,error:claimError}=await s.db.from("assistant_studio_drafts")
        .update({status:"creating",updated_at:new Date().toISOString()})
        .eq("id",draft.id).eq("status","draft")
        .eq("user_id",s.userId).eq("organization_id",s.organizationId)
        .select("id").maybeSingle();
      if(claimError)throw claimError;
      if(!claim)throw new Error("STUDIO_DRAFT_NOT_FOUND");
      let missionId:string|null=null;
      try{
        const {data:mission,error:createError}=await s.db.from("agent_missions")
          .insert({organization_id:s.organizationId,page_id:page.id,
            objective:draft.objective,brief:draft.brief,budget_egp:null,
            requested_by:s.userId})
          .select("id").single();
        if(createError||!mission)throw createError||new Error("STUDIO_CREATE_FAILED");
        missionId=mission.id;
        const {error:updateError}=await s.db.from("assistant_studio_drafts")
          .update({status:"created",mission_id:mission.id,updated_at:new Date().toISOString()})
          .eq("id",draft.id).eq("status","creating")
          .eq("organization_id",s.organizationId).eq("user_id",s.userId);
        if(updateError)throw updateError;
      }catch(e){
        // Never automatically repeat creation when the mission was inserted.
        if(!missionId)await s.db.from("assistant_studio_drafts")
          .update({status:"draft"}).eq("id",draft.id).eq("status","creating")
          .eq("organization_id",s.organizationId).eq("user_id",s.userId);
        throw e;
      }
      const answer="**تم حفظ المهمة في AGENT** ✅\n\nالصفحة: "+
        page.name+"\nالنوع: "+(objectives[draft.objective]||draft.objective)+
        "\nالحالة: جاهزة للتشغيل.\n\n"+
        "لم تُشغّل الوكلاء بعد. تشغيلهم يحتاج موافقتك وقد يستخدم حصة نموذج AI. "+
        "لن يتم نشر محتوى أو صرف أموال.";
      const messages=await saveExchange(s,threadId,"تأكيد إضافة مهمة "+page.name,answer);
      return reply({ok:true,messages,missionId,draft:{...draft,status:"created",mission_id:missionId}});
    }
    if(body.action==="summary"){
      const data=await snapshot(s,threadId);
      const requested=typeof body.task==="string"?body.task.toLocaleLowerCase("ar"):"";
      const target=data.pages.find(p=>requested.includes(p.name.toLocaleLowerCase("ar")));
      const mission=typeof body.missionId==="string"&&uuid.test(body.missionId)?
        data.missions.find(m=>m.id===body.missionId):
        target?data.missions.find(m=>m.page_id===target.id):data.missions[0];
      if(!mission)throw new Error("STUDIO_MISSION_NOT_FOUND");
      const page=data.pages.find(p=>p.id===mission.page_id);
      const {data:outputs,error}=await s.db.from("agent_outputs")
        .select("agent_role,content,model")
        .eq("organization_id",s.organizationId).eq("mission_id",mission.id)
        .order("created_at",{ascending:true}).limit(7);
      if(error)throw error;
      const entries=outputs||[];
      const overview=entries.length?entries.map(e=>{
        const text=String(e.content).trim().replace(/\s+/g," ");
        const snippet=text.length>340?text.slice(0,340)+"…":text;
        return "- **"+(roleNames[e.agent_role]||e.agent_role)+":** "+snippet;
      }).join("\n"):"لم تُنتج مخرجات لهذه المهمة حتى الآن.";
      const answer="**ملخص المهمة — "+(page?.name||"صفحة مسجلة")+"**\n"+
        "النوع: "+(objectives[mission.objective]||mission.objective)+
        " · الحالة: "+(statusNames[mission.status]||mission.status)+"\n\n"+
        "**مخرجات الوكلاء ("+entries.length+")**\n"+overview+"\n\n"+
        (mission.status==="review"?
          "هذه مسودات تحتاج مراجعتك قبل اعتمادها داخليًا. لم يتم نشرها.":
          mission.status==="queued"?
          "المهمة لم تُشغّل بعد.":"هذه مقتطفات من النتائج المحفوظة؛ افتح الاستوديو لعرض النصوص كاملة.");
      const messages=await saveExchange(s,threadId,"لخص نتائج مهمة "+(page?.name||""),answer);
      return reply({ok:true,messages,missionId:mission.id,outputsCount:entries.length});
    }
    return reply({error:"إجراء غير معروف."},400);
  }catch(e){return studioError(e);}
}
