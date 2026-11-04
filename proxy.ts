import {NextRequest,NextResponse} from "next/server";

/**
 * A dedicated public alias for the customer widget API. All AGENT workspace
 * routes remain unavailable on this alias; administrative pages continue to
 * use the separately Vercel-protected preview hostname.
 */
const publicHost="premieros-agent-support-public.vercel.app";
const openRoutes=new Set([
 "/api/support/public/sessions",
 "/api/support/public/messages",
 "/api/support/premier-inbox",
 "/support/widget.js"
]);

export function proxy(request:NextRequest){
 const host=request.headers.get("host")?.split(":")[0]?.toLowerCase();
 if(host!==publicHost)return NextResponse.next();
 const path=request.nextUrl.pathname.replace(/\/$/,"")||"/";
 if(!openRoutes.has(path))
  return new NextResponse("Not found",{status:404,headers:{"Cache-Control":"no-store"}});
 return NextResponse.next();
}

export const config={matcher:"/((?!_next/static|_next/image|favicon.ico).*)"};
