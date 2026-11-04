import "server-only";
import {createClient} from "@supabase/supabase-js";
import type {NextRequest} from "next/server";
import {getWidget,supportService,consume,ipFor} from "@/lib/support-public";

export const JOHNA_ORIGIN="https://premieros.github.io";
export const JOHNA_WIDGET_KEY="8e299da0ef520017d2c74c4e688109dd0dda3b48cee20f2d";
const JOHNA_SUPABASE_URL="https://azzdesuowpdcoflmyezn.supabase.co";
export const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class JohnaAccessError extends Error{
 constructor(public status:number, message:string){super(message);}
}
export async function johnaSupportAdmin(req:NextRequest){
 if(req.headers.get("origin")!==JOHNA_ORIGIN)
  throw new JohnaAccessError(403,"مصدر الطلب غير مسموح.");
 const authorization=req.headers.get("authorization")||"";
 const token=authorization.startsWith("Bearer ")?authorization.slice(7).trim():"";
 if(!token||token.length>4000)throw new JohnaAccessError(401,"يجب تسجيل الدخول إلى Johna-S.");
 const key=process.env.JOHNAS_SUPABASE_PUBLISHABLE_KEY;
 if(!key)throw new JohnaAccessError(503,"إعداد مصادقة Johna-S غير مكتمل.");
 const auth=createClient(JOHNA_SUPABASE_URL,key,{
  global:{headers:{Authorization:"Bearer "+token}},
  auth:{persistSession:false,autoRefreshToken:false}
 });
 const {data,error}=await auth.auth.getUser(token);
 if(error||!data.user)throw new JohnaAccessError(401,"انتهت جلسة Johna-S؛ أعد تسجيل الدخول إليها.");
 const {data:profile,error:profileError}=await auth.from("users")
  .select("id,role,is_active,full_name,username")
  .eq("id",data.user.id).maybeSingle();
 if(profileError||!profile||profile.is_active===false||profile.role!=="super_admin")
  throw new JohnaAccessError(403,"إدارة المحادثات متاحة للمدير العام في Johna-S فقط.");
 const db=supportService();
 if(!db)throw new JohnaAccessError(503,"خادم خدمة العملاء غير متاح.");
 const widget=await getWidget(db,JOHNA_WIDGET_KEY,JOHNA_ORIGIN);
 if(!widget)throw new JohnaAccessError(503,"مفتاح مشروع Johna-S غير مفعل في AGENT.");
 const allowed=await consume(db,"johna-inbox-admin",data.user.id+":"+ipFor(req),60,60);
 if(!allowed)throw new JohnaAccessError(429,"طلبات كثيرة؛ حاول مرة أخرى.");
 return {db,widget,adminName:(profile.full_name||profile.username||"موظف الدعم").slice(0,100)};
}
