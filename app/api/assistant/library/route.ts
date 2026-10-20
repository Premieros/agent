import {NextRequest,NextResponse} from "next/server";
import {requireAgentSession,errorResponse,type AgentSession} from "@/lib/agent-server";

export const runtime="nodejs";
const BUCKET="agent-library";
const MAX=8*1024*1024;
const noStore={"Cache-Control":"no-store"};
const respond=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:noStore});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mimeKinds:Record<string,{ext:string;kind:string}>={
  "text/plain":{ext:"txt",kind:"document"},
  "text/markdown":{ext:"md",kind:"document"},
  "text/csv":{ext:"csv",kind:"document"},
  "application/json":{ext:"json",kind:"document"},
  "application/pdf":{ext:"pdf",kind:"document"},
  "image/png":{ext:"png",kind:"image"},
  "image/jpeg":{ext:"jpg",kind:"image"},
  "image/webp":{ext:"webp",kind:"image"},
  "image/gif":{ext:"gif",kind:"image"},
  "audio/mpeg":{ext:"mp3",kind:"audio"},
  "audio/wav":{ext:"wav",kind:"audio"},
  "audio/ogg":{ext:"ogg",kind:"audio"},
  "video/mp4":{ext:"mp4",kind:"video"},
  "video/webm":{ext:"webm",kind:"video"}
};
const extensionMap:Record<string,string>={txt:"text/plain",md:"text/markdown",
  csv:"text/csv",json:"application/json",pdf:"application/pdf",png:"image/png",
  jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",gif:"image/gif",
  mp3:"audio/mpeg",wav:"audio/wav",ogg:"audio/ogg",mp4:"video/mp4",webm:"video/webm"};
