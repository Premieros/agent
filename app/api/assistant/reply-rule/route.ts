import {NextRequest,NextResponse} from "next/server";
import {requireAgentSession,errorResponse} from "@/lib/agent-server";

export const runtime="nodejs";
const DEFAULT_PHRASE="#مساعد";
const phrasePattern=/^#?[\p{L}\p{N}_-]{2,31}$/u;

export async function GET(req:NextRequest){
  try{
    const {db,organizationId}=await requireAgentSession(req);
    const {data,error}=await db.from("agent_reply_rules")
      .select("trigger_phrase,enabled,updated_at")
      .eq("organization_id",organizationId).maybeSingle();
    if(error)throw error;
    return NextResponse.json({
      triggerPhrase:data?.trigger_phrase||DEFAULT_PHRASE,
      enabled:data?.enabled??false,
      saved:Boolean(data),
      externalChannelsConnected:false,
      hint:"يشترط أن تبدأ رسالة العميل بالكلمة متبوعة بمسافة أو تكون الكلمة وحدها."
    },{headers:{"Cache-Control":"no-store"}});
  }catch(err){
    const r=errorResponse(err);
    return NextResponse.json({error:r.message},{status:r.status,headers:{"Cache-Control":"no-store"}});
  }
}

export async function POST(req:NextRequest){
  try{
    const {db,organizationId,role}=await requireAgentSession(req);
    if(!["admin","manager"].includes(role)){
      return NextResponse.json({error:"تعديل شرط الاستلام متاح للمدير فقط."},{status:403});
    }
    const body=await req.json() as {triggerPhrase?:unknown;enabled?:unknown};
    const phrase=typeof body.triggerPhrase==="string"?body.triggerPhrase.trim():"";
    if(!phrasePattern.test(phrase)||typeof body.enabled!=="boolean"){
      return NextResponse.json({error:"اكتب كلمة شرط من 2 إلى 32 حرفًا، بدون مسافات. مثال: #مساعد"},
        {status:400});
    }
    const {error}=await db.from("agent_reply_rules").upsert({
      organization_id:organizationId,
      trigger_phrase:phrase,
      enabled:body.enabled,
      updated_at:new Date().toISOString()
    },{onConflict:"organization_id"});
    if(error)throw error;
    return NextResponse.json({ok:true,triggerPhrase:phrase,enabled:body.enabled,
      externalChannelsConnected:false},
      {headers:{"Cache-Control":"no-store"}});
  }catch(err){
    const r=errorResponse(err);
    return NextResponse.json({error:r.message},{status:r.status,headers:{"Cache-Control":"no-store"}});
  }
}
