import {NextRequest,NextResponse} from "next/server";
import {requireAgentSession,errorResponse} from "@/lib/agent-server";

export const runtime="nodejs";
const noStore={"Cache-Control":"no-store"};
const respond=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:noStore});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds=new Set(["restaurant","cafe","clothing_store","clothing_factory","other"]);
const followupTypes=new Set(["chat","call","site_visit"]);
const clean=(value:unknown,max:number)=>typeof value==="string"?
  value.trim().replace(/[\u0000-\u001f\u007f]/g," ").slice(0,max):"";

/** All reads and writes are restricted to the authenticated AGENT organization. */
export async function GET(req:NextRequest){
  try{
    const {db,organizationId,userId}=await requireAgentSession(req);
    const [member,leadCount,chatCount,pendingCount,leads,tasks,chats]=await Promise.all([
      db.from("organization_members").select("role").eq("organization_id",organizationId)
        .eq("user_id",userId).maybeSingle(),
      db.from("leads").select("id",{head:true,count:"exact"}).eq("organization_id",organizationId),
      db.from("conversations").select("id",{head:true,count:"exact"}).eq("organization_id",organizationId),
      db.from("handoff_tasks").select("id",{head:true,count:"exact"})
        .eq("organization_id",organizationId).eq("status","pending"),
      db.from("leads").select("id,full_name,business_name,business_type,stage,priority,created_at")
        .eq("organization_id",organizationId).order("created_at",{ascending:false}).limit(12),
      db.from("handoff_tasks").select("id,lead_id,handoff_type,status,summary,created_at")
        .eq("organization_id",organizationId).in("status",["pending","in_progress"])
        .order("created_at",{ascending:false}).limit(12),
      db.from("conversations").select("id,lead_id,channel,mode,last_message_at,created_at")
        .eq("organization_id",organizationId).order("created_at",{ascending:false}).limit(8)
    ]);
    const results=[member,leadCount,chatCount,pendingCount,leads,tasks,chats];
    const failure=results.find(result=>result.error)?.error;
    if(failure)throw failure;
    return respond({
      counts:{leads:leadCount.count??0,conversations:chatCount.count??0,
        pending:pendingCount.count??0},
      role:member.data?.role||"unknown",
      canWrite:["admin","manager","sales"].includes(member.data?.role||""),
      leads:leads.data||[],tasks:tasks.data||[],conversations:chats.data||[],
      readAt:new Date().toISOString()
    });
  }catch(e){const v=errorResponse(e);return respond({error:v.message},v.status);}
}

/** Changes require explicit confirmation in the chat UI and server-side role checks. */
export async function POST(req:NextRequest){
  try{
    const {db,organizationId,userId}=await requireAgentSession(req);
    const body=await req.json() as {
      action?:unknown;fullName?:unknown;businessName?:unknown;
      businessType?:unknown;phone?:unknown;leadId?:unknown;
      handoffType?:unknown;
    };
    const member=await db.from("organization_members").select("role")
      .eq("organization_id",organizationId).eq("user_id",userId).maybeSingle();
    if(member.error)throw member.error;
    if(!["admin","manager","sales"].includes(member.data?.role||""))
      return respond({error:"حسابك لا يملك صلاحية تعديل بيانات العملاء."},403);
    if(body.action==="create_lead"){
      const fullName=clean(body.fullName,100);
      const businessName=clean(body.businessName,110);
      const phone=clean(body.phone,32);
      const businessType=String(body.businessType||"other");
      if(fullName.length<2||!kinds.has(businessType)||
        (typeof body.fullName==="string"&&body.fullName.trim().length>100)||
        (typeof body.phone==="string"&&body.phone.trim().length>32))
        return respond({error:"أدخل اسم العميل والنشاط ورقم الهاتف بصيغة صحيحة."},400);
      if(phone){
        const existing=await db.from("leads").select("id").eq("organization_id",organizationId)
          .eq("phone",phone).limit(1).maybeSingle();
        if(existing.error)throw existing.error;
        if(existing.data)return respond({error:"يوجد عميل مسجل بالفعل بنفس رقم الهاتف. راجع قائمة العملاء."},409);
      }
      const {data,error}=await db.from("leads").insert({
        organization_id:organizationId,full_name:fullName,
        business_name:businessName||null,phone:phone||null,
        business_type:businessType,source:"manual",stage:"new",priority:"warm"
      }).select("id,full_name").single();
      if(error)throw error;
      return respond({ok:true,lead:data},201);
    }
    if(body.action==="create_handoff"){
      if(typeof body.leadId!=="string"||!uuid.test(body.leadId)||
        !followupTypes.has(String(body.handoffType)))
        return respond({error:"اختر عميلًا ونوع متابعة صالحين."},400);
      const type=String(body.handoffType);
      const lead=await db.from("leads").select("id,full_name").eq("id",body.leadId)
        .eq("organization_id",organizationId).maybeSingle();
      if(lead.error)throw lead.error;
      if(!lead.data)return respond({error:"هذا العميل غير موجود في مؤسستك."},404);
      const duplicate=await db.from("handoff_tasks").select("id")
        .eq("organization_id",organizationId).eq("lead_id",body.leadId)
        .eq("handoff_type",type).in("status",["pending","in_progress"])
        .limit(1).maybeSingle();
      if(duplicate.error)throw duplicate.error;
      if(duplicate.data)return respond({error:"هناك متابعة مفتوحة من نفس النوع لهذا العميل بالفعل."},409);
      const descriptions:Record<string,string>={
        call:"الاتصال بالعميل لتحديد احتياجاته.",
        chat:"متابعة العميل كتابةً بواسطة فريق المبيعات.",
        site_visit:"تنسيق معاينة مع العميل."
      };
      const {data,error}=await db.from("handoff_tasks").insert({
        organization_id:organizationId,lead_id:lead.data.id,handoff_type:type,
        summary:descriptions[type]
      }).select("id,status").single();
      if(error)throw error;
      return respond({ok:true,task:data},201);
    }
    return respond({error:"إجراء غير متاح."},400);
  }catch(e){const v=errorResponse(e);return respond({error:v.message},v.status);}
}
