import { NextRequest, NextResponse } from "next/server";
import { errorResponse, getMissionContext, requireAgentSession } from "@/lib/agent-server";
import { AIProviderError, generateSelectedImage, resolveAIConfig, type AISelection } from "@/lib/ai-providers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { missionId?: unknown; ai?: AISelection };
    if (typeof body.missionId !== "string") return NextResponse.json({ error: "المهمة غير صحيحة." }, { status: 400 });
    const session = await requireAgentSession(req);
    const { mission, page } = await getMissionContext(session, body.missionId);
    const ai = resolveAIConfig(body.ai, "image");
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

    const { image: binary, contentType } = await generateSelectedImage(ai, prompt);
    const ext = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
    const path = `${session.organizationId}/${mission.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await session.db.storage.from("marketing-creatives")
      .upload(path, binary, { contentType, upsert: false });
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
    // Quota is independent for images vs text: do not retry automatically.
    const quotaError = error instanceof AIProviderError && error.code === "AI_QUOTA_EXCEEDED";
    const modelError = error instanceof AIProviderError && error.code === "AI_MODEL_UNAVAILABLE";
    console.error("Creative generator error", error instanceof Error ? error.message : "Unknown error");
    const response = errorResponse(error);
    const message = quotaError
      ? "حصة توليد الصور لدى مزوّد الذكاء الاصطناعي انتهت أو وصلت للحد المسموح. اشتغال الوكلاء النصيين لا يعني توفر حصة للصور. استخدم «تصميم بالقالب مجانًا» أو ارفع تصميم جاهز؛ مش هنعيد المحاولة تلقائيًا."
      : modelError
        ? "نموذج الصور غير متاح لحسابك. غيّر «نموذج الصور» إلى نموذج يسمح بتوليد الصور من حسابك، أو استخدم القالب المجاني."
        : response.message;
    return NextResponse.json({
      error: message,
      code: quotaError ? "IMAGE_QUOTA_EXCEEDED" : modelError ? "IMAGE_MODEL_UNAVAILABLE" : response.status >= 500 ? "IMAGE_GENERATION_FAILED" : "IMAGE_PROVIDER_REJECTED",
      upstream: error instanceof AIProviderError
        ? { httpStatus: error.status, providerStatus: error.providerStatus || null }
        : null
    }, { status: response.status, headers: { "Cache-Control": "no-store" } });
  }
}
