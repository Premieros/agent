import { NextRequest, NextResponse } from "next/server";
import { requireAgentSession, errorResponse } from "@/lib/agent-server";
import { configuredProviders } from "@/lib/ai-providers";

export async function GET(req: NextRequest) {
  try {
    await requireAgentSession(req);
    const available = configuredProviders();
    return NextResponse.json({
      aiReady: available.length > 0,
      imageReady: available.includes("openai") || available.includes("gemini"),
      configuredProviders: available,
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
