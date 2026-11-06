import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {createHash,randomBytes,timingSafeEqual} from "node:crypto";
import type { NextRequest } from "next/server";

export type SupportWidget = {
 id:string;organization_id:string;project_id:string;allowed_origin:string;enabled:boolean;public_key:string
};
export function supportService():SupabaseClient|null{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 return url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;
}
export function sha(value:string):string{return createHash("sha256").update(value).digest("hex");}
export function issueVisitorToken():string{return randomBytes(32).toString("base64url");}
export function tokenMatches(token:string,hash:string):boolean{
 if(!/^[a-zA-Z0-9_-]{40,60}$/.test(token)||!/^[a-f0-9]{64}$/.test(hash))return false;
 const a=Buffer.from(sha(token),"hex"),b=Buffer.from(hash,"hex");
 return timingSafeEqual(a,b);
}
export function originFor(req:NextRequest):string|null{
 const raw=req.headers.get("origin");
 if(!raw)return null;
 try{
  const o=new URL(raw);
  if(o.protocol!=="https:"||o.origin!==raw)return null;
  return o.origin;
 }catch{return null;}
}
export function cors(origin:string|null){
 return {"Cache-Control":"no-store","Vary":"Origin",...(origin?{"Access-Control-Allow-Origin":origin}:{}),
  "Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization"};
}
export async function getWidget(db:SupabaseClient,key:unknown,origin:string|null):Promise<SupportWidget|null>{
 if(typeof key!=="string"||!/^[0-9a-f]{48}$/.test(key)||!origin)return null;
 const {data,error}=await db.from("support_widgets").select("id,organization_id,project_id,allowed_origin,enabled,public_key")
  .eq("public_key",key).eq("allowed_origin",origin).eq("enabled",true).maybeSingle();
 if(error)throw error;
 return data||null;
}
export async function consume(db:SupabaseClient,namespace:string,identity:string,max:number,seconds=60):Promise<boolean>{
 const key=sha(namespace+":"+identity);
 const window=new Date(Math.floor(Date.now()/(seconds*1000))*seconds*1000).toISOString();
 const {data,error}=await db.rpc("support_consume_limit",{p_key_hash:key,p_window_start:window,p_max:max});
 if(error)throw error;
 return data===true;
}
export function ipFor(req:NextRequest):string{
 // Vercel sets this header at the trusted edge. If absent, fail closed
 // to a shared bucket rather than trusting a user-supplied X-Forwarded-For.
 return req.headers.get("x-vercel-forwarded-for")?.slice(0,100)||"unidentified";
}
