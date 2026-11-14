import "server-only";
import {createClient} from "@supabase/supabase-js";
import type {SupabaseClient} from "@supabase/supabase-js";

const PREMIER_URL="https://hvqlkapynjfjikqithvd.supabase.co";
export const PREMIER_ORIGIN="https://premieros-sage.vercel.app";
export const PREMIER_WIDGET_KEY="dc926f2840ca4334fd94c0dc811e481c73c9b6843d178729";
export const IDENTITY_PREFIX="PREMIER_IDENTITY_V1:";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PremierSupportIdentity={
 userId:string;employeeName:string;branchId:string|null;branchName:string|null;
 organizationId:string|null;organizationName:string|null;
 verified:true;
};
const name=(value:unknown)=>typeof value==="string"?
 value.replace(/[\r\n\t]/g," ").trim().slice(0,120):"";

export async function verifyPremierSupportIdentity(accessToken:string,selectedBranch?:unknown):Promise<PremierSupportIdentity|null>{
 if(!accessToken||accessToken.length>4000)return null;
 const publishableKey=process.env.PREMIER_SUPABASE_PUBLISHABLE_KEY;
 if(!publishableKey)return null;
 const premier=createClient(PREMIER_URL,publishableKey,{
  global:{headers:{Authorization:"Bearer "+accessToken}},
  auth:{persistSession:false,autoRefreshToken:false}
 });
 const {data:auth,error:authError}=await premier.auth.getUser(accessToken);
 if(authError||!auth.user)return null;
 const {data:user,error:userError}=await premier.from("users")
  .select("id,full_name,username,branch_id,is_active")
  .eq("id",auth.user.id).maybeSingle();
 if(userError||!user||user.is_active===false)return null;
 const chosen=typeof selectedBranch==="string"&&uuid.test(selectedBranch)?selectedBranch:null;
 const assigned=typeof user.branch_id==="string"&&uuid.test(user.branch_id)?user.branch_id:null;
 let branch:{id:string;name:string;organization_id:string|null}|null=null;
 // Selected context must be visible through Premier's own RLS policies.
 for(const id of [...new Set([chosen,assigned].filter((x):x is string=>Boolean(x)))]){
  const {data,error}=await premier.from("branches")
   .select("id,name,organization_id").eq("id",id).maybeSingle();
  if(!error&&data){
   if(assigned&&chosen&&id===chosen&&chosen!==assigned){
    // A fixed-branch user must never claim another branch just from a UI hint.
    continue;
   }
   branch=data;
   break;
  }
 }
 const orgId=branch?.organization_id&&uuid.test(branch.organization_id)?branch.organization_id:null;
 let orgName:string|null=null;
 if(orgId){
  const {data}=await premier.from("organizations").select("name").eq("id",orgId).maybeSingle();
  orgName=name(data?.name)||null;
 }
 return {
  userId:auth.user.id,
  employeeName:name(user.full_name)||name(user.username)||"موظف بدون اسم",
  branchId:branch?.id||null,
  branchName:name(branch?.name)||null,
  organizationId:orgId,
  organizationName:orgName,
  verified:true
 };
}

export async function attachVerifiedIdentity(
 db:SupabaseClient,scope:{id:string;organization_id:string;project_id:string},
 identity:PremierSupportIdentity
):Promise<boolean>{
 const body=IDENTITY_PREFIX+JSON.stringify(identity);
 // Only server-side verified records have this exact system marker.
 const {error}=await db.from("support_messages").insert({
  organization_id:scope.organization_id,project_id:scope.project_id,
  conversation_id:scope.id,role:"system",body
 });
 return !error;
}

export function parseVerifiedIdentity(body:unknown):PremierSupportIdentity|null{
 if(typeof body!=="string"||!body.startsWith(IDENTITY_PREFIX))return null;
 try{
  const v:unknown=JSON.parse(body.slice(IDENTITY_PREFIX.length));
  if(!v||typeof v!=="object")return null;
  const x=v as Record<string,unknown>;
  if(x.verified!==true||typeof x.userId!=="string"||!uuid.test(x.userId)
   ||typeof x.employeeName!=="string")return null;
  return {
   userId:x.userId,employeeName:name(x.employeeName)||"موظف بدون اسم",
   branchId:typeof x.branchId==="string"&&uuid.test(x.branchId)?x.branchId:null,
   branchName:name(x.branchName)||null,
   organizationId:typeof x.organizationId==="string"&&uuid.test(x.organizationId)?x.organizationId:null,
   organizationName:name(x.organizationName)||null,verified:true
  };
 }catch{return null}
}
