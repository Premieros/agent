import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
export const maxDuration=15;
type CommonsInfo={
 url?:unknown;thumburl?:unknown;descriptionurl?:unknown;mime?:unknown;
 extmetadata?:Record<string,{value?:unknown}>;
};
type CommonsPage={title?:unknown;index?:number;imageinfo?:CommonsInfo[]};
function allowThumb(value:unknown):value is string{
 if(typeof value!=="string"||value.length>1000)return false;
 try{
  const u=new URL(value);
  return u.protocol==="https:"&&u.hostname==="upload.wikimedia.org"&&
   u.pathname.startsWith("/wikipedia/commons/thumb/")&&
   /\.(jpe?g|png|webp)$/i.test(u.pathname)&&!u.search&&!u.hash;
 }catch{return false;}
}
function clean(value:unknown,max=200){
 return typeof value==="string"?value.replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim().slice(0,max):"";
}
/** Wikimedia Commons results can be differently licensed; include only
 * attribution-friendly public domain, CC0, CC-BY, and CC-BY-SA images. */
export function allowedCommonsLicense(value:string){
 const name=value.toUpperCase().replace(/\s+/g," ").trim();
 return /^CC0(?:\s|$)/.test(name)||/PUBLIC DOMAIN|PUBLIC-DOMAIN|PD-OLD|PD-US|PD-SELF/.test(name)||
  /^CC BY(?:-SA)?(?:\s|$)/.test(name);
}
export async function GET(req:NextRequest){
 const q=(new URL(req.url).searchParams.get("q")||"").trim();
 if(q.length<2||q.length>110||/[<>\\]/.test(q))
  return NextResponse.json({error:"INVALID_IMAGE_QUERY"},{status:400});
 const url=new URL("https://commons.wikimedia.org/w/api.php");
 for(const [k,v] of Object.entries({action:"query",generator:"search",
  gsrsearch:q,gsrnamespace:"6",gsrlimit:"18",prop:"imageinfo",
  iiprop:"url|mime|extmetadata",iiurlwidth:"1280",
  format:"json",formatversion:"2"}))url.searchParams.set(k,v);
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetch(url.toString(),{
   headers:{"Accept":"application/json","User-Agent":"AGENT-VideoStudio/1.0 (project reference: Premieros/agent)"},
   signal:controller.signal,cache:"no-store"
  });
  if(!response.ok)throw Error("IMAGE_PROVIDER_UNAVAILABLE");
  const body=await response.json() as {query?:{pages?:CommonsPage[]}};
  const pages=body.query?.pages||[];
  const metrics={pages:pages.length,
   withInfo:pages.filter(x=>Boolean(x.imageinfo?.[0])).length,
   withThumb:pages.filter(x=>typeof x.imageinfo?.[0]?.thumburl==="string").length,
   withMime:pages.filter(x=>["image/jpeg","image/png","image/webp"].includes(String(x.imageinfo?.[0]?.mime))).length,
   withLicense:pages.filter(x=>Boolean(x.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value)).length,
   allowedLicense:pages.filter(x=>allowedCommonsLicense(
    clean(x.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value,80))).length,
   withSource:pages.filter(x=>typeof x.imageinfo?.[0]?.descriptionurl==="string").length,
   allowedThumb:pages.filter(x=>allowThumb(x.imageinfo?.[0]?.thumburl)).length,
   sourceMatches:pages.filter(x=>String(x.imageinfo?.[0]?.descriptionurl||"").startsWith("https://commons.wikimedia.org/wiki/File:")).length,
   firstThumb:String(pages[0]?.imageinfo?.[0]?.thumburl||"").slice(0,260),
   firstSource:String(pages[0]?.imageinfo?.[0]?.descriptionurl||"").slice(0,200),
   firstLicense:clean(pages[0]?.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value,80)
  };
  const images=pages.sort((a,b)=>(a.index||0)-(b.index||0)).flatMap(p=>{
   const info=p.imageinfo?.[0],meta=info?.extmetadata||{};
   const thumb=info?.thumburl;
   const license=clean(meta.LicenseShortName?.value,80);
   if(!allowThumb(thumb)||!allowedCommonsLicense(license)||
    !["image/jpeg","image/png","image/webp"].includes(String(info?.mime)))return [];
   const source=info?.descriptionurl;
   const src=typeof source==="string"&&source.startsWith("https://commons.wikimedia.org/wiki/File:")?source:"";
   if(!src)return [];
   return [{title:clean(p.title,130).replace(/^File:/,""),imageUrl:thumb,
    sourceUrl:src,license,author:clean(meta.Artist?.value,160)||"Wikimedia Commons",
    credit:clean(meta.Credit?.value,220)}];
  }).slice(0,8);
  return NextResponse.json({query:q,images,diagnostic:metrics},{
   headers:{"Cache-Control":"public, s-maxage=3600, stale-while-revalidate=86400"}
  });
 }catch{
  return NextResponse.json({query:q,images:[],warning:"IMAGE_PROVIDER_UNAVAILABLE"},
   {status:503,headers:{"Cache-Control":"no-store"}});
 }finally{clearTimeout(timeout);}
}
