"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {ArrowRight,Check,Download,FileText,FileUp,Image as ImageIcon,
  LoaderCircle,Music,RefreshCw,ShieldCheck,Trash2,Video} from "lucide-react";
import {getSupabase} from "@/lib/supabase-browser";
import {currentSession} from "@/lib/auth-session";

type Item={id:string;title:string;file_name:string;mime_type:string;
  kind:"document"|"image"|"audio"|"video"|"other";source:string;
  size_bytes:number;thread_id:string|null;created_at:string;url:string|null};
const supported=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.mp4,.webm";
const categories=[{id:"all",label:"الكل"},{id:"document",label:"المستندات"},
  {id:"image",label:"الصور"},{id:"audio",label:"الصوت"},{id:"video",label:"الفيديو"}];
const icons={document:FileText,image:ImageIcon,audio:Music,video:Video,other:FileText};
export default function AssistantLibrary(){
  const db=getSupabase();
  const [items,setItems]=useState<Item[]>([]);
  const [kind,setKind]=useState("all");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const input=useRef<HTMLInputElement|null>(null);
  const headers=useCallback(async()=>{
    if(!db)throw new Error("اتصال AGENT غير متاح.");
    const session=await currentSession(db);
    if(!session?.access_token)throw new Error("سجّل الدخول أولًا للوصول لمكتبتك.");
    return {Authorization:"Bearer "+session.access_token};
  },[db]);
  const refresh=useCallback(async()=>{
    setBusy(true);setError("");
    try{
      const result=await fetch("/api/assistant/library",{headers:await headers(),cache:"no-store"});
      const value=await result.json() as {items?:Item[];error?:string};
      if(!result.ok)throw new Error(value.error||"تعذّر تحميل المكتبة.");
      setItems(value.items||[]);
    }catch(e){setError(e instanceof Error?e.message:"تعذّر تحميل المكتبة.");}
    finally{setBusy(false);}
  },[headers]);
  useEffect(()=>{void refresh();},[refresh]);
  async function upload(file:File|null){
    if(!file)return;
    if(file.size>8*1024*1024){setError("الحد الأقصى للملف 8 ميجابايت.");return;}
    setBusy(true);setError("");setNotice("");
    try{
      const form=new FormData();form.set("file",file);
      const response=await fetch("/api/assistant/library",{
        method:"POST",headers:await headers(),body:form
      });
      const value=await response.json() as {error?:string;ok?:boolean};
      if(!response.ok||!value.ok)throw new Error(value.error||"تعذّر رفع الملف.");
      setNotice("حُفظ الملف في مكتبتك الخاصة.");await refresh();
    }catch(e){setError(e instanceof Error?e.message:"تعذّر رفع الملف.");}
    finally{setBusy(false);if(input.current)input.current.value="";}
  }
  async function remove(item:Item){
    if(!window.confirm("حذف "+item.file_name+" نهائيًا من مكتبتك؟"))return;
    setBusy(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/assistant/library?id="+encodeURIComponent(item.id),{
        method:"DELETE",headers:await headers()
      });
      const value=await response.json() as {error?:string;ok?:boolean};
      if(!response.ok||!value.ok)throw new Error(value.error||"تعذّر حذف الملف.");
      setNotice("تم حذف الملف.");await refresh();
    }catch(e){setError(e instanceof Error?e.message:"تعذّر الحذف.");}
    finally{setBusy(false);}
  }
  const filtered=kind==="all"?items:items.filter(x=>x.kind===kind);
  return <div className="agent-library" dir="rtl">
    <header className="agent-library-head">
      <div><span>AGENT · ملفات ووسائط</span><h1>المكتبة</h1>
        <p>نتائج المحادثات التي تحفظها، وصورك ومستنداتك ووسائطك في مساحة خاصة بحسابك.</p></div>
      <div className="agent-library-actions">
        <input ref={input} type="file" accept={supported} disabled={busy}
          aria-label="اختيار ملف للمكتبة" onChange={e=>void upload(e.currentTarget.files?.[0]||null)}/>
        <button type="button" onClick={()=>input.current?.click()} disabled={busy}>
          <FileUp size={16}/> إضافة ملف
        </button>
        <button type="button" onClick={()=>void refresh()} disabled={busy} aria-label="تحديث المكتبة">
          <RefreshCw size={16}/>
        </button>
      </div>
    </header>
    <div className="agent-library-tabs" role="group" aria-label="تصفية ملفات المكتبة">
      {categories.map(c=><button type="button" key={c.id} aria-pressed={kind===c.id}
        onClick={()=>setKind(c.id)}>{c.label}</button>)}
    </div>
    {error&&<p className="agent-library-error" role="alert">{error}</p>}
    {notice&&<p className="agent-library-success"><Check size={16}/>{notice}</p>}
    {busy&&<p className="agent-library-loading"><LoaderCircle className="crm-spin" size={16}/> جارٍ تحديث المكتبة...</p>}
    {!busy&&filtered.length===0&&<div className="agent-library-empty">
      <FileText size={32}/><strong>لا توجد ملفات هنا بعد</strong>
      <p>ارفع ملفًا، أو استخدم زر «حفظ في المكتبة» أسفل أي رد في المحادثة.</p>
      <Link href="/assistant">العودة إلى المحادثات <ArrowRight size={15}/></Link>
    </div>}
    <div className="agent-library-grid">
      {filtered.map(item=>{
        const Icon=icons[item.kind]||FileText;
        return <article className="agent-library-file" key={item.id}>
          <div className="agent-library-preview">
            {item.kind==="image"&&item.url?
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt={item.title} loading="lazy"/>:
              item.kind==="audio"&&item.url?<audio src={item.url} controls preload="none"/>:
              item.kind==="video"&&item.url?<video src={item.url} controls preload="metadata"/>:
              <Icon size={31} strokeWidth={1.4}/>}
          </div>
          <div className="agent-library-meta">
            <strong title={item.file_name}>{item.file_name}</strong>
            <small>{item.source==="assistant"?"نتيجة محفوظة من AGENT":"ملف مرفوع"}
              {" · "+(item.size_bytes/1024).toFixed(1)+" كيلوبايت"}</small>
            <small>{new Date(item.created_at).toLocaleDateString("ar-EG")}</small>
            <div className="agent-library-file-actions">
              {item.url&&<a href={item.url} rel="noopener noreferrer" target="_blank">
                <Download size={15}/> فتح الملف
              </a>}
              <button type="button" onClick={()=>void remove(item)} disabled={busy}>
                <Trash2 size={15}/> حذف
              </button>
            </div>
          </div>
        </article>;
      })}
    </div>
    <p className="agent-library-security"><ShieldCheck size={15}/>
      المكتبة خاصة بالمؤسسة والمستخدم، والروابط مؤقتة. لا تُنشأ اتصالات أو اشتراكات مدفوعة عند رفع الملفات.</p>
  </div>;
}
