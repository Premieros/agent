import {NextRequest,NextResponse} from "next/server";
import {requireAgentSession,errorResponse} from "@/lib/agent-server";
import {AGENT_ACTIONS_REPO,AGENT_ACTIONS_WORKFLOW,githubActionsConfigured}
  from "@/lib/agent-github-actions";
export const runtime="nodejs";
export async function GET(req:NextRequest){
  try{
    await requireAgentSession(req);
    return NextResponse.json({
      configured:githubActionsConfigured(),
      repository:AGENT_ACTIONS_REPO,
      workflow:AGENT_ACTIONS_WORKFLOW,
      mode:"explicit-approval-only",
      privacy:"GitHub Actions logs in a public repository can be public; submit synthetic code without secrets.",
      requiredServerVariables:[
        "AGENT_GITHUB_APP_ID","AGENT_GITHUB_APP_INSTALLATION_ID",
        "AGENT_GITHUB_APP_PRIVATE_KEY"
      ]
    },{headers:{"Cache-Control":"no-store"}});
  }catch(e){const v=errorResponse(e);
    return NextResponse.json({error:v.message},{status:v.status});}
}
