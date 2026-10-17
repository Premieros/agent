import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export type AgentSession = {
  db: SupabaseClient;
  userId: string;
  organizationId: string;
  role: string;
};

export async function requireAgentSession(req: NextRequest): Promise<AgentSession> {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) throw new Error("SESSION_REQUIRED");
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("SESSION_REQUIRED");
  const { data: membership, error: memberError } = await db.from("organization_members")
    .select("organization_id,role")
    .eq("user_id", data.user.id)
    .in("role", ["admin", "manager"])
    .limit(1).maybeSingle();
  if (memberError || !membership) throw new Error("PERMISSION_DENIED");
  return { db, userId: data.user.id, organizationId: membership.organization_id, role: membership.role };
}

export function errorResponse(error: unknown): { message: string; status: number } {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (message === "SESSION_REQUIRED") return { message: "يرجى تسجيل الدخول من جديد.", status: 401 };
  if (message === "PERMISSION_DENIED") return { message: "هذه العملية تحتاج مديرًا أو مسؤول تسويق.", status: 403 };
  if (message === "AI_NOT_CONFIGURED") return { message: "اختار المزوّد وأدخل مفتاح API صالحًا، أو أضفه إلى إعدادات Vercel.", status: 503 };
  if (message === "AUTO_NO_FREE_MODELS") return { message: "مافيش نماذج مجانية معلنة متاحة بالمفاتيح المحفوظة. أضف OPENROUTER_API_KEY في Vercel وابحث من جديد، أو فعّل استخدام مرشحي الحصة المجانية مع العلم إنها قد تكون مدفوعة حسب حسابك.", status: 503 };
  if (message === "AUTO_ALL_FAILED") return { message: "كل بدائل التشغيل التلقائي المتاحة فشلت أو وصلت لحد الاستخدام، واتوقّفنا من غير تشغيل نموذج مدفوع بديل. جرّب لاحقًا أو زوّد مزوّد مجاني آخر.", status: 503 };
  if (message === "AUTO_ECONOMY_ONLY") return { message: "التبديل التلقائي شغال حاليًا في الوضع الاقتصادي فقط لتقييد عدد الطلبات. اختار اقتصادي، أو بدّل للوضع اليدوي.", status: 400 };
  if (message === "AI_PROVIDER_UNSUPPORTED") return { message: "المزوّد غير مدعوم. اختر واحدًا من القائمة.", status: 400 };
  if (message === "AI_IMAGE_UNSUPPORTED") return { message: "توليد الصور متاح حاليًا بمفتاح OpenAI أو Gemini وبنموذج صور مدعوم فقط.", status: 400 };
  if (message === "AI_KEY_INVALID" || message === "AI_MODEL_INVALID") return { message: "المفتاح أو اسم النموذج غير صالح.", status: 400 };
  if (message === "AI_CREDENTIALS_REJECTED") return { message: "المزوّد رفض المفتاح أو الصلاحيات. راجع المفتاح وحالة حسابك.", status: 401 };
  if (message === "AI_QUOTA_EXCEEDED") return { message: "انتهت الحصة أو وصل المزوّد لحد الطلبات. جرّب لاحقًا أو نموذجًا آخر.", status: 429 };
  if (message === "AI_ECONOMY_FORMAT") return { message: "النموذج لم يرجّع الأقسام بصيغة صحيحة في الوضع الاقتصادي. جرّب مرة أخرى أو استخدم الوضع الكامل. لم تُحفظ مسودات ناقصة.", status: 502 };
  if (message === "AI_MODEL_UNAVAILABLE") return { message: "النموذج غير متاح لدى المزوّد أو الاسم غير صحيح.", status: 400 };
  if (message === "AI_ACCESS_RESTRICTED") return { message: "المزوّد قيّد الوصول لهذا النموذج أو الخدمة بسبب البلد أو متطلبات الفوترة. تحقق من صلاحيات وحصة حسابك.", status: 403 };
  if (message === "AI_REQUEST_INVALID") return { message: "المزوّد رفض إعدادات الطلب. اختار نموذج دردشة من «عرض النماذج المتاحة» ثم جرّب الاختبار.", status: 400 };
  if (message === "AI_PROVIDER_FAILURE" || message === "AI_EMPTY_OUTPUT" || message === "AI_IMAGE_SIZE") return { message: "حدث خطأ في مزوّد الذكاء الاصطناعي. تأكد من الحساب ونوع النموذج.", status: 502 };
  if (message === "MISSION_NOT_FOUND") return { message: "المهمة غير موجودة أو ليست لديك صلاحية الوصول إليها.", status: 404 };
  if (message === "MISSION_BUSY") return { message: "المهمة مش جاهزة للتشغيل؛ راجع حالتها أولًا.", status: 409 };
  return { message: "تعذر إتمام العملية. راجع إعدادات الوكلاء أو سجلات النظام.", status: 500 };
}

export async function getMissionContext(session: AgentSession, missionId: string) {
  if (!/^[0-9a-fA-F-]{36}$/.test(missionId)) throw new Error("MISSION_NOT_FOUND");
  const { data: mission, error } = await session.db.from("agent_missions")
    .select("id,organization_id,page_id,objective,brief,budget_egp,status")
    .eq("id", missionId).eq("organization_id", session.organizationId).single();
  if (error || !mission) throw new Error("MISSION_NOT_FOUND");
  const { data: page } = await session.db.from("marketing_pages")
    .select("id,name,platform,product_context,target_audience,brand_voice,connection_status")
    .eq("id", mission.page_id).eq("organization_id", session.organizationId).single();
  if (!page) throw new Error("MISSION_NOT_FOUND");
  return { mission, page };
}

