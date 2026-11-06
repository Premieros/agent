import {NextRequest,NextResponse} from "next/server";
import {adminDb,desktopError,NO_STORE,ownedDesktopSession,validateAction} from "@/lib/desktop-control";
export const runtime="nodejs";
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:NO_STORE});
export async function GET(req:NextRequest) {
  try {
    const user=await ownedDesktopSession(req);
    const deviceId=new URL(req.url).searchParams.get("deviceId")||"";
    if(!/^[a-f0-9-]{36}$/i.test(deviceId))return json({error:"الجهاز غير صحيح."},400);
    const db=adminDb();
    const {data:device}=await db.from("agent_desktop_devices").select("id")
      .eq("id",deviceId).eq("organization_id",user.organizationId)
      .eq("user_id",user.userId).is("revoked_at",null).maybeSingle();
    if(!device)return json({error:"الجهاز غير متاح."},404);
    const {data,error}=await db.from("agent_desktop_jobs")
      .select("id,action,arguments,status,result,created_at,completed_at")
      .eq("device_id",deviceId).eq("organization_id",user.organizationId)
      .eq("user_id",user.userId).order("created_at",{ascending:false}).limit(20);
    if(error)throw error;
    return json({jobs:data||[]});
  }catch(e){const x=desktopError(e);return json({error:x.error},x.status);}
}
export async function POST(req:NextRequest) {
  try{
    const user=await ownedDesktopSession(req);
    const body=await req.json() as {deviceId?:unknown;action?:unknown;arguments?:unknown};
    if(typeof body.deviceId!=="string" || !/^[a-f0-9-]{36}$/i.test(body.deviceId))
      return json({error:"الجهاز غير صحيح."},400);
    const valid=validateAction(body.action,body.arguments);
    if(!valid)return json({error:"الأمر غير مسموح أو يحتوي قيمًا غير صالحة."},400);
    const db=adminDb();
    const {data:device,error:deviceError}=await db.from("agent_desktop_devices").select("id")
      .eq("id",body.deviceId).eq("organization_id",user.organizationId)
      .eq("user_id",user.userId).is("revoked_at",null).maybeSingle();
    if(deviceError)throw deviceError;
    if(!device)return json({error:"الجهاز غير متاح."},404);
    const {count,error:countError}=await db.from("agent_desktop_jobs").select("id",{count:"exact",head:true})
      .eq("device_id",device.id).eq("status","queued");
    if(countError)throw countError;
    if((count||0)>=10)return json({error:"هناك أوامر كثيرة بانتظار التنفيذ."},429);
    const {data,error}=await db.from("agent_desktop_jobs").insert({
      device_id:device.id,organization_id:user.organizationId,user_id:user.userId,
      action:valid.action,arguments:valid.arguments,status:"queued"
    }).select("id,status").single();
    if(error)throw error;
    return json({job:data},201);
  }catch(e){const x=desktopError(e);return json({error:x.error},x.status);}
}
