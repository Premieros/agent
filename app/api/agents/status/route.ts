import { NextRequest, NextResponse } from "next/server";
import { requireAgentSession, errorResponse } from "@/lib/agent-server";

export async function GET(req: NextRequest) {
  try {
    await requireAgentSession(req);
    return NextResponse.json({
      aiReady: Boolean(process.env.OPENAI_API_KEY),
      imageReady: Boolean(process.env.OPENAI_API_KEY),
      metaConnected: false,
      canPublish: false,
      canReplyExternally: false,
      canSpendOnAds: false,
    });
  } catch (error) {
    const e = errorResponse(error);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
