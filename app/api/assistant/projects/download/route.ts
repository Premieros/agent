import {NextRequest,NextResponse} from "next/server";
import {requireAgentSession,errorResponse} from "@/lib/agent-server";
import {packagedProjectFiles,zipProjectFiles,type ProjectSpec} from "@/lib/agent-project-engine";
export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(req:NextRequest){
 try{
  const s=await requireAgentSession(req);
  const id=new URL(req.url).searchParams.get("id");
  if(!id||!uuid.test(id))return NextResponse.json({error:"Project ID invalid"},{status:400});
  const q=await s.db.from("assistant_project_builds")
   .select("id,task,title,steps,files,status,test_passed,execution_log")
   .eq("id",id).eq("organization_id",s.organizationId).eq("user_id",s.userId).maybeSingle();
  if(q.error)throw q.error;
  if(!q.data)return NextResponse.json({error:"Project not found"},{status:404});
  // Owners may inspect a portable draft ZIP without approving remote code
  // execution. Never label a draft or interrupted test as verified.
  const finished=["completed","failed"].includes(q.data.status);
  const spec:ProjectSpec={title:q.data.title,steps:q.data.steps,files:q.data.files};
  const result=finished?q.data.execution_log:
   "No per-project GitHub Actions tests have completed. This is a draft project.\n";
  const status=finished?(q.data.test_passed?"PASSED":"FAILED OR UNVERIFIED"):
    "NOT TESTED - DRAFT";
  const bytes=zipProjectFiles(packagedProjectFiles(spec,q.data.task,result,status));
  const responseBytes=new Uint8Array(new ArrayBuffer(bytes.byteLength));responseBytes.set(bytes);
  return new NextResponse(responseBytes,{headers:{
   "Content-Type":"application/zip",
   "Content-Disposition":'attachment; filename="AGENT-app-'+id.slice(0,8)+'.zip"',
   "Content-Length":String(bytes.byteLength),"Cache-Control":"private, no-store",
   "X-Content-Type-Options":"nosniff"
  }});
 }catch(e){const x=errorResponse(e);return NextResponse.json({error:x.message},{status:x.status});}
}