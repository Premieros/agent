import {NextRequest,NextResponse} from "next/server";
import {requireAgentSession,errorResponse} from "@/lib/agent-server";
export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const out=(x:unknown,status=200)=>NextResponse.json(x,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:NextRequest){
 try{
  const s=await requireAgentSession(req);
  const projectId=new URL(req.url).searchParams.get("projectId");
  if(!projectId||!uuid.test(projectId))return out({error:"projectId required"},400);
  const {data,error}=await s.db.from("support_widgets").select("id,public_key,allowed_origin,enabled,created_at")
   .eq("organization_id",s.organizationId).eq("project_id",projectId).limit(50);
  if(error)throw error;return out({widgets:data||[]});
 }catch(e){const r=errorResponse(e);return out({error:r.message},r.status);}
}
export async function POST(req:NextRequest){
 try{
  const s=await requireAgentSession(req);const b=await req.json() as {projectId?:unknown;origin?:unknown};
  if(typeof b.projectId!=="string"||!uuid.test(b.projectId)||typeof b.origin!=="string")
   return out({error:"المشروع أو نطاق الموقع غير صالح."},400);
  let url:URL;try{url=new URL(b.origin);}catch{return out({error:"أدخل عنوان HTTPS صحيح."},400);}
  if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash)
   return out({error:"يجب استخدام أصل HTTPS فقط مثل https://example.com"},400);
  const origin=url.origin;
  const {data,error}=await s.db.from("support_widgets").insert({
   organization_id:s.organizationId,project_id:b.projectId,allowed_origin:origin
  }).select("id,public_key,allowed_origin,enabled").single();
  if(error||!data)return out({error:"تعذر إنشاء المفتاح. تحقق من المشروع وصلاحياتك."},403);
  return out({widget:data},201);
 }catch(e){const r=errorResponse(e);return out({error:r.message},r.status);}
}
export async function PATCH(req:NextRequest){
 try{
  const s=await requireAgentSession(req);const b=await req.json() as {id?:unknown;projectId?:unknown;enabled?:unknown};
  if(typeof b.id!=="string"||!uuid.test(b.id)||typeof b.projectId!=="string"||!uuid.test(b.projectId)||typeof b.enabled!=="boolean")
   return out({error:"بيانات المفتاح غير صحيحة."},400);
  const {data,error}=await s.db.from("support_widgets").update({enabled:b.enabled})
   .eq("id",b.id).eq("project_id",b.projectId).eq("organization_id",s.organizationId)
   .select("id,enabled").maybeSingle();
  if(error||!data)return out({error:"تعذر تحديث المفتاح."},403);
  return out({widget:data});
 }catch(e){const r=errorResponse(e);return out({error:r.message},r.status);}
}
