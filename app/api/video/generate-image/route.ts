import {NextRequest,NextResponse} from "next/server";
import {generateSelectedImage,resolveAIConfig,AIProviderError} from "@/lib/ai-providers";
import {validateImageGenerationRequest} from "@/lib/agent-video-image-request";

export const runtime="nodejs";
export const maxDuration=60;
// No server keys or project data are exposed to this route, even if configured for chat.
// The user enters their OWN image API key, opts into charges, and triggers one request.
const NO_STORE={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
export async function POST(req:NextRequest){
 const origin=req.headers.get("origin");
 if(!origin||origin!==new URL(req.url).origin)
  return NextResponse.json({error:"INVALID_ORIGIN"},{status:403,headers:NO_STORE});
 const size=Number(req.headers.get("content-length")||0);
 if(size>8500)return NextResponse.json({error:"REQUEST_TOO_LARGE"},{status:413,headers:NO_STORE});
 try{
  const body=await req.json() as unknown;
  const request=validateImageGenerationRequest(body);
  const ai=resolveAIConfig({provider:request.provider,apiKey:request.apiKey,
   keySource:"manual",imageModel:request.model},"image");
  const {image,contentType}=await generateSelectedImage(ai,request.prompt);
  // Vercel Serverless response cap: reject rather than silently truncate.
  if(image.length>4*1024*1024)throw Error("IMAGE_RESPONSE_TOO_LARGE");
  return new NextResponse(new Uint8Array(image),{headers:{...NO_STORE,"Content-Type":contentType}});
 }catch(e){
  const message=e instanceof Error?e.message:"IMAGE_GENERATION_FAILED";
  const code=e instanceof AIProviderError?e.code:message;
  const status=code==="IMAGE_CONSENT_REQUIRED"?403:
   code==="INVALID_IMAGE_REQUEST"||code==="AI_MODEL_INVALID"?400:
   code==="AI_QUOTA_EXCEEDED"?429:code==="IMAGE_RESPONSE_TOO_LARGE"?413:
   code==="AI_CREDENTIALS_REJECTED"?401:502;
  return NextResponse.json({error:code},{status,headers:NO_STORE});
 }
}
