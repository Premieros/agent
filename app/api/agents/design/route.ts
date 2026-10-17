import { NextRequest, NextResponse } from "next/server";
import { errorResponse, getMissionContext, requireAgentSession } from "@/lib/agent-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { missionId?: unknown };
    if (typeof body.missionId !== "string") return NextResponse.json({ error: "المهمة غير صحيحة." }, { status: 400 });
    const session = await requireAgentSession(req);
    const { mission, page } = await getMissionContext(session, body.missionId);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("AI_NOT_CONFIGURED");
    if (!["review", "approved"].includes(mission.status)) {
      return NextResponse.json({ error: "شغّل وكلاء المحتوى الأول وراجع المسودات." }, { status: 409 });
    }
    const { count, error: countError } = await session.db.from("creative_assets").select("id", { count: "exact", head: true })
      .eq("mission_id", mission.id).eq("organization_id", session.organizationId);
    if (countError) throw countError;
    if ((count || 0) >= 3) return NextResponse.json({ error: "الحد الأقصى 3 تصاميم لكل مهمة حفاظًا على التكلفة." }, { status: 429 });
    const { data: plan, error: planError } = await session.db.from("agent_outputs")
      .select("content").eq("mission_id", mission.id).eq("organization_id", session.organizationId)
      .eq("agent_role", "designer").maybeSingle();
    if (planError || !plan?.content) return NextResponse.json({ error: "لا توجد خطة تصميم من الوكيل بعد." }, { status: 409 });

    const prompt = `Design one polished social-media promotional graphic, square, appropriate for an Egyptian business.
Brand/page name: ${page.name.slice(0,120)}
Business context: ${page.product_context.slice(0,900)}
Audience: ${page.target_audience.slice(0,450)}
Brand style: ${page.brand_voice.slice(0,300)}
Campaign brief: ${mission.brief.slice(0,950)}
Visual designer instructions: ${plan.content.slice(0,1650)}
Create a high-quality modern composition. Avoid fictitious logos, unsupported stats, fictional hardware specifications, fake badges, or prices. Leave clean breathing room for Arabic copy that can be added later. Do not depict a published advertisement or an actual Meta interface.`.slice(0,4800);

    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
        prompt, size: "1024x1024", quality: "medium", n: 1
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(55000)
    });
    if (!resp.ok) {
      console.error("Creative generation provider status", resp.status);
      return NextResponse.json({ error: "فشل توليد الصورة. راجع صلاحية نموذج الصور ورصيد واجهة OpenAI." }, { status: 502 });
    }
    const result = await resp.json() as { data?: Array<{ b64_json?: string }> };
    const base64 = result.data?.[0]?.b64_json;
    if (!base64) return NextResponse.json({ error: "لم ترجع خدمة الصور ملفًا صالحًا." }, { status: 502 });
    const binary = Buffer.from(base64, "base64");
    if (binary.length < 100 || binary.length > 10485760) {
      return NextResponse.json({ error: "حجم الملف الناتج خارج الحدود." }, { status: 502 });
    }
    const path = `${session.organizationId}/${mission.id}/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await session.db.storage.from("marketing-creatives")
      .upload(path, binary, { contentType: "image/png", upsert: false });
    if (uploadError) throw uploadError;
    const { error: saveError } = await session.db.from("creative_assets").insert({
      organization_id: session.organizationId,
      mission_id: mission.id,
      storage_path: path,
      prompt
    });
    if (saveError) throw saveError;
    return NextResponse.json({ ok: true, message: "تم حفظ التصميم الخاص في مكتبة المهمة." });
  } catch (error) {
    console.error("Creative generator error", error instanceof Error ? error.message : "Unknown error");
    const response = errorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
