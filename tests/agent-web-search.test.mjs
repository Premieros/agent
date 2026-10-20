import test from "node:test";
import assert from "node:assert/strict";
import {parseResearchRss,wantsWebResearch,researchQuery,searchPublicWeb,
  researchCitations,directResearchAnswer} from "../lib/agent-web-search.ts";

const rss=items=>"<rss><channel>"+items.join("")+"</channel></rss>";
const item=(title,url,description,date="",source="")=>
  "<item><title>"+title+"</title><link>"+url+"</link><description>"+
  description+"</description>"+(date?"<pubDate>"+date+"</pubDate>":"")+
  source+"</item>";
const activeDate=new Date().toUTCString();
const oldDate="Wed, 04 Jan 2023 14:00:00 GMT";

test("query removes conversational formatting requests but preserves the subject",()=>{
  const prompt="ابحث عن أحدث الأخبار الموثوقة في الذكاء الاصطناعي، وأرفق المصادر وتواريخ نشرها مع توضيح حدود التحقق.";
  assert.equal(wantsWebResearch(prompt),true);
  assert.equal(researchQuery(prompt),"أحدث الأخبار الموثوقة في الذكاء الاصطناعي");
  assert.equal(researchQuery("ابحث عن الطب"),"الطب");
  assert.equal(wantsWebResearch("Please search the web for sources"),true);
  assert.equal(wantsWebResearch("اكتب مقدمة تسويقية"),false);
});

test("RSS sanitizes entities, limits broken links, and classifies publishers",()=>{
  const xml=rss([
    item("<![CDATA[AI &amp; science]]>","https://news.google.com/rss/articles/abc",
      "<![CDATA[<p>Artificial intelligence &lt;update&gt;</p>]]>",
      activeDate,'<source url="https://www.bbc.com/news">BBC</source>'),
    item("Extremely long","https://example.com/"+ "A".repeat(600),"AI"),
    item("Unsafe","javascript:alert(1)","AI")
  ]);
  const out=parseResearchRss(xml,"news");
  assert.equal(out.length,1);
  assert.equal(out[0].title,"AI & science");
  assert.equal(out[0].trusted,true);
  assert.equal(out[0].publisher,"BBC");
  assert.match(out[0].excerpt,/Artificial intelligence/);
  assert.equal(out[0].publishedAt,new Date(activeDate).toISOString());
});

test("live-search regression: reject unrelated trusted mechanical companies and stale news",async()=>{
  const web=rss([
    item("Mechanical Contractors New York | BBB","https://www.bbb.com/mechanical",
      "New York mechanical contractors HVAC and plumbing"),
    item("Stirling Mechanical LLC","https://stirlingmech.com",
      "HVAC plumbing and fire protection"),
    item("AI policy developments","https://www.bbc.com/news/ai-policy",
      "Artificial intelligence AI regulation",activeDate),
    item("AI history from 2023","https://www.bbc.com/news/ai-old",
      "Artificial intelligence",oldDate)
  ]);
  const news=rss([
    item("Artificial intelligence research announcement",
      "https://news.google.com/rss/articles/ai-news",
      "New AI research coverage",activeDate,
      '<source url="https://apnews.com">AP News</source>')
  ]);
  const fetched=[];
  const fetcher=async url=>{
    fetched.push(String(url));
    if(String(url).includes("bing.com"))return new Response(web,{status:200});
    if(String(url).includes("news.google.com"))return new Response(news,{status:200});
    throw new Error("Unexpected outbound URL");
  };
  const result=await searchPublicWeb(
    "ابحث عن أحدث الأخبار الموثوقة في الذكاء الاصطناعي، وأرفق المصادر وتواريخ نشرها",fetcher);
  assert.equal(result.query,"أحدث الأخبار الموثوقة في الذكاء الاصطناعي");
  assert.equal(result.sources.length,2);
  assert.equal(result.sources.some(s=>/mechanical|BBB|Stirling/i.test(s.title)),false);
  assert.equal(result.sources.some(s=>s.url.includes("ai-old")),false);
  assert.equal(result.sources.every(s=>/AI|artificial intelligence/i.test(s.title+" "+s.excerpt)),true);
  assert.equal(result.warnings.some(w=>w.includes("استُبعدت")),true);
  assert.equal(fetched.length,2);
  assert.equal(fetched.some(s=>s.includes("artificial+intelligence+AI")),true);
  assert.doesNotMatch(fetched.join("\n"),/تواريخ/);
});

test("other subjects still retrieve related results, including encyclopedias",async()=>{
  const web=rss([item("دليل الطب الحديث","https://www.who.int/medicine",
    "الطب وتاريخ الممارسة الطبية")]);
  const news=rss([item("مشاريع عقارية","https://apnews.com/property",
    "مشاريع إسكان حديثة")]);
  const fetcher=async url=>{
    if(String(url).includes("bing.com"))return new Response(web,{status:200});
    if(String(url).includes("news.google.com"))return new Response(news,{status:200});
    if(String(url).includes("wikipedia.org"))return new Response(JSON.stringify({
      query:{search:[{title:"الطب",snippet:"علم الطب وتطور العلاج"},
        {title:"ميكانيكا",snippet:"مقاولات نيويورك"}]}
    }),{status:200});
    throw new Error("Unexpected outbound URL");
  };
  const result=await searchPublicWeb("ابحث عن الطب",fetcher);
  assert.equal(result.sources.length,2);
  assert.equal(result.sources.some(s=>s.title.includes("عقارية")),false);
  assert.match(researchCitations(result),/who.int/);
  assert.match(directResearchAnswer(result),/غير متحقق/);
});

test("no suitable sources is not disguised as real research",async()=>{
  const fetcher=async()=>{throw new Error("offline");};
  const result=await searchPublicWeb("ابحث عن العلوم",fetcher);
  assert.equal(result.sources.length,0);
  assert.equal(result.warnings.length,4);
  assert.match(researchCitations(result),/لم تتوفر مصادر/);
  assert.doesNotMatch(directResearchAnswer(result),/undefined/);
});
