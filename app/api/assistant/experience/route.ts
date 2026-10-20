import {NextRequest,NextResponse} from "next/server";
import {requireAgentSession,errorResponse} from "@/lib/agent-server";
import {taskDomain} from "@/lib/agent-adaptive-routing";
import {proposeValidatedExperienceLesson} from "@/lib/agent-experience";
export const runtime="nodejs";
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers={"Cache-Control":"no-store"};
const respond=(value:unknown,status=200)=>NextResponse.json(value,{status,headers});

export async function GET(req:NextRequest){
  try{
    const s=await requireAgentSession(req);
    const threadId=new URL(req.url).searchParams.get("threadId");
    if(!threadId||!id.test(threadId))return respond({error:"المحادثة غير صالحة."},400);
    const owner=await s.db.from("assistant_threads").select("id")
      .eq("id",threadId).eq("organization_id",s.organizationId)
      .eq("user_id",s.userId).maybeSingle();
    if(owner.error)throw owner.error;
    if(!owner.data)return respond({error:"المحادثة غير موجودة."},404);
    const messages=await s.db.from("assistant_messages").select("id")
      .eq("thread_id",threadId).eq("organization_id",s.organizationId)
      .eq("role","assistant").order("created_at",{ascending:false}).limit(100);
    if(messages.error)throw messages.error;
    const ids=(messages.data||[]).map(x=>x.id);
    if(!ids.length)return respond({feedback:{}});
    const q=await s.db.from("assistant_experience_events")
      .select("reference_id,outcome").eq("organization_id",s.organizationId)
      .eq("user_id",s.userId).eq("kind","reply_feedback").in("reference_id",ids);
    if(q.error)throw q.error;
    return respond({feedback:Object.fromEntries((q.data||[]).map(x=>[x.reference_id,x.outcome]))});
  }catch(e){const v=errorResponse(e);return respond({error:v.message},v.status);}
}
export async function POST(req:NextRequest){
  try{
    const s=await requireAgentSession(req);
    const b=await req.json() as {messageId?:unknown;outcome?:unknown};
    if(typeof b.messageId!=="string"||!id.test(b.messageId)||
      !["positive","negative"].includes(String(b.outcome)))
      return respond({error:"حدد الرد والتقييم الصحيحين."},400);
    const m=await s.db.from("assistant_messages")
      .select("id,thread_id,model,role,created_at")
      .eq("id",b.messageId).eq("organization_id",s.organizationId).maybeSingle();
    if(m.error)throw m.error;
    if(!m.data||m.data.role!=="assistant"||!m.data.model)
      return respond({error:"الرد غير متاح."},404);
    const t=await s.db.from("assistant_threads").select("id").eq("id",m.data.thread_id)
      .eq("organization_id",s.organizationId).eq("user_id",s.userId).maybeSingle();
    if(t.error)throw t.error;
    if(!t.data)return respond({error:"الرد لا يخص محادثاتك."},403);
    // Rate the task that elicited this reply, not its model's claims.
    const previous=await s.db.from("assistant_messages").select("content")
      .eq("organization_id",s.organizationId).eq("thread_id",m.data.thread_id)
      .eq("role","user").lt("created_at",m.data.created_at)
      .order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(previous.error)throw previous.error;
    const domain=taskDomain(String(previous.data?.content||""));
    const row={
      organization_id:s.organizationId,user_id:s.userId,
      kind:"reply_feedback",reference_id:m.data.id,task_domain:domain,
      model:String(m.data.model).slice(0,180),
      outcome:b.outcome,evidence:"Explicit user rating; correctness not independently verified.",
      updated_at:new Date().toISOString()
    };
    const saved=await s.db.from("assistant_experience_events").upsert(row,{
      onConflict:"organization_id,user_id,kind,reference_id"
    }).select("id").single();
    if(saved.error)throw saved.error;
    if(b.outcome==="positive"){
      // A failure to propose a lesson must never erase the stored feedback.
      try{await proposeValidatedExperienceLesson(s,domain);}
      catch{console.warn("AGENT learning proposal unavailable");}
    }
    return respond({ok:true,outcome:b.outcome});
  }catch(e){const v=errorResponse(e);return respond({error:v.message},v.status);}
}
