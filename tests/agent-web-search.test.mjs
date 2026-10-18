import test from "node:test";
import assert from "node:assert/strict";
import {parseResearchRss,wantsWebResearch,researchQuery,searchPublicWeb,
  researchCitations} from "../lib/agent-web-search.ts";

test("search intent: explicit internet request only, not ordinary message",()=>{
  assert.equal(wantsWebResearch("ابحث عن أحدث معلومات الذكاء الاصطناعي"),true);
  assert.equal(wantsWebResearch("Please search the web for sources"),true);
  assert.equal(wantsWebResearch("اكتب مقدمة تسويقية"),false);
  assert.equal(researchQuery("ابحث عن تطورات الذكاء الاصطناعي"),"تطورات الذكاء الاصطناعي");
});
test("RSS parses safe https links, trusted publisher and publication date",()=>{
  const xml=`<rss><channel>
    <item><title><![CDATA[News &amp; context]]></title>
      <link>https://news.google.com/rss/articles/abc</link>
      <description><![CDATA[<p>A new &lt;update&gt;</p>]]></description>
      <source url="https://www.bbc.com/news">BBC</source>
      <pubDate>Sun, 18 Oct 2026 10:00:00 GMT</pubDate></item>
    <item><title>Unsafe link</title><link>javascript:alert(1)</link></item>
  </channel></rss>`;
  const out=parseResearchRss(xml,"news");
  assert.equal(out.length,1);
  assert.equal(out[0].trusted,true);
  assert.equal(out[0].publisher,"BBC");
  assert.match(out[0].excerpt,/A new/);
  assert.equal(out[0].publishedAt,"2026-10-18T10:00:00.000Z");
});
test("source aggregation is read-only, deduplicated and works without keys",async()=>{
  const web=`<rss><channel><item><title>Health bulletin</title>
    <link>https://www.who.int/news/item/healthy</link>
    <description>Official statement</description></item></channel></rss>`;
  const news=`<rss><channel><item><title>Other coverage</title>
    <link>https://news.google.com/rss/articles/coverage</link>
    <description>News summary</description>
    <source url="https://apnews.com">AP</source></item></channel></rss>`;
  const fetcher=async (url)=>{
    if(String(url).includes("bing.com"))return new Response(web,{status:200});
    if(String(url).includes("news.google.com"))return new Response(news,{status:200});
    if(String(url).includes("wikipedia.org"))return new Response(JSON.stringify({
      query:{search:[{title:"Medicine",snippet:"A field of science"}]}
    }),{status:200});
    throw new Error("Unexpected outbound URL");
  };
  const result=await searchPublicWeb("ابحث عن الطب",fetcher);
  assert.equal(result.sources.length,3);
  assert.equal(result.sources.every(s=>s.trusted),true);
  assert.equal(result.warnings.length,0);
  assert.match(researchCitations(result),/who.int/);
});
test("unavailable indexes never become invented sources",async()=>{
  const fetcher=async()=>{throw new Error("offline");};
  const result=await searchPublicWeb("ابحث عن العلوم",fetcher);
  assert.equal(result.sources.length,0);
  assert.equal(result.warnings.length,3);
  assert.match(researchCitations(result),/لم تتوفر مصادر/);
});