function safeName(name:string){
  return name.replace(/[^\p{L}\p{N}._\s-]/gu,"_").replace(/\s+/g," ").slice(0,150).trim()||"file";
}
async function ownThread(s:AgentSession,id:unknown){
  if(typeof id!=="string"||!uuid.test(id))return false;
  const q=await s.db.from("assistant_threads").select("id").eq("id",id)
    .eq("organization_id",s.organizationId).eq("user_id",s.userId).maybeSingle();
  if(q.error)throw q.error;
  return Boolean(q.data);
}
async function persistFile(s:AgentSession,data:{
  name:string;bytes:Uint8Array;mime:string;threadId:string|null;source:"upload"|"assistant";
}){
  const supported=mimeKinds[data.mime];
  if(!supported||data.bytes.length<1||data.bytes.length>MAX)
    return {error:"هذا النوع من الملفات غير مدعوم أو يزيد عن 8 ميجابايت.",status:400};
  const original=safeName(data.name);
  const finalName=original.toLowerCase().endsWith("."+supported.ext)
    ?original:original+"."+supported.ext;
  const path=s.organizationId+"/"+s.userId+"/"+crypto.randomUUID()+"."+supported.ext;
  const storage=s.db.storage.from(BUCKET);
  const upload=await storage.upload(path,data.bytes,{
    contentType:data.mime,cacheControl:"3600",upsert:false
  });
  if(upload.error)return {error:"تعذر رفع الملف إلى المكتبة الخاصة.",status:502};
  const row=await s.db.from("assistant_library_items").insert({
    organization_id:s.organizationId,user_id:s.userId,thread_id:data.threadId,
    title:finalName.replace(/\.[^.]+$/,"").slice(0,180),
    file_name:finalName,storage_path:path,mime_type:data.mime,
    kind:supported.kind,size_bytes:data.bytes.length,source:data.source
  }).select("id,title,kind").single();
  if(row.error){
    await storage.remove([path]);
    return {error:"تعذر حفظ بيانات الملف. لم تتم إضافته إلى المكتبة.",status:502};
  }
  return {ok:true,item:row.data,status:201};
}
export async function GET(req:NextRequest){
  try{
    const s=await requireAgentSession(req);
    const q=await s.db.from("assistant_library_items")
      .select("id,title,file_name,mime_type,kind,source,size_bytes,thread_id,storage_path,created_at")
      .eq("organization_id",s.organizationId).eq("user_id",s.userId)
      .order("created_at",{ascending:false}).limit(100);
    if(q.error)throw q.error;
    const results=await Promise.all((q.data||[]).map(async item=>{
      const signed=await s.db.storage.from(BUCKET).createSignedUrl(item.storage_path,300);
      const {storage_path:ignored,...visible}=item;
      void ignored;
      return {...visible,url:signed.error?null:signed.data.signedUrl};
    }));
    return respond({items:results,private:true,maxSizeBytes:MAX});
  }catch(e){const v=errorResponse(e);return respond({error:v.message},v.status);}
}
export async function POST(req:NextRequest){
  try{
    const s=await requireAgentSession(req);
    const type=req.headers.get("content-type")||"";
    if(type.includes("multipart/form-data")){
      const length=Number(req.headers.get("content-length")||0);
      if(length>MAX+150000)return respond({error:"حجم الملف أكبر من الحد المسموح (8 ميجابايت)."},413);
      const body=await req.formData();
      const file=body.get("file");
      const threadId=body.get("threadId");
      if(!(file instanceof File)||file.size<1||file.size>MAX)
        return respond({error:"اختر ملفًا صالحًا لا يتجاوز 8 ميجابايت."},400);
      const extension=file.name.split(".").at(-1)?.toLowerCase()||"";
      const mime=extensionMap[extension];
      if(!mime||!mimeKinds[mime]||(
        file.type&&file.type!=="application/octet-stream"&&
        file.type!=="text/plain"&&file.type!==mime&&
        !(extension==="md"&&file.type==="text/markdown")
      ))return respond({error:"امتداد الملف أو نوعه غير مدعوم."},400);
      const validThread=typeof threadId==="string"&&await ownThread(s,threadId);
      if(threadId&&threadId!==""&&!validThread)
        return respond({error:"المحادثة المرتبطة بالملف غير صحيحة."},404);
      const bytes=new Uint8Array(await file.arrayBuffer());
      const result=await persistFile(s,{name:file.name,bytes,mime,
        threadId:validThread?String(threadId):null,source:"upload"});
      return respond(result,typeof result.status==="number"?result.status:500);
    }
    const data=await req.json() as {action?:unknown;threadId?:unknown;messageId?:unknown};
    if(data.action!=="save_message"||!await ownThread(s,data.threadId)||
      typeof data.messageId!=="string"||!uuid.test(data.messageId))
      return respond({error:"حدد رسالة محفوظة من محادثاتك."},400);
    const m=await s.db.from("assistant_messages")
      .select("id,content,role").eq("id",data.messageId)
      .eq("thread_id",data.threadId).eq("organization_id",s.organizationId).maybeSingle();
    if(m.error)throw m.error;
    if(!m.data||m.data.role!=="assistant")return respond({error:"الرسالة غير متاحة."},404);
    const text=String(m.data.content||"").trim();
    if(!text)return respond({error:"لا يوجد محتوى لحفظه."},400);
    const bytes=new TextEncoder().encode(text);
    const title=text.split("\n").find(line=>line.trim())?.replace(/^#+\s*/,"").slice(0,60)||"نتيجة AGENT";
    const result=await persistFile(s,{name:title+".md",bytes,mime:"text/markdown",
      threadId:String(data.threadId),source:"assistant"});
    return respond(result,typeof result.status==="number"?result.status:500);
  }catch(e){const v=errorResponse(e);return respond({error:v.message},v.status);}
}
export async function DELETE(req:NextRequest){
  try{
    const s=await requireAgentSession(req);
    const id=new URL(req.url).searchParams.get("id");
    if(!id||!uuid.test(id))return respond({error:"ملف غير صالح."},400);
    const row=await s.db.from("assistant_library_items").select("storage_path")
      .eq("id",id).eq("user_id",s.userId).eq("organization_id",s.organizationId).maybeSingle();
    if(row.error)throw row.error;
    if(!row.data)return respond({error:"الملف غير موجود."},404);
    const remove=await s.db.storage.from(BUCKET).remove([row.data.storage_path]);
    if(remove.error)return respond({error:"تعذر حذف الملف من التخزين."},502);
    const deleted=await s.db.from("assistant_library_items").delete().eq("id",id)
      .eq("organization_id",s.organizationId).eq("user_id",s.userId);
    if(deleted.error)return respond({error:"حُذف الملف ولكن تعذّر تحديث فهرس المكتبة."},502);
    return respond({ok:true});
  }catch(e){const v=errorResponse(e);return respond({error:v.message},v.status);}
}
