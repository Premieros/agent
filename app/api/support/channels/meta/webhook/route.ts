import {NextRequest,NextResponse} from "next/server";
import {parseMetaTextEvents,verifyMetaSignature,verifyMetaSubscription} from "@/lib/support-channels/meta-webhook";

export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};

/**
 * Shared Meta webhook endpoint for WhatsApp Cloud API, Messenger and Instagram.
 * Handshake + signed event parsing are implemented; delivery is deliberately
 * NOT acknowledged until a durable, project-scoped message queue is installed.
 * This prevents silently losing real customer messages during setup.
 */
export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams;
 const challenge=verifyMetaSubscription(
   q.get("hub.mode"),q.get("hub.verify_token"),q.get("hub.challenge"),
   process.env.SUPPORT_META_VERIFY_TOKEN
 );
 if(!challenge)return new NextResponse("Forbidden",{status:403,headers});
 return new NextResponse(challenge,{status:200,headers:{
  ...headers,"Content-Type":"text/plain; charset=utf-8"
 }});
}

export async function POST(req:NextRequest){
 if(process.env.SUPPORT_META_WEBHOOK_ENABLED!=="true")
  return NextResponse.json({error:"Meta connector is not enabled"},{status:503,headers});
 const stated=Number(req.headers.get("content-length")||0);
 if(!Number.isFinite(stated)||stated>128_000)
  return NextResponse.json({error:"Payload too large"},{status:413,headers});
 const raw=await req.text();
 if(Buffer.byteLength(raw,"utf8")>128_000)
  return NextResponse.json({error:"Payload too large"},{status:413,headers});
 if(!verifyMetaSignature(raw,req.headers.get("x-hub-signature-256"),process.env.SUPPORT_META_APP_SECRET))
  return NextResponse.json({error:"Invalid signature"},{status:403,headers});
 let body:unknown;
 try{body=JSON.parse(raw);}catch{
  return NextResponse.json({error:"Invalid JSON"},{status:400,headers});
 }
 const messages=parseMetaTextEvents(body);
 // Never return a fake 200 for incoming customer messages.
 // Implement durable ingest with account→project mapping and idempotency first.
 if(messages.length>0)
  return NextResponse.json({error:"Durable channel ingest not configured"},{status:503,headers});
 // Non-message subscription verification and delivery/status events may be acked.
 return NextResponse.json({ok:true},{status:200,headers});
}
