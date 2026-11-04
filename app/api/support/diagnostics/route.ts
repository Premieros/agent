import {NextRequest,NextResponse} from "next/server";
import {requireAgentSession,errorResponse} from "@/lib/agent-server";
import {supportService,sha} from "@/lib/support-public";

export const runtime="nodejs";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only authenticated admins can see a project's readiness. No secret values leave the server. */
export async function GET(req:NextRequest){
 try{
  const session=await requireAgentSession(req);
  const projectId=new URL(req.url).searchParams.get("projectId");
  if(!projectId||!uuid.test(projectId))return reply({error:"المشروع غير صالح."},400);
  const {data:project,error:projectError}=await session.db.from("support_projects")
   .select("id").eq("id",projectId).eq("organization_id",session.organizationId).maybeSingle();
  if(projectError||!project)return reply({error:"المشروع غير موجود أو لا تملك صلاحية الوصول إليه."},404);
  const serverConfigured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
  const aiConfigured=Boolean(process.env.GEMINI_API_KEY||process.env.OPENAI_API_KEY);
  const publicEnabled=process.env.SUPPORT_PUBLIC_CHAT_ENABLED==="true";
  let limiterReady=false;
  let widgets:Array<{allowed_origin:string;enabled:boolean}>=[];
  if(serverConfigured){
   const service=supportService();
   if(service){
    const {data:sites,error:sitesError}=await service.from("support_widgets")
     .select("allowed_origin,enabled").eq("project_id",projectId)
     .eq("organization_id",session.organizationId).limit(50);
    if(!sitesError)widgets=sites||[];
    // A single dedicated test bucket confirms that the rate-limit function is callable.
    const {data,error}=await service.rpc("support_consume_limit",{
     p_key_hash:sha("support-health:"+session.organizationId+":"+projectId),
     p_window_start:new Date(Math.floor(Date.now()/3600000)*3600000).toISOString(),
     p_max:100
    });
    limiterReady=!error&&data===true;
   }
  }
  return reply({
   serverConfigured,aiConfigured,publicEnabled,limiterReady,
   widgets,
   ready:serverConfigured&&aiConfigured&&publicEnabled&&limiterReady&&widgets.some(w=>w.enabled)
  });
 }catch(e){const x=errorResponse(e);return reply({error:x.message},x.status)}
}
