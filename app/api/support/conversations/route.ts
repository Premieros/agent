import {NextRequest,NextResponse} from "next/server";
import {requireAgentSession,errorResponse} from "@/lib/agent-server";

export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});

/**
 * Admin-only, organization-scoped read access. A valid AGENT Supabase session is
 * mandatory; a public widget key or visitor token never grants inbox access.
 */
export async function GET(req:NextRequest){
 try{
  const session=await requireAgentSession(req);
  const url=new URL(req.url);
  const projectId=url.searchParams.get("projectId");
  const conversationId=url.searchParams.get("conversationId");
  if(projectId&&!uuid.test(projectId))return response({error:"معرف المشروع غير صالح."},400);
  if(conversationId&&!uuid.test(conversationId))return response({error:"معرف المحادثة غير صالح."},400);
  if(projectId){
   const {data:project,error}=await session.db.from("support_projects")
    .select("id").eq("organization_id",session.organizationId).eq("id",projectId).maybeSingle();
   if(error)return response({error:"تعذر التحقق من صلاحية المشروع."},503);
   if(!project)return response({error:"المشروع غير متاح."},404);
  }

  if(conversationId){
   let q=session.db.from("support_conversations")
    .select("id,project_id,mode,created_at,updated_at")
    .eq("organization_id",session.organizationId).eq("id",conversationId);
   if(projectId)q=q.eq("project_id",projectId);
   const {data:conversation,error:conversationError}=await q.maybeSingle();
   if(conversationError)return response({error:"تعذر تحميل المحادثة."},503);
   if(!conversation)return response({error:"المحادثة غير موجودة."},404);
   const {data:messages,error:messagesError}=await session.db.from("support_messages")
    .select("id,role,body,created_at")
    .eq("organization_id",session.organizationId)
    .eq("project_id",conversation.project_id)
    .eq("conversation_id",conversation.id)
    .order("created_at",{ascending:false}).limit(150);
   if(messagesError)return response({error:"تعذر تحميل رسائل المحادثة."},503);
   return response({conversation,messages:(messages||[]).reverse()});
  }
  let q=session.db.from("support_conversations")
   .select("id,project_id,widget_id,mode,created_at,updated_at")
   .eq("organization_id",session.organizationId)
   .order("updated_at",{ascending:false}).limit(100);
  if(projectId)q=q.eq("project_id",projectId);
  const {data:conversations,error:conversationsError}=await q;
  if(conversationsError)return response({error:"تعذر تحميل محادثات العملاء."},503);
  // Include only approved project and site labels, never hashes or visitor tokens.
  const ids=[...new Set((conversations||[]).map(c=>c.project_id))];
  const widgetIds=[...new Set((conversations||[]).map(c=>c.widget_id).filter((v):v is string=>Boolean(v)))];
  const {data:projects,error:projectsError}=ids.length
   ?await session.db.from("support_projects").select("id,name")
      .eq("organization_id",session.organizationId).in("id",ids)
   :{data:[],error:null};
  if(projectsError)return response({error:"تعذر تحميل أسماء المشاريع."},503);
  const {data:widgets,error:widgetsError}=widgetIds.length
   ?await session.db.from("support_widgets").select("id,allowed_origin")
     .eq("organization_id",session.organizationId).in("id",widgetIds)
   :{data:[],error:null};
  if(widgetsError)return response({error:"تعذر تحميل أسماء المواقع."},503);
  const projectNames=new Map((projects||[]).map(p=>[p.id,p.name]));
  const widgetOrigins=new Map((widgets||[]).map(w=>[w.id,w.allowed_origin]));
  return response({conversations:(conversations||[]).map(c=>({
   id:c.id,projectId:c.project_id,projectName:projectNames.get(c.project_id)||"مشروع",
   origin:c.widget_id?widgetOrigins.get(c.widget_id)||"موقع غير متاح":"موقع محذوف",
   mode:c.mode,createdAt:c.created_at,updatedAt:c.updated_at
  }))});
 }catch(e){const x=errorResponse(e);return response({error:x.message},x.status);}
}
