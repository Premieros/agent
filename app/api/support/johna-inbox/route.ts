import {NextRequest,NextResponse} from "next/server";
import {JohnaAccessError,johnaSupportAdmin,JOHNA_ORIGIN,idPattern} from "@/lib/johna-support-admin";

export const runtime="nodejs";
const headers={
 "Access-Control-Allow-Origin":JOHNA_ORIGIN,
 "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
 "Access-Control-Allow-Headers":"Authorization,Content-Type",
 "Access-Control-Max-Age":"300",
 "Cache-Control":"private, no-store",
 "Vary":"Origin"
};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
export async function OPTIONS(req:NextRequest){
 if(req.headers.get("origin")!==JOHNA_ORIGIN)return new NextResponse(null,{status:403});
 return new NextResponse(null,{status:204,headers});
}
async function handleError(e:unknown){
 if(e instanceof JohnaAccessError)return reply({error:e.message},e.status);
 return reply({error:"تعذر تحميل أو تحديث محادثات خدمة العملاء."},503);
}

/** Staff and AGENT share the SAME support_conversations and support_messages. */
export async function GET(req:NextRequest){
 try{
  const {db,widget}=await johnaSupportAdmin(req);
  const {data:conversations,error:convError}=await db.from("support_conversations")
   .select("id,mode,created_at,updated_at")
   .eq("organization_id",widget.organization_id)
   .eq("project_id",widget.project_id)
   .eq("widget_id",widget.id)
   .order("updated_at",{ascending:false}).limit(60);
  if(convError)return reply({error:"تعذر تحميل المحادثات."},503);
  if(!conversations?.length)return reply({conversations:[],messages:[]});
  const ids=conversations.map(c=>c.id);
  const {data:messages,error:messageError}=await db.from("support_messages")
   .select("id,conversation_id,role,body,created_at")
   .eq("organization_id",widget.organization_id)
   .eq("project_id",widget.project_id)
   .in("conversation_id",ids).in("role",["customer","assistant","employee"])
   .order("created_at",{ascending:false}).limit(1500);
  if(messageError)return reply({error:"تعذر تحميل الرسائل."},503);
  const owners=new Set(ids),counts=new Map<string,number>();
  const safeMessages=(messages||[]).filter(m=>{
   if(!owners.has(m.conversation_id))return false;
   const n=counts.get(m.conversation_id)||0;
   if(n>=80)return false;
   counts.set(m.conversation_id,n+1);
   return true;
  }).reverse().map(m=>({
   id:m.id,conversationId:m.conversation_id,role:m.role,body:m.body,createdAt:m.created_at
  }));
  return reply({
   conversations:conversations.map(c=>({
    id:c.id,mode:c.mode,createdAt:c.created_at,updatedAt:c.updated_at
   })),messages:safeMessages
  });
 }catch(e){return handleError(e)}
}

export async function POST(req:NextRequest){
 try{
  if(Number(req.headers.get("content-length")||0)>6000)
   return reply({error:"الطلب كبير."},413);
  const raw=await req.text();
  if(raw.length>6000)return reply({error:"الطلب كبير."},413);
  const b=JSON.parse(raw) as {conversationId?:unknown;action?:unknown;text?:unknown};
  if(typeof b.conversationId!=="string"||!idPattern.test(b.conversationId))
   return reply({error:"معرف المحادثة غير صالح."},400);
  if(!["takeover","release","reply"].includes(String(b.action)))
   return reply({error:"الإجراء غير صالح."},400);
  const action=b.action as "takeover"|"release"|"reply";
  if(action==="reply"&&(typeof b.text!=="string"||b.text.trim().length<1||b.text.length>2000))
   return reply({error:"اكتب ردًا بطول لا يتجاوز 2000 حرف."},400);
  const {db,widget}=await johnaSupportAdmin(req);
  const filters=()=>db.from("support_conversations")
   .update({mode:action==="release"?"ai":"human",updated_at:new Date().toISOString()})
   .eq("id",b.conversationId)
   .eq("organization_id",widget.organization_id)
   .eq("project_id",widget.project_id)
   .eq("widget_id",widget.id);
  if(action==="takeover"||action==="release"){
   const {data,error}=await filters().select("id,mode").maybeSingle();
   if(error||!data)return reply({error:"المحادثة غير متاحة أو تعذر تحديثها."},404);
   return reply({ok:true,mode:data.mode,conversationId:data.id});
  }
  const {data:conversation,error:conversationError}=await db.from("support_conversations")
   .select("id,mode").eq("id",b.conversationId)
   .eq("organization_id",widget.organization_id)
   .eq("project_id",widget.project_id).eq("widget_id",widget.id).maybeSingle();
  if(conversationError||!conversation)return reply({error:"المحادثة غير متاحة."},404);
  if(conversation.mode!=="human")
   return reply({error:"استلم المحادثة أولًا للرد عليها، ثم يمكنك إعادتها إلى AGENT."},409);
  const {error:saveError}=await db.from("support_messages").insert({
   organization_id:widget.organization_id,project_id:widget.project_id,
   conversation_id:conversation.id,role:"employee",body:(b.text as string).trim()
  });
  if(saveError)return reply({error:"تعذر حفظ رد موظف الدعم."},503);
  await db.from("support_conversations").update({updated_at:new Date().toISOString()})
   .eq("id",conversation.id).eq("organization_id",widget.organization_id)
   .eq("project_id",widget.project_id).eq("widget_id",widget.id);
  return reply({ok:true,mode:"human",conversationId:conversation.id});
 }catch(e){return handleError(e)}
}
