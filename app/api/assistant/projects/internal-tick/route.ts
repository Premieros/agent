import {NextRequest,NextResponse} from "next/server";
import {createHash,timingSafeEqual} from "node:crypto";
import {runOneAgentProjectWorkerTick} from "@/lib/agent-project-background";
export const runtime="nodejs";
export const maxDuration=60;
const reply=(data:unknown,status=200)=>NextResponse.json(data,{
 status,headers:{"Cache-Control":"private, no-store"}
});
/** Disabled by default. Never use the owner's browser JWT for unattended work. */
export async function POST(req:NextRequest){
 const key=process.env.AGENT_PROJECT_WORKER_SECRET;
 if(!key||key.length<32||!process.env.AGENT_PROJECT_WORKER_DB_KEY||
   process.env.AGENT_PROJECT_WORKER_PROJECT_ID!=="gldlgdycgneadbqftcrj")
  return reply({error:"AGENT_BACKGROUND_WORKER_DISABLED"},503);
 const token=req.headers.get("x-agent-project-worker-secret")||"";
 const expected=createHash("sha256").update(key,"utf8").digest();
 const provided=createHash("sha256").update(token,"utf8").digest();
 if(!token||!timingSafeEqual(expected,provided))
  return reply({error:"UNAUTHORIZED"},401);
 try{
  const result=await runOneAgentProjectWorkerTick();
  return reply({ok:true,...result});
 }catch(e){
  console.warn("AGENT worker failed",e instanceof Error?e.name:"unknown");
  return reply({error:"AGENT_PROJECT_WORKER_UNAVAILABLE"},503);
 }
}
