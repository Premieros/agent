import { NextRequest, NextResponse } from "next/server";
import { requireAgentSession, errorResponse } from "@/lib/agent-server";
import { listConnectorDescriptors } from "@/lib/assistant-integrations";
import { configuredProviders } from "@/lib/ai-providers";

export const runtime="nodejs";

export async function GET(req:NextRequest){
  try{
    const {db,organizationId,userId}=await requireAgentSession(req);
    const {data:preferences,error}=await db.from("assistant_connector_settings")
      .select("connector_id,enabled").eq("organization_id",organizationId)
      .eq("user_id",userId);
    if(error)throw error;
    const flags=new Map<string,boolean>((preferences||[]).map(p=>[p.connector_id,p.enabled]));
    const connectors=listConnectorDescriptors().map(item=>({
      ...item,
      // Only implemented read-only tools can be enabled/disabled.
      toggleable:item.id==="github"||item.id==="browser",
      enabled:(item.id==="github"||item.id==="browser")
        ? (flags.get(item.id)??true)
        : ["internal","read-only"].includes(item.status)
    }));
    return NextResponse.json({
      connectors,aiProviders:configuredProviders(),
      policy:{
        credentialStorage:"Vercel server-side environment variables",
        writeActionsEnabled:false,
        externalPublishingEnabled:false,
        browserInteractive:false
      }
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    const result=errorResponse(error);
    return NextResponse.json({error:result.message},{status:result.status,headers:{"Cache-Control":"no-store"}});
  }
}

export async function POST(req:NextRequest){
  try{
    const {db,organizationId,userId}=await requireAgentSession(req);
    const body=await req.json() as {connectorId?:unknown;enabled?:unknown};
    if((body.connectorId!=="github"&&body.connectorId!=="browser")||typeof body.enabled!=="boolean")
      return NextResponse.json({error:"يمكن تغيير حالة إضافة GitHub والمتصفح فقط."},{status:400});
    const {error}=await db.from("assistant_connector_settings").upsert({
      organization_id:organizationId,user_id:userId,
      connector_id:body.connectorId,enabled:body.enabled,
      updated_at:new Date().toISOString()
    },{onConflict:"organization_id,user_id,connector_id"});
    if(error)throw error;
    return NextResponse.json({ok:true,connectorId:body.connectorId,enabled:body.enabled},
      {headers:{"Cache-Control":"no-store"}});
  }catch(error){
    const result=errorResponse(error);
    return NextResponse.json({error:result.message},{status:result.status,headers:{"Cache-Control":"no-store"}});
  }
}
