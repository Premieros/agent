import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { requireAgentSession } from "@/lib/agent-server";

export const NO_STORE = {"Cache-Control":"no-store"};
const DEVICE_TOKEN = /^[a-f0-9]{64}$/;
export const tokenHash = (token:string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export const adminDb = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("DESKTOP_SERVER_NOT_CONFIGURED");
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
};
export async function ownedDesktopSession(req:NextRequest) {
  const session=await requireAgentSession(req);
  if (session.role!=="admin") throw new Error("PERMISSION_DENIED");
  return session;
}
export async function connectedDevice(req:NextRequest) {
  const token=req.headers.get("x-desktop-token")||"";
  if (!DEVICE_TOKEN.test(token)) throw new Error("DEVICE_UNAUTHORIZED");
  const db=adminDb();
  const {data,error}=await db.from("agent_desktop_devices")
    .select("id,organization_id,user_id,name,revoked_at")
    .eq("token_hash",tokenHash(token)).is("revoked_at",null).maybeSingle();
  if (error || !data) throw new Error("DEVICE_UNAUTHORIZED");
  return {db,device:data};
}
export function validateAction(action:unknown,args:unknown) {
  if(typeof action!=="string" || !args || typeof args!=="object" || Array.isArray(args)) return null;
  const fields=args as Record<string,unknown>;
  if(action==="open_url" && typeof fields.url==="string" && fields.url.length<=1500){
    try {
      const url=new URL(fields.url);
      if(url.protocol!=="https:" || url.username || url.password) return null;
      return {action,arguments:{url:url.toString()}};
    }catch{return null;}
  }
  if(action==="click" && Number.isInteger(fields.x) && Number.isInteger(fields.y) &&
    (fields.x as number)>=0 && (fields.y as number)>=0 && (fields.x as number)<=16000 && (fields.y as number)<=16000)
    return {action,arguments:{x:fields.x,y:fields.y}};
  if(action==="type_text" && typeof fields.text==="string" && fields.text.length>0 && fields.text.length<=1200)
    return {action,arguments:{text:fields.text}};
  const allowedKeys=new Set(["enter","tab","esc","ctrl","alt","shift","win","c","v","a","t","w","l","f","s","left","right","up","down","backspace"]);
  if(action==="hotkey" && Array.isArray(fields.keys) && fields.keys.length>=1 && fields.keys.length<=4 &&
    fields.keys.every(key=>typeof key==="string" && allowedKeys.has(key)))
    return {action,arguments:{keys:fields.keys}};
  return null;
}
export function desktopError(err:unknown){
  const message=err instanceof Error?err.message:"";
  const status=message==="DEVICE_UNAUTHORIZED"?401:message==="PERMISSION_DENIED"?403:
    message==="SESSION_REQUIRED"?401:message==="DESKTOP_SERVER_NOT_CONFIGURED"?503:500;
  return {status,error: status===503?"تحتاج الخدمة إلى إعداد SUPABASE_SERVICE_ROLE_KEY على الخادم.":
    status===401?"جلسة الاتصال غير صالحة.":status===403?"هذه العملية متاحة لمسؤول المؤسسة فقط.":"تعذر تنفيذ الطلب."};
}
