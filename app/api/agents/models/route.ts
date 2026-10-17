import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireAgentSession } from "@/lib/agent-server";
import { listAvailableTextModels, resolveAIConfig, type AISelection } from "@/lib/ai-providers";

export const runtime = "nodejs";
export const maxDuration = 60;

// Models are discovered from the user's chosen provider/key.
// The key is supplied in the POST body to keep it out of URLs and access logs.
export async function POST(req: NextRequest) {
  try {
    await requireAgentSession(req);
    const body = await req.json() as { ai?: AISelection };
    const config = resolveAIConfig({ provider: body.ai?.provider, apiKey: body.ai?.apiKey });
    const models = await listAvailableTextModels(config);
    return NextResponse.json(
      { provider: config.provider, models, count: models.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const failure = errorResponse(error);
    return NextResponse.json(
      { error: failure.message },
      { status: failure.status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
