import {NextRequest,NextResponse} from "next/server";
import {connectedDevice,desktopError,NO_STORE} from "@/lib/desktop-control";
export const runtime="nodejs";
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:NO_STORE});
export async function POST(req:NextRequest){
  try{
    const {db,device}=await connectedDevice(req);
    const body=await req.json().catch(()=>({})) as {action?:unknown;jobId?:unknown;status?:unknown;result?:unknown};
    await db.from("agent_desktop_devices").update({last_seen_at:new Date().toISOString()}).eq("id",device.id);
    if(body.action==="complete"){
      if(typeof body.jobId!=="string" || !/^[a-f0-9-]{36}$/i.test(body.jobId) ||
        !["completed","rejected","failed"].includes(String(body.status)))
        return json({error:"نتيجة غير صالحة."},400);
      const {data,error}=await db.from("agent_desktop_jobs").update({
        status:body.status,result:typeof body.result==="string"?body.result.slice(0,500):null,
        completed_at:new Date().toISOString()
      }).eq("id",body.jobId).eq("device_id",device.id).eq("organization_id",device.organization_id)
        .eq("status","running").select("id").maybeSingle();
      if(error)throw error;
      return json({ok:!!data});
    }
    if(body.action!=="poll")return json({error:"طلب غير صالح."},400);
    const {data:pending,error:pendingError}=await db.from("agent_desktop_jobs")
      .select("id").eq("device_id",device.id).eq("organization_id",device.organization_id)
      .eq("status","queued").order("created_at",{ascending:true}).limit(1).maybeSingle();
    if(pendingError)throw pendingError;
    if(!pending)return json({job:null});
    // Atomic conditional status update prevents duplicate delivery to concurrent pollers.
    const {data:job,error}=await db.from("agent_desktop_jobs").update({
      status:"running",started_at:new Date().toISOString()
    }).eq("id",pending.id).eq("device_id",device.id).eq("status","queued")
      .select("id,action,arguments").maybeSingle();
    if(error)throw error;
    return json({job:job||null});
  }catch(e){const x=desktopError(e);return json({error:x.error},x.status);}
}
