/** Honest, deterministic user-facing interpretation of Work execution evidence.
 * A process exit cannot prove that an application is correct; this parser
 * never reads model private reasoning and never invents command results.
 */
export type WorkEvidence={
  status:string; attempted:boolean; succeeded:boolean|null;
  log?:string|null; runner:"github"|"sandbox";
};
export function describeWorkEvidence(run:WorkEvidence){
  const log=String(run.log||"");
  const short=log.slice(-7600);
  const assertion=/AssertionError|ERR_ASSERTION|ERR_ASSERTION_ERROR/i.test(short);
  const comparison=short.match(/(-?\d+)\s*!==\s*(-?\d+)/);
  const syntax=/SyntaxError|syntax exit=[1-9]/i.test(short);
  const moduleMissing=/MODULE_NOT_FOUND|Cannot find module/i.test(short);
  const timeout=/\b(?:exit=124|timed out|timeout)\b/i.test(short);
  const complete=["executed","completed","failed"].includes(run.status);
  const executing=["running","reporting"].includes(run.status);
  const phase=run.status==="planned"?"بانتظار مراجعة الكود والموافقة":
    executing?"التجربة جارية":
    !complete?"لم يبدأ التنفيذ بعد":
    !run.attempted?"انتهى التشغيل، لكن لا يوجد دليل كافٍ على تنفيذ اختبار":
    run.succeeded===true?"اجتاز البرنامج الاختبارات التي شُغّلت":
    run.succeeded===false?"الاختبارات فشلت — نحتاج إصلاحًا":"لم تتوفر نتيجة اختبار مؤكدة";
  let cause="";
  let next="";
  if(run.attempted&&run.succeeded===false){
    if(assertion){
      cause=comparison?
        "اختبار تحقق (assert) فشل: القيمة الفعلية "+comparison[1]+
        " بينما القيمة التي توقعها الاختبار "+comparison[2]+".":
        "اختبار تحقق (assert) فشل لأن النتيجة لا تطابق الشرط المتوقع.";
      next="راجع وظيفة الحذف وشرط الاختبار؛ قد تكون المشكلة في الكود أو في التوقع نفسه. أنشئ إصلاحًا جديدًا ثم راجعه قبل إعادة الاختبار.";
    }else if(syntax){
      cause="البرنامج لم يجتز فحص صياغة JavaScript.";
      next="صحّح الصياغة ثم راجع الكود قبل إعادة الاختبار.";
    }else if(moduleMissing){
      cause="البرنامج حاول استيراد ملف أو حزمة غير موجودة في بيئة الاختبار.";
      next="راجع أسماء الوحدات والملفات؛ بيئة الاختبار لا تثبّت npm تلقائيًا.";
    }else if(timeout){
      cause="انتهت المهلة المحددة للتجربة قبل اكتمال التنفيذ.";
      next="ابحث عن حلقة غير منتهية أو اختبار طويل ثم أعد المحاولة بعد مراجعة الكود.";
    }else {
      cause="رجع مشغّل الاختبار بنتيجة فشل؛ التفاصيل التقنية متاحة في سجل الأوامر.";
      next="افحص رسالة الخطأ والكود ثم أعد إعداد خطة إصلاح للمراجعة.";
    }
  }else if(complete&&run.attempted&&run.succeeded===true){
    cause="نتيجة عملية التشغيل ناجحة، لكنها لا تثبت أن كل وظائف التطبيق سليمة.";
    next="راجع وظائف التطبيق وحالات الاختبار، ثم احفظ الكود والنتيجة في المكتبة إذا أردت.";
  }else if(complete&&!run.attempted){
    cause="لا يوجد سجل موثوق يكفي للحكم على نجاح البرنامج.";
    next="راجع سجل GitHub Actions أو أعد الاختبار بعد مراجعة الكود.";
  }
  return {phase,cause,next,failed:complete&&run.succeeded===false&&run.attempted,
    passed:complete&&run.succeeded===true&&run.attempted,
    hasEvidence:complete&&run.attempted};
}
export function workEvidenceReport(run:WorkEvidence){
  const d=describeWorkEvidence(run);
  return [
    "**"+(d.failed?"الاختبار فشل":d.passed?"الاختبار نجح":"نتيجة التجربة")+"** — "+d.phase+".",
    d.cause||"",
    d.failed?
      "يمكنك الضغط على **«حضّر إصلاحًا»** أسفل الرد؛ سيراجع AGENT الكود وسجل الخطأ ويعرض نسخة جديدة قبل أي إعادة اختبار.":
      d.next||"",
    "لم يُنشر التطبيق أو تُكتب ملفات إلى المستودع."
  ].filter(Boolean).join("\n\n");
}
