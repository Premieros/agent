import {NextRequest,NextResponse} from "next/server";
import {requireAgentSession,errorResponse} from "@/lib/agent-server";

export const runtime="nodejs";
const respond=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});

/** Authenticated AGENT admin export. Never accepts visitor tokens or widget keys. */
export async function GET(req:NextRequest){
 try{
  const session=await requireAgentSession(req);
  const {data:conversations,error:conversationError}=await session.db
   .from("support_conversations")
   .select("id,project_id,widget_id,mode,created_at,updated_at")
   .eq("organization_id",session.organizationId)
   .order("updated_at",{ascending:false}).limit(40);
  if(conversationError)return respond({error:"تعذر تحميل محادثات خدمة العملاء."},503);
  if(!conversations?.length)return respond({conversations:[],messages:[]});
  const projectIds=[...new Set(conversations.map(c=>c.project_id))];
  const widgetIds=[...new Set(conversations.map(c=>c.widget_id).filter((x):x is string=>typeof x==="string"))];
  const ids=conversations.map(c=>c.id);
  const [projectsResult,widgetsResult,messagesResult]=await Promise.all([
   session.db.from("support_projects").select("id,name")
    .eq("organization_id",session.organizationId).in("id",projectIds),
   widgetIds.length?session.db.from("support_widgets").select("id,allowed_origin")
    .eq("organization_id",session.organizationId).in("id",widgetIds)
    :Promise.resolve({data:[],error:null}),
   session.db.from("support_messages")
    .select("id,conversation_id,project_id,role,body,created_at")
    .eq("organization_id",session.organizationId).in("conversation_id",ids)
    .order("created_at",{ascending:false}).limit(1200)
  ]);
  if(projectsResult.error||widgetsResult.error||messagesResult.error)
   return respond({error:"تعذر تحميل تفاصيل المحادثات."},503);
  const projects=new Map((projectsResult.data||[]).map(p=>[p.id,p.name]));
  const widgets=new Map((widgetsResult.data||[]).map(w=>[w.id,w.allowed_origin]));
  // Enforce both organization and project scope for exported message rows.
  const owners=new Map(conversations.map(c=>[c.id,c.project_id]));
  const counts=new Map<string,number>();
  const messages=(messagesResult.data||[]).filter(m=>{
   if(owners.get(m.conversation_id)!==m.project_id)return false;
   const count=counts.get(m.conversation_id)||0;
   if(count>=60)return false;
   counts.set(m.conversation_id,count+1);
   return true;
  }).reverse().map(m=>({
   id:m.id,conversationId:m.conversation_id,role:m.role,body:m.body,createdAt:m.created_at
  }));
  return respond({
   conversations:conversations.map(c=>({
    id:c.id,projectId:c.project_id,projectName:projects.get(c.project_id)||"مشروع",
    origin:c.widget_id?widgets.get(c.widget_id)||"موقع غير متاح":"موقع غير محدد",
    mode:c.mode,createdAt:c.created_at,updatedAt:c.updated_at
   })),
   messages
  });
 }catch(e){const result=errorResponse(e);return respond({error:result.message},result.status)}
}
