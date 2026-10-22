import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
export const maxDuration=20;
const MAX_IMAGE_BYTES=8*1024*1024;
export function safeCommonsImage(value:string){
 if(!value||value.length>1100)return false;
 try{
  const url=new URL(value);
  return url.protocol==="https:"&&url.hostname==="upload.wikimedia.org"&&
   url.pathname.startsWith("/wikipedia/commons/thumb/")&&
   /\.(jpe?g|png|webp)$/i.test(url.pathname)&&!url.search&&!url.hash&&
   !/%2f|%5c|%2e%2e/i.test(url.pathname);
 }catch{return false;}
}
export async function GET(req:NextRequest){
 const src=new URL(req.url).searchParams.get("src")||"";
 if(!safeCommonsImage(src))return new NextResponse(null,{status:400});
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const res=await fetch(src,{signal:controller.signal,redirect:"error",cache:"force-cache"});
  if(!res.ok)return new NextResponse(null,{status:502});
  const type=(res.headers.get("content-type")||"").split(";")[0].toLowerCase();
  if(!["image/jpeg","image/png","image/webp"].includes(type)||
   Number(res.headers.get("content-length")||0)>MAX_IMAGE_BYTES)
   return new NextResponse(null,{status:415});
  const buffer=await res.arrayBuffer();
  if(buffer.byteLength>MAX_IMAGE_BYTES)return new NextResponse(null,{status:413});
  return new NextResponse(buffer,{status:200,headers:{"Content-Type":type,
   "X-Content-Type-Options":"nosniff",
   "Cache-Control":"public, s-maxage=86400, stale-while-revalidate=86400"}});
 }catch{return new NextResponse(null,{status:502});}
 finally{clearTimeout(timeout);}
}
