import {IDENTITY_PREFIX,parseVerifiedIdentity} from "@/lib/premier-support-identity";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {supportService,getWidget,consume,ipFor} from "@/lib/support-public";

export const runtime="nodejs";
const PREMIER_ORIGIN="https://premieros-sage.vercel.app";
const PREMIER_URL="https://hvqlkapynjfjikqithvd.supabase.co";
const PREMIER_WIDGET_KEY="dc926f2840ca4334fd94c0dc811e481c73c9b6843d178729";
const corsHeaders={
 "Access-Control-Allow-Origin":PREMIER_ORIGIN,
 "Access-Control-Allow-Methods":"GET,OPTIONS",
 "Access-Control-Allow-Headers":"Authorization,Content-Type",
 "Access-Control-Max-Age":"300",
 "Cache-Control":"private, no-store",
 "Vary":"Origin"
};
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:corsHeaders});

export async function OPTIONS(req:NextRequest){
 if(req.headers.get("origin")!==PREMIER_ORIGIN)return new NextResponse(null,{status:403});
 return new NextResponse(null,{status:204,headers:corsHeaders});
}

/**
 * Verify a REAL Premier Supabase Auth access token against Premier Auth, then
 * verify the active server-stored super_admin role from Premier's users table.
 * Only conversations for the single approved Premier widget are returned.
 * Neither an AGENT login nor an AGENT access token is requested in Premier.
 */
export async function GET(req:NextRequest){
 if(req.headers.get("origin")!==PREMIER_ORIGIN)return reply({error:"الموقع غير مسموح."},403);
 const authorization=req.headers.get("authorization")||"";
 const token=authorization.startsWith("Bearer ")?authorization.slice(7).trim():"";
 if(!token||token.length>4000)return reply({error:"يرجى تسجيل الدخول إلى Premier."},401);
 const publishableKey=process.env.PREMIER_SUPABASE_PUBLISHABLE_KEY;
 if(!publishableKey)return reply({error:"لم يكتمل إعداد تكامل Premier على الخادم."},503);
 try{
  const premier=createClient(PREMIER_URL,publishableKey,{
   global:{headers:{Authorization:"Bearer "+token}},
   auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:userResult,error:authError}=await premier.auth.getUser(token);
  if(authError||!userResult.user)return reply({error:"جلسة Premier غير صالحة."},401);
  const {data:profile,error:profileError}=await premier.from("users")
   .select("id,role,is_active").eq("id",userResult.user.id).maybeSingle();
  if(profileError||!profile||profile.is_active===false||profile.role!=="super_admin")
   return reply({error:"عرض المحادثات متاح للمدير العام فقط."},403);

  const db=supportService();
  if(!db)return reply({error:"خادم دعم العملاء غير متاح."},503);
  const widget=await getWidget(db,PREMIER_WIDGET_KEY,PREMIER_ORIGIN);
  if(!widget)return reply({error:"ربط مشروع Premier غير متاح."},503);
  const permitted=await consume(db,"premier-admin-inbox",userResult.user.id+":"+ipFor(req),30,60);
  if(!permitted)return reply({error:"طلبات كثيرة؛ يرجى المحاولة بعد دقيقة."},429);
  const {data:conversations,error:convError}=await db.from("support_conversations")
   .select("id,project_id,widget_id,mode,created_at,updated_at")
   .eq("organization_id",widget.organization_id)
   .eq("project_id",widget.project_id).eq("widget_id",widget.id)
   .order("updated_at",{ascending:false}).limit(40);
  if(convError)return reply({error:"تعذر تحميل محادثات Premier."},503);
  if(!conversations?.length)return reply({conversations:[],messages:[]});
  const ids=conversations.map(c=>c.id);
  const [{data:project,error:projectError},{data:messages,error:messageError},{data:identities,error:identityError}]=await Promise.all([
   db.from("support_projects").select("name").eq("id",widget.project_id)
    .eq("organization_id",widget.organization_id).maybeSingle(),
   db.from("support_messages").select("id,conversation_id,project_id,role,body,created_at")
    .eq("organization_id",widget.organization_id).eq("project_id",widget.project_id)
    .in("conversation_id",ids).neq("role","system")
    .order("created_at",{ascending:false}).limit(1200),
   db.from("support_messages").select("conversation_id,body,created_at")
    .eq("organization_id",widget.organization_id).eq("project_id",widget.project_id)
    .in("conversation_id",ids).eq("role","system")
    .like("body",IDENTITY_PREFIX+"%").order("created_at",{ascending:false}).limit(300)
  ]);
  if(projectError||messageError||identityError)return reply({error:"تعذر تحميل رسائل Premier."},503);
  const identityByConversation=new Map<string,ReturnType<typeof parseVerifiedIdentity>>();
  for(const item of identities||[]){
   if(identityByConversation.has(item.conversation_id))continue;
   const identity=parseVerifiedIdentity(item.body);
   if(identity)identityByConversation.set(item.conversation_id,identity);
  }
  const counts=new Map<string,number>();
  const safeMessages=(messages||[]).filter(m=>{
   if(m.project_id!==widget.project_id||!ids.includes(m.conversation_id))return false;
   const n=counts.get(m.conversation_id)||0;
   if(n>=60)return false;
   counts.set(m.conversation_id,n+1);
   return true;
  }).reverse().map(m=>({
   id:m.id,conversationId:m.conversation_id,role:m.role,
   body:m.body,createdAt:m.created_at
  }));
  return reply({
   conversations:conversations.map(c=>({
    id:c.id,projectId:c.project_id,projectName:project?.name||"Premier",
    origin:PREMIER_ORIGIN,mode:c.mode,
    employeeName:identityByConversation.get(c.id)?.employeeName||null,
    branchName:identityByConversation.get(c.id)?.branchName||null,
    organizationName:identityByConversation.get(c.id)?.organizationName||null,
    identityVerified:identityByConversation.has(c.id),
    createdAt:c.created_at,updatedAt:c.updated_at
   })),
   messages:safeMessages
  });
 }catch{return reply({error:"تعذر التحقق من جلسة Premier أو تحميل الرسائل."},503);}
}
