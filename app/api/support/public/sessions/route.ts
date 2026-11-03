import {NextRequest,NextResponse} from "next/server";
import {supportService,getWidget,originFor,cors,consume,ipFor,issueVisitorToken,sha} from "@/lib/support-public";
export const runtime="nodejs";
const response=(value:unknown,status:number,origin:string|null)=>NextResponse.json(value,{status,headers:cors(origin)});
export async function OPTIONS(req:NextRequest){
 const origin=originFor(req);return new NextResponse(null,{status:204,headers:cors(origin)});
}
export async function POST(req:NextRequest){
 const origin=originFor(req);
 if(!origin)return response({error:"HTTPS origin required"},403,null);
 if(process.env.SUPPORT_PUBLIC_CHAT_ENABLED!=="true")
  return response({error:"خدمة الشات الخارجي غير مفعلة بعد."},503,origin);
 const db=supportService();
 if(!db)return response({error:"الخادم غير مهيأ لخدمة العملاء."},503,origin);
 try{
  if(Number(req.headers.get("content-length")||0)>3000)return response({error:"Request too large"},413,origin);
  const raw=await req.text();if(raw.length>3000)return response({error:"Request too large"},413,origin);
  const body=JSON.parse(raw) as {widgetKey?:unknown};
  const widget=await getWidget(db,body.widgetKey,origin);
  if(!widget)return response({error:"الموقع غير مسموح."},403,null);
  const allowed=await consume(db,"support-session",widget.id+":"+ipFor(req),8,300);
  if(!allowed)return response({error:"تم تجاوز حد المحادثات. حاول لاحقًا."},429,origin);
  const token=issueVisitorToken();
  const {data,error}=await db.from("support_conversations").insert({
   organization_id:widget.organization_id,project_id:widget.project_id,
   widget_id:widget.id,customer_token_hash:sha(token),mode:"ai"
  }).select("id").single();
  if(error||!data)return response({error:"تعذر إنشاء المحادثة."},502,origin);
  return response({conversationId:data.id,visitorToken:token},201,origin);
 }catch{return response({error:"تعذر بدء المحادثة."},400,origin);}
}
