import {NextRequest,NextResponse} from "next/server";
import {adminDb,desktopError,newToken,NO_STORE,ownedDesktopSession,tokenHash} from "@/lib/desktop-control";
export const runtime="nodejs";
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:NO_STORE});
export async function GET(req:NextRequest){
  try {
    const user=await ownedDesktopSession(req);
    const {data,error}=await adminDb().from("agent_desktop_devices")
      .select("id,name,created_at,last_seen_at,revoked_at")
      .eq("organization_id",user.organizationId).eq("user_id",user.userId)
      .order("created_at",{ascending:false}).limit(30);
    if(error)throw error;
    return json({devices:data||[]});
  }catch(e){const x=desktopError(e);return json({error:x.error},x.status);}
}
export async function POST(req:NextRequest){
  try{
    const user=await ownedDesktopSession(req);
    const body=await req.json() as {action?:unknown;name?:unknown;deviceId?:unknown};
    const db=adminDb();
    if(body.action==="revoke"){
      if(typeof body.deviceId!=="string" || !/^[a-f0-9-]{36}$/i.test(body.deviceId))return json({error:"الجهاز غير صحيح."},400);
      const {data,error}=await db.from("agent_desktop_devices").update({revoked_at:new Date().toISOString()})
        .eq("id",body.deviceId).eq("organization_id",user.organizationId)
        .eq("user_id",user.userId).is("revoked_at",null).select("id").maybeSingle();
      if(error)throw error;
      return json({ok:!!data});
    }
    if(body.action!=="pair" || typeof body.name!=="string" || body.name.trim().length<1 || body.name.length>80)
      return json({error:"أدخل اسم الجهاز."},400);
    const {count,error:countError}=await db.from("agent_desktop_devices").select("id",{head:true,count:"exact"})
      .eq("organization_id",user.organizationId).eq("user_id",user.userId).is("revoked_at",null);
    if(countError)throw countError;
    if((count||0)>=5)return json({error:"الحد الأقصى خمسة أجهزة نشطة."},429);
    const token=newToken();
    const {data,error}=await db.from("agent_desktop_devices").insert({
      organization_id:user.organizationId,user_id:user.userId,name:body.name.trim(),token_hash:tokenHash(token)
    }).select("id,name").single();
    if(error||!data)throw error||new Error("PAIR_FAILED");
    // One-time response only. Never log, return again, or store raw token.
    return json({device:data,token});
  }catch(e){const x=desktopError(e);return json({error:x.error},x.status);}
}
