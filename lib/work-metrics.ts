/**
 * Deterministic campaign calculations for AGENT Work.
 * Extract labelled counts; never infer unlabeled numeric positions.
 */
function westernDigits(value:string):string {
  return value.replace(/[٠-٩۰-۹]/g,d=>{
    const code=d.charCodeAt(0);
    return String(code>=0x6f0?code-0x6f0:code-0x660);
  }).replace(/٬/g,",");
}
const visitAfter=/(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*(?:الزيارات|زيارات|زيارة|زوار|زائر|visits?|visitors?|sessions?|clicks?|نقرات|نقرة)(?=\s|[،,.;:!?]|$)/iu;
const visitBefore=/(?:الزيارات|زيارات|زيارة|زوار|زائر|visits?|visitors?|sessions?|clicks?|نقرات|نقرة)\s*(?::|=|عددها|هي)?\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)(?=\s|[،,.;:!?]|$)/iu;
const conversionAfter=/(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*(?:التحويلات|تحويلات|تحويل|الطلبات|طلبات|طلب|(?:عمليات|عملية)\s*بيع|(?:عمليات|عملية)\s*شراء|مبيعات|مشتريات|sales?|orders?|conversions?|purchases?|leads?)(?=\s|[،,.;:!?]|$)/iu;
const conversionBefore=/(?:التحويلات|تحويلات|تحويل|الطلبات|طلبات|طلب|(?:عمليات|عملية)\s*بيع|(?:عمليات|عملية)\s*شراء|مبيعات|مشتريات|sales?|orders?|conversions?|purchases?|leads?)\s*(?::|=|عددها|هي)?\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)(?=\s|[،,.;:!?]|$)/iu;
function readCount(text:string,after:RegExp,before:RegExp):number|null {
  const match=after.exec(text)||before.exec(text);
  if(!match)return null;
  const value=Number(match[1].replace(/[\s,]/g,""));
  return Number.isSafeInteger(value)&&value>=0?value:null;
}
export function needsCampaignConversion(task:string):boolean {
  return /(?:معدل\s*التحويل|نسبة\s*التحويل|conversion\s*rate)/iu.test(task);
}
export function asksForConversionFigures(task:string):boolean {
  return /(?:visits?|conversions?|زيارات|زيارة|تحويلات|التحويلات|عملية\s*بيع|عمليات\s*بيع|طلبات|الطلبات)/iu.test(task);
}
export function extractCampaignConversion(task:string,historyIntent=false):
 {visits:number;conversions:number;percent:number}|null {
  if(!needsCampaignConversion(task)&&!historyIntent)return null;
  const normalized=westernDigits(task);
  const visits=readCount(normalized,visitAfter,visitBefore);
  const conversions=readCount(normalized,conversionAfter,conversionBefore);
  if(visits===null||conversions===null||visits<=0)return null;
  return {visits,conversions,percent:Math.round((conversions/visits)*10000)/100};
}
