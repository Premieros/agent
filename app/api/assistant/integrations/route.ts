import { NextRequest, NextResponse } from "next/server";
import { requireAgentSession, errorResponse } from "@/lib/agent-server";
import { listConnectorDescriptors } from "@/lib/assistant-integrations";
import { configuredProviders } from "@/lib/ai-providers";

export const runtime="nodejs";
export async function GET(req:NextRequest){
  try{
    await requireAgentSession(req);
    return NextResponse.json({
      connectors:listConnectorDescriptors(),
      aiProviders:configuredProviders(),
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
