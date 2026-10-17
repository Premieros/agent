import { NextRequest, NextResponse } from "next/server";
import { requireAgentSession, errorResponse } from "@/lib/agent-server";
import { resolveAIConfig, askSelectedAgent, type AISelection } from "@/lib/ai-providers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await requireAgentSession(req);
    const body = await req.json() as { ai?: AISelection };
    const ai = resolveAIConfig(body.ai);
    // One small billable API request. No key or prompt is stored.
    const check = await askSelectedAgent(ai, "فاحص الاتصال",
      "رد بكلمة واحدة قصيرة وواضحة تؤكد استجابة النموذج. لا ترد بكود.",
      "اكتب كلمة: متصل", 70);
    return NextResponse.json({
      ok: true, provider: ai.provider, model: ai.model,
      sample: check.text.slice(0, 80), organizationId: session.organizationId
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Provider test", error instanceof Error ? error.message : "unknown");
    const response = errorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status, headers: { "Cache-Control": "no-store" } });
  }
}
