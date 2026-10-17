// Browser-only, zero-AI-cost promotional card renderer.
// This creates a deliberately simple template, NOT an AI-generated photograph.
export type TemplateCreative = {
  brand: string;
  headline: string;
  subline: string;
};

function linesFor(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? current + " " + word : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    } else current = next;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

export async function renderFreeCreative(item: TemplateCreative): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("المتصفح لا يدعم إنشاء التصميم.");
  if (document.fonts?.ready) await Promise.race([document.fonts.ready, Promise.resolve()]);
  const bg = ctx.createLinearGradient(0, 0, 1080, 1080);
  bg.addColorStop(0, "#073B48");
  bg.addColorStop(.55, "#0D5961");
  bg.addColorStop(1, "#15957A");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1080);

  // Neutral geometric graphic accents, not a fabricated product photo.
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.075)";
  ctx.beginPath(); ctx.arc(120, 880, 280, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(1030, 80, 340, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.17)"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(120, 880, 350, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(1030, 80, 420, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // Upper/right brand capsule
  ctx.fillStyle = "rgba(255,255,255,.15)";
  ctx.beginPath(); ctx.roundRect(640, 78, 350, 74, 36); ctx.fill();
  ctx.textAlign = "right"; ctx.direction = "rtl";
  ctx.fillStyle = "#FFFFFF"; ctx.font = '700 35px Cairo, Tahoma, sans-serif';
  const brand = item.brand.trim().slice(0, 42) || "علامتك التجارية";
  ctx.fillText(brand, 950, 125, 285);

  // Main editorial copy, with enough padding to avoid clipping.
  ctx.fillStyle = "#8CE7C8";
  ctx.fillRect(800, 297, 170, 9);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = '800 74px Cairo, Tahoma, sans-serif';
  const title = item.headline.trim().slice(0, 115) || "حلول تناسب شغلك";
  const titleLines = linesFor(ctx, title, 855, 4);
  let y = 405;
  for (const line of titleLines) {
    ctx.fillText(line, 968, y, 850);
    y += 103;
  }
  const subtitleY = Math.min(807, y + 39);
  ctx.fillStyle = "#C2E8E5";
  ctx.font = '500 34px Cairo, Tahoma, sans-serif';
  const subtitle = item.subline.trim().slice(0, 170) || "اكتشف المزيد وتواصل معنا";
  const subLines = linesFor(ctx, subtitle, 845, 3);
  for (let i = 0; i < subLines.length; i++) ctx.fillText(subLines[i], 965, subtitleY + i * 56, 840);

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(70, 962, 940, 2);
  ctx.font = '500 23px Cairo, Tahoma, sans-serif';
  ctx.textAlign = "right";
  ctx.fillStyle = "#D5F8EB";
  ctx.fillText("تواصل معنا لمعرفة التفاصيل", 962, 1020);
  ctx.textAlign = "left";
  ctx.fillText("AGENT • TEMPLATE", 76, 1020);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("تعذر تصدير التصميم.")), "image/png");
  });
}
