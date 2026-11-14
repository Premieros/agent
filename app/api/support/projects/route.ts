import { NextRequest, NextResponse } from "next/server";
import { requireAgentSession, errorResponse } from "@/lib/agent-server";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });
const supportError = (error:unknown):{error:string;code:string;status:number} => {
 const e=error&&typeof error==="object"?error as {code?:string;message?:string;status?:number}:null;
 const code=e?.code||"UNKNOWN";
 if(code==="PGRST205"||code==="42P01"||code==="PGRST200")
  return {error:"جداول خدمة العملاء غير مفعّلة في Supabase. يجب تطبيق ترحيل support_ai_multproject أولًا.",code,status:503};
 if(code==="42501"||e?.status===401||e?.status===403)
  return {error:"تعذر قراءة مشاريع خدمة العملاء بسبب أذونات قاعدة البيانات أو الجلسة. تحقق من GRANT وRLS للمستخدم المسجل.",code,status:403};
 const known=errorResponse(error);
 return {error:known.message,code,status:known.status};
};
const clean = (v:unknown, max:number) => typeof v==="string" && v.trim().length>0 && v.trim().length<=max ? v.trim() : null;
export async function GET(req:NextRequest) {
 try {
  const s = await requireAgentSession(req);
  const {data,error} = await s.db.from("support_projects")
   .select("id,name,slug,instructions,created_at")
   .eq("organization_id",s.organizationId).order("created_at",{ascending:false}).limit(100);
  if(error) { const x=supportError(error);return reply({error:x.error,code:x.code},x.status); }
  return reply({projects:data||[]});
 } catch(e) {const x=supportError(e);return reply({error:x.error,code:x.code},x.status);}
}
export async function POST(req:NextRequest) {
 try {
  const s = await requireAgentSession(req);
  const name = await req.json() as {name?:unknown;slug?:unknown;instructions?:unknown};
  const title=clean(name.name,120);
  const slug=clean(name.slug,64);
  if(!title||title.length<2||!slug||!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug))
   return reply({error:"أدخل اسم مشروع ورمزًا من الحروف الإنجليزية الصغيرة والأرقام."},400);
  const instructions=typeof name.instructions==="string"&&name.instructions.trim()
   ? clean(name.instructions,12000):undefined;
  if(typeof name.instructions==="string"&&name.instructions.trim()&&!instructions)
   return reply({error:"التعليمات طويلة جدًا."},400);
  const {data,error}=await s.db.from("support_projects")
   .insert({organization_id:s.organizationId,name:title,slug,...(instructions?{instructions}:{})})
   .select("id,name,slug,instructions").single();
  if(error)return reply({error:"تعذر إنشاء المشروع. تحقق من الصلاحيات وعدم تكرار الرمز."},403);
  return reply({project:data},201);
 } catch(e){const x=supportError(e);return reply({error:x.error,code:x.code},x.status);}
}
export async function PATCH(req:NextRequest) {
 try {
  const s=await requireAgentSession(req);
  const body=await req.json() as {projectId?:unknown;name?:unknown;instructions?:unknown};
  if(typeof body.projectId!=="string"||!uuid.test(body.projectId))
   return reply({error:"معرّف مشروع غير صالح."},400);
  const patch:Record<string,string>={};
  if(body.name!==undefined){const v=clean(body.name,120);if(!v||v.length<2)return reply({error:"اسم غير صالح."},400);patch.name=v;}
  if(body.instructions!==undefined){const v=clean(body.instructions,12000);if(!v)return reply({error:"تعليمات غير صالحة."},400);patch.instructions=v;}
  if(!Object.keys(patch).length)return reply({error:"لم تحدد تغييرات."},400);
  const {data,error}=await s.db.from("support_projects").update(patch)
   .eq("id",body.projectId).eq("organization_id",s.organizationId)
   .select("id,name,slug,instructions").maybeSingle();
  if(error||!data)return reply({error:"تعذر تعديل المشروع."},403);
  return reply({project:data});
 } catch(e){const x=errorResponse(e);return reply({error:x.message},x.status);}
}
