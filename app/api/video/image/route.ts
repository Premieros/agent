import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
export const maxDuration=20;
const MAX_IMAGE_BYTES=8*1024*1024;
export function safeCommonsImageUrl(value:unknown):string|null{
 if(typeof value!=="string"||value.length>1400)return null;
 try{
  const u=new URL(value);
  if(u.protocol!=="https:"||u.hostname!=="upload.wikimedia.org"||u.hash||
   /%2f|%5c|%2e%2e/i.test(u.pathname))return null;
  const parts=u.pathname.split("/").filter(Boolean);
  if(parts[0]!=="wikipedia"||parts[1]!=="commons")return null;
  const thumb=parts[2]==="thumb",offset=thumb?3:2;
  if(parts.length!==offset+(thumb?4:3)||
   !/^[0-9a-f]$/i.test(parts[offset])||
   !/^[0-9a-f]{2}$/i.test(parts[offset+1])||
   !/\.(jpe?g|png|webp)$/i.test(parts[parts.length-1]))
   return null;
  // Wikimedia may add analytics/query parameters to "unscaled" thumbs.
  // Strip all query parameters before forwarding to the image proxy.
  return u.origin+u.pathname;
 }catch{return null;}
}
export function safeCommonsImage(value:string){return safeCommonsImageUrl(value)!==null;}
export async function GET(req:NextRequest){
 const src=new URL(req.url).searchParams.get("src")||"";
 const safeSrc=safeCommonsImageUrl(src);
 if(!safeSrc)return new NextResponse(null,{status:400});
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const res=await fetch(safeSrc,{signal:controller.signal,redirect:"error",cache:"force-cache"});
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
