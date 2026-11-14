/** Project-scoped knowledge matching for the admin's Support AI preview.
 * Retrieval is relevance-only: security scoping is enforced in the database query.
 */
export type SupportPreviewDocument={id:string;title:string;content:string};
export function normalizedSupportText(value:string):string{
 return value.toLocaleLowerCase("ar").normalize("NFKC")
  .replace(/[\u064B-\u065F\u0670\u0640]/g,"")
  .replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
  .replace(/[^\p{L}\p{N}]+/gu," ").trim();
}
const stop=new Set(["كيف","هل","الى","علي","متى","عندي","اريد","يمكن","انا","ايه","ماذا","هذا","هذه","اذا","عند","لدي","ليه","فين","what","how","the","does","can","with","from"]);
function forms(word:string):string[]{
 const candidates=new Set([word]);
 const withoutArticle=word.startsWith("وال")&&word.length>=6?word.slice(3):
  word.startsWith("ال")&&word.length>=5?word.slice(2):word;
 candidates.add(withoutArticle);
 for(const w of [word,withoutArticle]){
  if(w.endsWith("ات")&&w.length>=5)candidates.add(w.slice(0,-2));
  if(w.endsWith("ا")&&w.length>=4)candidates.add(w.slice(0,-1));
 }
 return [...candidates].filter(w=>w.length>=3);
}
export function selectSupportSources(query:string,docs:SupportPreviewDocument[],max=4):SupportPreviewDocument[]{
 const tokens=normalizedSupportText(query).split(/\s+/).filter(t=>t.length>=3&&!stop.has(t)).slice(0,80);
 const formsByToken=tokens.map(forms);
 return docs.map(doc=>{
  const title=normalizedSupportText(doc.title),body=normalizedSupportText(doc.content);
  let score=0;
  for(const terms of formsByToken){
   if(terms.some(t=>title.includes(t)))score+=3;
   else if(terms.some(t=>body.includes(t)))score+=1;
  }
  return {doc,score};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,max).map(x=>x.doc);
}
/** Exact business facts cannot be invented when no project documents match. */
export function requiresVerifiedProjectKnowledge(query:string):boolean{
 const q=normalizedSupportText(query);
 return /(?:سعر|اسعار|تكلفه|رسوم|اشتراك|دفع|فوتره|خصم|عرض خاص|ضمان|استرجاع|استرداد|ارجاع|سياسه|توصيل|شحن|مده التسليم|موعد التسليم|صلاحيه حسابي|رصيدي|فاتورتي|بياناتي|password|token|pricing|refund|discount|billing|shipping|policy)/.test(q);
}
