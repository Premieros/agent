import {NextRequest,NextResponse} from "next/server";
import {errorResponse,requireAgentSession} from "@/lib/agent-server";

export async function GET(req:NextRequest){
  try{
    const {db,organizationId,userId}=await requireAgentSession(req);
    const {data,error}=await db.from("assistant_tool_events")
      .select("id,tool_id,status,detail,created_at")
      .eq("organization_id",organizationId).eq("user_id",userId)
      .order("created_at",{ascending:false}).limit(20);
    if(error)throw error;
    return NextResponse.json({events:data||[]},{headers:{"Cache-Control":"no-store"}});
  }catch(err){
    const result=errorResponse(err);
    return NextResponse.json({error:result.message},
      {status:result.status,headers:{"Cache-Control":"no-store"}});
  }
}
