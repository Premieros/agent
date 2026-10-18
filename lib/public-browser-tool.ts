/**
 * First read-only web-page tool.
 * Security: exact public host/path allowlist, HTTPS-only, no redirects, no
 * credentials, size/time limits. Never a generic proxy or interactive browser.
 */
export type PublicPageResult={url:string;title:string;text:string;fetched:boolean;note:string};
const allowlisted={
  "premieros-sage.vercel.app":(path:string)=>path==="/" || path==="/login",
  "premieros-ai-sales-agent.vercel.app":(path:string)=>["/","/assistant","/studio"].includes(path),
  "github.com":(path:string)=>/^\/Premieros\/(?:\.com|agent)(?:\/|$)/.test(path)
};
type Host=keyof typeof allowlisted;
function safeURL(value:string):URL|null{
  try{
    const u=new URL(value);
    if(u.protocol!=="https:" || u.username || u.password || u.port || u.search) return null;
    // HashRouter fragments are client-side only, not part of HTTP fetching.
    // Permit the known Premier.OS login fragment; still fetch public HTML only.
    if(u.hash && !(u.hostname==="premieros-sage.vercel.app" && u.hash==="#/login")) return null;
    u.hash="";
    if(!Object.prototype.hasOwnProperty.call(allowlisted,u.hostname))return null;
    const check=allowlisted[u.hostname as Host] as (path:string)=>boolean;
    return check(u.pathname)?u:null;
  }catch{return null;}
}
function decodeEntities(text:string){
  return text.replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#\d+);/gi,(raw,name:string)=>{
    const fixed:Record<string,string>={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ", "#39":"'"};
    if(name[0]==="#" && name!=="#39"){
      const n=Number(name.slice(1));return Number.isInteger(n)&&n>31&&n<0x110000?String.fromCodePoint(n):raw;
    }
    return fixed[name.toLowerCase()]||raw;
  });
}
export async function inspectPublicPage(prompt:string):Promise<PublicPageResult|null>{
  const candidates=Array.from(prompt.matchAll(/https:\/\/[^\s<>"'\u060c\u061b\)\]]+/gi))
    .map(m=>m[0].replace(/[.,،؛!?]+$/,""));
  const u=candidates.map(safeURL).find(Boolean);
  if(!u)return null;
  const displayUrl=u.toString();
  try{
    const response=await fetch(displayUrl,{
      method:"GET",redirect:"manual",credentials:"omit",
      headers:{Accept:"text/html,text/plain"},
      signal:AbortSignal.timeout(5500),cache:"no-store"
    });
    const length=Number(response.headers.get("content-length")||0);
    const mime=response.headers.get("content-type")||"";
    if(!response.ok||length>350000||!/^text\/(?:html|plain)/.test(mime)){
      return {url:displayUrl,title:"",text:"",fetched:false,note:"الموقع لا يسمح بالقراءة النصية العامة أو يعيد توجيهًا/محتوى غير مدعوم."};
    }
    const html=await response.text();
    if(html.length>350000)return {url:displayUrl,title:"",text:"",fetched:false,note:"حجم الصفحة أكبر من الحد المسموح."};
    const title=decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").replace(/\s+/g," ").slice(0,180);
    const body=html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi," ")
      .replace(/<!--[^]*?-->/g," ")
      .replace(/<[^>]+>/g," ");
    const text=decodeEntities(body).replace(/[\t\r ]+/g," ").replace(/\n\s*\n/g,"\n").trim().slice(0,5500);
    return {url:displayUrl,title,text,fetched:true,
      note:"قراءة HTML عامة فقط؛ لا جافاسكريبت أو دخول أو ضغط أزرار، وقد لا تظهر بيانات تطبيقات SPA."};
  }catch{
    return {url:displayUrl,title:"",text:"",fetched:false,note:"تعذر الوصول للصفحة العامة من السيرفر."};
  }
}
