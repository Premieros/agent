import "server-only";
import {createSign} from "node:crypto";

/** Fixed AGENT test repository. A selected public repo never grants write access. */
export const AGENT_ACTIONS_REPO="Premieros/agent";
export const AGENT_ACTIONS_WORKFLOW="agent-experiment.yml";
const GITHUB_API="https://api.github.com";
type GitHubRun={id:number;display_title?:string;html_url?:string;status?:string;conclusion?:string};
type GitHubJob={id:number;name?:string;status?:string;conclusion?:string};

export function githubActionsConfigured(){
  return Boolean(process.env.AGENT_GITHUB_APP_ID?.trim()&&
    process.env.AGENT_GITHUB_APP_INSTALLATION_ID?.trim()&&
    process.env.AGENT_GITHUB_APP_PRIVATE_KEY?.trim());
}
async function installationToken(){
  if(!githubActionsConfigured())throw new Error("GITHUB_ACTIONS_NOT_CONFIGURED");
  const appId=process.env.AGENT_GITHUB_APP_ID!;
  const installationId=process.env.AGENT_GITHUB_APP_INSTALLATION_ID!;
  if(!/^[0-9]+$/.test(appId)||!/^[0-9]+$/.test(installationId))
    throw new Error("GITHUB_ACTIONS_NOT_CONFIGURED");
  const now=Math.floor(Date.now()/1000);
  const encode=(data:unknown)=>Buffer.from(JSON.stringify(data)).toString("base64url");
  const unsigned=encode({alg:"RS256",typ:"JWT"})+"."+
    encode({iat:now-60,exp:now+480,iss:appId});
  const privateKey=process.env.AGENT_GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g,"\n");
  const signer=createSign("RSA-SHA256");signer.update(unsigned);signer.end();
  const jwt=unsigned+"."+signer.sign(privateKey,"base64url");
  const result=await fetch(GITHUB_API+"/app/installations/"+installationId+"/access_tokens",{
    method:"POST",cache:"no-store",
    headers:{Authorization:"Bearer "+jwt,Accept:"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28"},
    body:JSON.stringify({repositories:["agent"],permissions:{actions:"write"}})
  });
  if(!result.ok){
    console.warn("AGENT GitHub App token request failed",result.status);
    throw new Error("GITHUB_ACTIONS_AUTH_FAILED");
  }
  const payload=await result.json() as {token?:string};
  if(!payload.token)throw new Error("GITHUB_ACTIONS_AUTH_FAILED");
  return payload.token;
}
async function githubApi(endpoint:string,token:string,method="GET",body?:unknown){
  const response=await fetch(GITHUB_API+endpoint,{
    method,cache:"no-store",
    headers:{Authorization:"Bearer "+token,Accept:"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      ...(body?{"Content-Type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  if(!response.ok){
    console.warn("AGENT GitHub Actions API error",response.status);
    throw new Error("GITHUB_ACTIONS_API_FAILED");
  }
  return response;
}
export async function dispatchAgentExperiment(input:{requestId:string;code:string}){
  if(!/^[0-9a-f-]{36}$/i.test(input.requestId)||input.code.length<1||
    input.code.length>6000)throw new Error("GITHUB_ACTIONS_INVALID_INPUT");
  const token=await installationToken();
  const endpoint="/repos/"+AGENT_ACTIONS_REPO+"/actions/workflows/"+
    AGENT_ACTIONS_WORKFLOW+"/dispatches";
  await githubApi(endpoint,token,"POST",{
    ref:"main",inputs:{request_id:input.requestId,
      code_b64:Buffer.from(input.code,"utf8").toString("base64")}
  });
}
export async function fetchAgentExperiment(requestId:string,knownRunId?:number|null){
  if(!/^[0-9a-f-]{36}$/i.test(requestId))throw new Error("GITHUB_ACTIONS_INVALID_INPUT");
  const token=await installationToken();
  let run:GitHubRun|null=null;
  const repo="/repos/"+AGENT_ACTIONS_REPO;
  if(knownRunId){
    const r=await githubApi(repo+"/actions/runs/"+knownRunId,token);
    run=await r.json() as GitHubRun;
    if(!run.display_title?.includes(requestId))
      throw new Error("GITHUB_ACTIONS_RUN_MISMATCH");
  }else{
    const r=await githubApi(repo+"/actions/workflows/"+AGENT_ACTIONS_WORKFLOW+
      "/runs?event=workflow_dispatch&per_page=30",token);
    const payload=await r.json() as {workflow_runs?:GitHubRun[]};
    run=(payload.workflow_runs||[]).find(x=>x.display_title?.includes(requestId))||null;
  }
  if(!run)return {found:false as const,status:"queued",log:"$ GitHub Actions: waiting for runner\n"};
  let log="$ github actions workflow "+requestId+"\n";
  if(run.status==="completed"){
    try{
      const jobsRes=await githubApi(repo+"/actions/runs/"+run.id+"/jobs?per_page=10",token);
      const jobs=await jobsRes.json() as {jobs?:GitHubJob[]};
      const job=jobs.jobs?.find(x=>x.name==="Run isolated Node experiment");
      if(job){
        const out=await githubApi(repo+"/actions/jobs/"+job.id+"/logs",token);
        const raw=await out.text();
        // Job logs can contain metadata and timestamps; display bounded text.
        const clean=raw.replace(/\x1b\[[0-9;]*m/g,"")
          .replace(/(gh[ps]_[A-Za-z0-9_]+)/g,"[redacted]")
          .slice(-6500);
        log+=clean;
      }
    }catch{
      log+="Could not retrieve the job log; view the GitHub workflow run.\n";
    }
  }else log+="$ GitHub runner "+(run.status||"queued")+"\n";
  return {found:true as const,runId:run.id,status:run.status||"queued",
    conclusion:run.conclusion||null,htmlUrl:run.html_url||null,log:log.slice(0,7600)};
}
