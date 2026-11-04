import {NextRequest,NextResponse} from "next/server";
import {supportService,getWidget,originFor,cors,consume,ipFor,tokenMatches} from "@/lib/support-public";

export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const result=(data:unknown,status:number,origin:string|null)=>
 NextResponse.json(data,{status,headers:cors(origin)});

export async function OPTIONS(req:NextRequest){
 return new NextResponse(null,{status:204,headers:cors(originFor(req))});
}
/** History is readable only with the exact visitor token for this origin/widget.
 * Neither a Premier login nor an AGENT admin login is required.
 */
export async function POST(req:NextRequest){
 const origin=originFor(req);
 if(!origin)return result({error:"الموقع غير مسموح."},403,null);
 if(process.env.SUPPORT_PUBLIC_CHAT_ENABLED!=="true")
  return result({error:"خدمة المحادثات غير متاحة."},503,origin);
 const db=supportService();
 if(!db)return result({error:"الخادم غير متاح."},503,origin);
 try{
  if(Number(req.headers.get("content-length")||0)>2000)
   return result({error:"طلب غير صالح."},413,origin);
  const raw=await req.text();
  if(raw.length>2000)return result({error:"طلب غير صالح."},413,origin);
  const body=JSON.parse(raw) as {widgetKey?:unknown;conversationId?:unknown;visitorToken?:unknown};
  const widget=await getWidget(db,body.widgetKey,origin);
  if(!widget)return result({error:"الموقع غير مصرح."},403,null);
  if(typeof body.conversationId!=="string"||!uuid.test(body.conversationId)||
   typeof body.visitorToken!=="string")
   return result({error:"معرف المحادثة غير صالح."},400,origin);
  // Rate limit before the database read to mitigate brute-force.
  const allowed=await consume(db,"support-history",widget.id+":"+ipFor(req),45,60);
  if(!allowed)return result({error:"طلبات كثيرة. حاول لاحقًا."},429,origin);
  const {data:conversation,error:convError}=await db.from("support_conversations")
   .select("id,customer_token_hash").eq("id",body.conversationId)
   .eq("organization_id",widget.organization_id)
   .eq("project_id",widget.project_id)
   .eq("widget_id",widget.id).maybeSingle();
  if(convError||!conversation||!tokenMatches(body.visitorToken,conversation.customer_token_hash))
   return result({error:"انتهت المحادثة المحفوظة أو لم تعد متاحة.",code:"SESSION_EXPIRED"},401,origin);
  const {data,error}=await db.from("support_messages")
   .select("id,role,body,created_at").eq("organization_id",widget.organization_id)
   .eq("project_id",widget.project_id).eq("conversation_id",conversation.id)
   .order("created_at",{ascending:false}).limit(100);
  if(error)return result({error:"تعذر استرجاع الرسائل."},503,origin);
  return result({conversationId:conversation.id,messages:(data||[]).reverse()
   .filter(m=>m.role==="customer"||m.role==="assistant"||m.role==="employee")
   .map(m=>({id:m.id,sender:m.role==="customer"?"visitor":"assistant",text:m.body}))},200,origin);
 }catch{return result({error:"تعذر استرجاع المحادثة."},400,origin);}
}
