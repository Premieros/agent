import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireAgentSession } from "@/lib/agent-server";
import { autoProviderInfo, discoverAutoModels } from "@/lib/auto-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    await requireAgentSession(req);
    const allowConditional = new URL(req.url).searchParams.get("includeFreeTier") === "true";
    const candidates = await discoverAutoModels(allowConditional);
    return NextResponse.json({
      candidates,
      providers: autoProviderInfo(),
      allowConditional,
      limits: {
        maxAttempts: 3,
        spendGuarantee: allowConditional ? "not-guaranteed" : "provider-labelled-free-only"
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = errorResponse(error);
    return NextResponse.json({ error: failure.message }, {
      status: failure.status, headers: { "Cache-Control": "no-store" }
    });
  }
}
