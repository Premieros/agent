import {NextRequest,NextResponse} from "next/server";
import {requireAgentSession,errorResponse} from "@/lib/agent-server";
export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const out=(x:unknown,status=200)=>NextResponse.json(x,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:NextRequest){
 try{
  const s=await requireAgentSession(req);const projectId=new URL(req.url).searchParams.get("projectId");
  if(!projectId||!uuid.test(projectId))return out({error:"projectId required"},400);
  const {data,error}=await s.db.from("support_documents").select("id,title,created_at")
    .eq("organization_id",s.organizationId).eq("project_id",projectId)
    .order("created_at",{ascending:false}).limit(100);
  if(error)throw error;return out({documents:data||[]});
 }catch(e){const r=errorResponse(e);return out({error:r.message},r.status);}
}
export async function POST(req:NextRequest){
 try{
  const s=await requireAgentSession(req);
  const b=await req.json() as {projectId?:unknown;title?:unknown;content?:unknown};
  if(typeof b.projectId!=="string"||!uuid.test(b.projectId)||typeof b.title!=="string"||b.title.trim().length<1||b.title.length>200||
    typeof b.content!=="string"||b.content.trim().length===0||b.content.length>200000)
    return out({error:"بيانات الملف غير صحيحة. يمكن إضافة نص حتى 200 ألف حرف."},400);
  const {data,error}=await s.db.from("support_documents").insert({
   organization_id:s.organizationId,project_id:b.projectId,title:b.title.trim(),content:b.content.trim()
  }).select("id,title,created_at").single();
  if(error)return out({error:"تعذر حفظ المعرفة. تحقق من المشروع والصلاحيات."},403);
  return out({document:data},201);
 }catch(e){const r=errorResponse(e);return out({error:r.message},r.status);}
}
export async function DELETE(req:NextRequest){
 try{
  const s=await requireAgentSession(req);const u=new URL(req.url),id=u.searchParams.get("id"),projectId=u.searchParams.get("projectId");
  if(!id||!uuid.test(id)||!projectId||!uuid.test(projectId))return out({error:"معرّفات غير صحيحة."},400);
  const {data,error}=await s.db.from("support_documents").delete().eq("id",id)
   .eq("organization_id",s.organizationId).eq("project_id",projectId).select("id").maybeSingle();
  if(error||!data)return out({error:"لم يُحذف المستند؛ تحقق من الصلاحيات."},403);
  return out({ok:true});
 }catch(e){const r=errorResponse(e);return out({error:r.message},r.status);}
}
