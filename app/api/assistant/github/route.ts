import {NextRequest,NextResponse} from "next/server";
import {errorResponse,requireAgentSession} from "@/lib/agent-server";
import {verifyPublicRepository} from "@/lib/github-reader";
export const runtime="nodejs";

export async function GET(req:NextRequest){
  try{
    const {db,organizationId,userId}=await requireAgentSession(req);
    const {data,error}=await db.from("assistant_github_projects")
      .select("repository,branch,updated_at").eq("organization_id",organizationId)
      .eq("user_id",userId).maybeSingle();
    if(error)throw error;
    return NextResponse.json({
      repository:data?.repository||"Premieros/.com",
      branch:data?.branch||"main",
      defaultProject:!data,mode:"public-read-only",
      verified:false,
      note:"المستودع المختار للقراءة العامة فقط. زر اختبار الاتصال يتحقق من GitHub."
    },{headers:{"Cache-Control":"no-store"}});
  }catch(err){
    const r=errorResponse(err);
    return NextResponse.json({error:r.message},{status:r.status,headers:{"Cache-Control":"no-store"}});
  }
}

export async function POST(req:NextRequest){
  try{
    const {db,organizationId,userId}=await requireAgentSession(req);
    const body=await req.json() as {repository?:unknown;action?:unknown};
    if(body.action!=="connect"&&body.action!=="test")
      return NextResponse.json({error:"طلب غير معروف."},{status:400});
    let project;
    try{project=await verifyPublicRepository(body.repository);}
    catch(err){
      return NextResponse.json({error:err instanceof Error?err.message:"تعذر اختبار الاتصال."},
        {status:422,headers:{"Cache-Control":"no-store"}});
    }
    if(body.action==="connect"){
      const {error}=await db.from("assistant_github_projects").upsert({
        organization_id:organizationId,user_id:userId,
        repository:project.repository,branch:project.branch,updated_at:new Date().toISOString()
      },{onConflict:"organization_id,user_id"});
      if(error)throw error;
    }
    // Persist only public repository name and outcome, never keys or payloads.
    const {error:auditError}=await db.from("assistant_tool_events").insert({
      organization_id:organizationId,user_id:userId,tool_id:"github",
      status:"success",detail:(body.action==="connect"?"Connected ":"Tested ")+project.repository
    });
    if(auditError)console.warn("GitHub tool audit insertion failed");
    return NextResponse.json({ok:true,project,saved:body.action==="connect"},
      {headers:{"Cache-Control":"no-store"}});
  }catch(err){
    const r=errorResponse(err);
    return NextResponse.json({error:r.message},{status:r.status,headers:{"Cache-Control":"no-store"}});
  }
}
