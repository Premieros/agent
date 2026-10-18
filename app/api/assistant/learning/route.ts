import {NextRequest,NextResponse} from "next/server";
import {requireAgentSession,errorResponse,type AgentSession} from "@/lib/agent-server";
export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore={"Cache-Control":"no-store"};
const respond=(obj:unknown,status=200)=>NextResponse.json(obj,{status,headers:noStore});
const allowedBases=new Set(["general","writing","marketing","coding","analysis","planning","learning","translation"]);
const sensitive=/(?:sk-[a-zA-Z0-9_-]{12,}|ghp_[a-zA-Z0-9]{18,}|Bearer\s+\S{16,}|(?:password|api[_\s-]?key|private[_\s-]?key|كلمة\s*المرور|رمز\s*التحقق)\s*[:=])/i;
function clean(input:unknown,min:number,max:number):string|null{
  if(typeof input!=="string")return null;
  const value=input.trim();
  if(value.length<min||value.length>max||sensitive.test(value))return null;
  return value;
}
async function ownThread(s:AgentSession,id:unknown){
  if(typeof id!=="string"||!uuid.test(id))return false;
  const {data,error}=await s.db.from("assistant_threads").select("id")
    .eq("organization_id",s.organizationId).eq("user_id",s.userId).eq("id",id).maybeSingle();
  if(error)throw error;
  return Boolean(data);
}
export async function GET(req:NextRequest){
  try{
    const s=await requireAgentSession(req);
    const threadId=new URL(req.url).searchParams.get("threadId");
    if(threadId&&!(await ownThread(s,threadId)))return respond({error:"المحادثة غير صحيحة."},404);
    const [m,skills]=await Promise.all([
      s.db.from("assistant_memories")
        .select("id,scope,thread_id,category,subject,content,status,source,created_at")
        .eq("organization_id",s.organizationId).eq("user_id",s.userId)
        .order("created_at",{ascending:false}).limit(80),
      s.db.from("assistant_custom_skills")
        .select("id,title,description,instructions,phrases,base_skill,status,source")
        .eq("organization_id",s.organizationId).eq("user_id",s.userId)
        .order("created_at",{ascending:false}).limit(50)
    ]);
    if(m.error||skills.error)throw m.error||skills.error;
    const memories=(m.data||[]).filter(x=>x.scope==="global"||x.thread_id===threadId);
    return respond({memories,skills:skills.data||[]});
  }catch(e){const v=errorResponse(e);return respond({error:v.message},v.status);}
}
export async function POST(req:NextRequest){
  try{
    const s=await requireAgentSession(req);
    const {db,organizationId,userId}=s;
    const b=await req.json() as{
      action?:unknown;id?:unknown;scope?:unknown;threadId?:unknown;
      category?:unknown;subject?:unknown;content?:unknown;
      title?:unknown;description?:unknown;instructions?:unknown;
      phrases?:unknown;baseSkill?:unknown
    };
    if(b.action==="add_memory"){
      const subject=clean(b.subject,3,110),content=clean(b.content,4,900);
      const scope=b.scope==="thread"?"thread":"global";
      if(!subject||!content)return respond({error:"اكتب عنوانًا ومعلومة واضحة، بدون مفاتيح أو كلمات مرور."},400);
      if(scope==="thread"&&!(await ownThread(s,b.threadId)))
        return respond({error:"اختر محادثة صحيحة لحفظ ذاكرة المشروع."},400);
      const {count,error:countError}=await db.from("assistant_memories")
        .select("id",{count:"exact",head:true})
        .eq("organization_id",organizationId).eq("user_id",userId);
      if(countError)throw countError;
      if((count||0)>=80)return respond({error:"حد الذاكرة 80 عنصرًا؛ احذف العناصر القديمة أولًا."},429);
      const {data,error}=await db.from("assistant_memories").insert({
        organization_id:organizationId,user_id:userId,
        thread_id:scope==="thread"?b.threadId:null,scope,
        category:["decision","project","preference","lesson"].includes(String(b.category))
          ?b.category:"project",
        subject,content,status:"active",source:"user"
      }).select("id").single();
      if(error)throw error;
      return respond({ok:true,id:data.id});
    }
    if(b.action==="create_skill"){
      const title=clean(b.title,3,90);
      const description=clean(b.description,0,250);
      const instructions=clean(b.instructions,12,1000);
      const phrases=Array.isArray(b.phrases)?
        b.phrases.filter((x):x is string=>typeof x==="string").map(x=>x.trim()) :[];
      if(!title||description===null||!instructions||
         !allowedBases.has(String(b.baseSkill))||
         phrases.length<1||phrases.length>6||
         phrases.some(x=>x.length<4||x.length>80||sensitive.test(x)))
        return respond({error:"أدخل اسمًا وتعليمات وعبارات مطابقة صحيحة للمهارة."},400);
      const {count,error:countError}=await db.from("assistant_custom_skills")
        .select("id",{count:"exact",head:true})
        .eq("organization_id",organizationId).eq("user_id",userId);
      if(countError)throw countError;
      if((count||0)>=30)return respond({error:"حد المهارات 30؛ عطّل أو احذف القديمة."},429);
      const {data,error}=await db.from("assistant_custom_skills").insert({
        organization_id:organizationId,user_id:userId,title,description,
        instructions,phrases,base_skill:b.baseSkill,
        status:"suggested",source:"user"
      }).select("id").single();
      if(error)throw error;
      return respond({ok:true,id:data.id});
    }
    const memoryActions:Record<string,"active"|"delete">={
      approve_memory:"active",delete_memory:"delete"
    };
    const skillActions:Record<string,"active"|"disabled"|"delete">={
      approve_skill:"active",disable_skill:"disabled",delete_skill:"delete"
    };
    if(typeof b.id!=="string"||!uuid.test(b.id))
      return respond({error:"حدد عنصرًا صحيحًا."},400);
    const action=String(b.action);
    if(Object.prototype.hasOwnProperty.call(memoryActions,action)){
      const target=memoryActions[action];
      const base=db.from("assistant_memories");
      const query=target==="delete"
        ?base.delete().eq("id",b.id)
        :base.update({status:target,updated_at:new Date().toISOString()}).eq("id",b.id);
      const {data,error}=await query.eq("organization_id",organizationId)
        .eq("user_id",userId).select("id").maybeSingle();
      if(error)throw error;
      return data?respond({ok:true}):respond({error:"العنصر غير موجود."},404);
    }
    if(Object.prototype.hasOwnProperty.call(skillActions,action)){
      const target=skillActions[action];
      const base=db.from("assistant_custom_skills");
      const query=target==="delete"
        ?base.delete().eq("id",b.id)
        :base.update({status:target,updated_at:new Date().toISOString()}).eq("id",b.id);
      const {data,error}=await query.eq("organization_id",organizationId)
        .eq("user_id",userId).select("id").maybeSingle();
      if(error)throw error;
      return data?respond({ok:true}):respond({error:"المهارة غير موجودة."},404);
    }
    return respond({error:"إجراء غير معروف."},400);
  }catch(e){
    const v=errorResponse(e);
    return respond({error:v.message},v.status);
  }
}
