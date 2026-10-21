/** Deterministic, side-effect-free transitions for the optional AGENT project worker.
 * A scheduled caller must authenticate before any state transitions are attempted.
 */
export type AgentProjectPhase="planned"|"ready"|"testing"|"repairing"|"completed"|"failed";
export type AgentProjectWorkerAction="none"|"dispatch"|"poll"|"repair"|"expire";
export function nextProjectWorkerAction(
 status:AgentProjectPhase,approvedAt:string|null,deadlineAt:string|null,
 attempts:number,maxAttempts:number,now=Date.now()
):AgentProjectWorkerAction{
 if(!approvedAt||!deadlineAt||["planned","completed","failed"].includes(status))return "none";
 if(!Number.isFinite(new Date(deadlineAt).getTime()))return "none";
 if(now>=new Date(deadlineAt).getTime())return "expire";
 if(status==="testing")return "poll";
 if(status==="repairing"&&attempts<maxAttempts)return "repair";
 if(status==="ready"&&attempts<maxAttempts)return "dispatch";
 return "none";
}
export function projectShouldRepair(
 verified:boolean,finished:boolean,realFailedExit:boolean,attempts:number,
 maxAttempts:number,modelCalls:number,expired:boolean
):boolean{
 return finished&&!verified&&!expired&&realFailedExit&&
   attempts<maxAttempts&&modelCalls===1;
}
