"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {getSupabase} from "@/lib/supabase-browser";
import {currentSession} from "@/lib/auth-session";

type Project={id:string;name:string;slug:string;instructions:string};
type Doc={id:string;title:string;created_at:string};
type Widget={id:string;public_key:string;allowed_origin:string;enabled:boolean};
type Notice={kind:"success"|"error";text:string};

export default function SupportAdmin(){
 const db=getSupabase();
 const [projects,setProjects]=useState<Project[]>([]);
 const [chosen,setChosen]=useState("");
 const [name,setName]=useState(""),[slug,setSlug]=useState("");
 const [instructions,setInstructions]=useState("");
 const [docs,setDocs]=useState<Doc[]>([]),[widgets,setWidgets]=useState<Widget[]>([]);
 const [title,setTitle]=useState(""),[content,setContent]=useState("");
 const [question,setQuestion]=useState(""),[answer,setAnswer]=useState("");
 const [sources,setSources]=useState<Array<{id:string;title:string}>>([]);
 const [origin,setOrigin]=useState("");
 const [notice,setNotice]=useState<Notice|null>(null);
 const [busy,setBusy]=useState(false);
 const [creating,setCreating]=useState(false);
 const [copiedKey,setCopiedKey]=useState("");
 async function copyEmbed(snippet:string,key:string){
  try{await navigator.clipboard.writeText(snippet);setCopiedKey(key);setNotice({kind:"success",text:"تم نسخ كود الربط. الصقه قبل إغلاق </body> في موقعك."})}
  catch{setNotice({kind:"error",text:"تعذر النسخ تلقائيًا. حدّد الكود وانسخه يدويًا."})}
 }
 const [loading,setLoading]=useState(true);
 const project=projects.find(p=>p.id===chosen);

 async function request(path:string,method="GET",body?:unknown){
  if(!db)throw new Error("اتصال قاعدة البيانات غير متاح.");
  const session=await currentSession(db);
  if(!session)throw new Error("سجّل الدخول إلى AGENT أولًا.");
  const res=await fetch(path,{method,cache:"no-store",
   headers:{Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},
   body:body?JSON.stringify(body):undefined});
  const data=await res.json();
  if(!res.ok)throw new Error((data.error||"تعذّر تنفيذ العملية.")+(data.code&&data.code!=="UNKNOWN"?" ("+data.code+")":""));
  return data;
 }
 async function loadProjects(){
  const data=await request("/api/support/projects");
  const list=(data.projects||[]) as Project[];
  setProjects(list);
  setChosen(prev=>list.some(p=>p.id===prev)?prev:list[0]?.id||"");
  return list;
 }
 async function refresh(){
  setLoading(true);
  try{await loadProjects();setNotice(null)}
  catch(e){setNotice({kind:"error",text:e instanceof Error?e.message:String(e)})}
  finally{setLoading(false)}
 }
 useEffect(()=>{if(db)void refresh();},[db]);
 useEffect(()=>{
  if(!chosen){setDocs([]);setWidgets([]);setInstructions("");return;}
  let cancelled=false;
  setInstructions(project?.instructions||"");
  setAnswer("");setSources([]);
  void Promise.all([
   request("/api/support/documents?projectId="+encodeURIComponent(chosen)),
   request("/api/support/widgets?projectId="+encodeURIComponent(chosen))
  ]).then(([d,w])=>{
   if(!cancelled){setDocs(d.documents||[]);setWidgets(w.widgets||[])}
  }).catch(e=>{
   if(!cancelled)setNotice({kind:"error",text:e instanceof Error?e.message:String(e)});
  });
  return()=>{cancelled=true};
 },[chosen,projects]);
 async function act(fn:()=>Promise<void>,success="تم الحفظ بنجاح."){
  setBusy(true);setNotice(null);
  try{await fn();setNotice({kind:"success",text:success})}
  catch(e){setNotice({kind:"error",text:e instanceof Error?e.message:String(e)})}
  finally{setBusy(false)}
 }
 const inputStyle={width:"100%",padding:"12px 14px",border:"1px solid #cbdde2",borderRadius:12,background:"#fff",color:"#19353f"} as const;
 const smallStyle={fontSize:12,color:"#668793"} as const;
 const buttonStyle={padding:"10px 16px",border:0,borderRadius:12,background:"#0b758b",color:"#fff",cursor:"pointer",fontWeight:700} as const;
 const secondary={...buttonStyle,background:"#e9f4f7",color:"#0b5f76",border:"1px solid #cbdde2"} as const;
 return <main className="support-admin-theme support-simple" dir="rtl" style={{maxWidth:1020,margin:"18px auto",padding:20,lineHeight:1.7}}>
  <header className="support-simple-header">
   <div>
    <h1 style={{margin:"0 0 5px"}}>خدمة العملاء</h1>
    <p style={{margin:0}}>اختر المشروع، أضف معلوماته، ثم جرّب المساعد.</p>
   </div>
   <Link href="/support/customer" target="_blank" className="support-customer-link">معاينة واجهة العملاء ↗</Link>
  </header>
  {notice&&<div role={notice.kind==="error"?"alert":"status"}
    className={"support-simple-alert "+notice.kind}>
    <span>{notice.text}</span>
    {notice.kind==="error"&&<button type="button" onClick={()=>void refresh()} disabled={busy}>إعادة المحاولة</button>}
   </div>}

  <section className="support-simple-card">
   <div className="support-simple-head">
    <h2>1. المشروع</h2>
    <button style={secondary} onClick={()=>setCreating(v=>!v)} type="button">{creating?"إلغاء":"إضافة مشروع جديد"}</button>
   </div>
   <select aria-label="اختر مشروعًا" style={inputStyle} value={chosen} disabled={loading||busy}
    onChange={e=>setChosen(e.target.value)}>
    <option value="">{loading?"جارٍ تحميل المشاريع…":"اختر مشروعًا"}</option>
    {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
   </select>
   {creating&&<div className="support-simple-grid">
    <input aria-label="اسم المشروع" style={inputStyle} value={name} placeholder="اسم المشروع" onChange={e=>setName(e.target.value)}/>
    <input aria-label="رمز المشروع" style={inputStyle} value={slug} placeholder="رمز بالإنجليزية مثل premier" onChange={e=>setSlug(e.target.value)}/>
    <button style={buttonStyle} disabled={busy||!name.trim()||!slug.trim()} onClick={()=>void act(async()=>{
     const data=await request("/api/support/projects","POST",{name,slug});
     await loadProjects();
     if(data.project?.id)setChosen(data.project.id);
     setName("");setSlug("");setCreating(false);
    },"تم إنشاء المشروع.")}>إنشاء المشروع</button>
   </div>}
  </section>

  {project&&<>
   <section className="support-simple-card">
    <h2>2. معرفة المساعد</h2>
    <p style={smallStyle}>أضف الأسئلة الشائعة والأسعار والسياسات الخاصة بهذا المشروع فقط.</p>
    <label htmlFor="support-instructions">طريقة رد المساعد</label>
    <textarea id="support-instructions" style={inputStyle} rows={3} value={instructions} onChange={e=>setInstructions(e.target.value)}/>
    <button style={secondary} disabled={busy||!instructions.trim()} onClick={()=>void act(async()=>{
     await request("/api/support/projects","PATCH",{projectId:chosen,instructions});
     setProjects(p=>p.map(x=>x.id===chosen?{...x,instructions}:x));
    })}>حفظ التعليمات</button>
    <div className="support-simple-divider"/>
    <h3>إضافة معلومات</h3>
    <input style={inputStyle} value={title} placeholder="عنوان الملف أو المعلومات" aria-label="عنوان المعلومات" onChange={e=>setTitle(e.target.value)}/>
    <input type="file" aria-label="رفع ملف نصي" accept=".txt,.md,.csv,.json" onChange={async e=>{
     const file=e.target.files?.[0];if(!file)return;
     if(file.size>200000){setNotice({kind:"error",text:"الملف أكبر من الحد المسموح (200 كيلوبايت)."});return;}
     setTitle(file.name);setContent(await file.text());
    }}/>
    <textarea style={inputStyle} rows={5} value={content} onChange={e=>setContent(e.target.value)} placeholder="الصق معلومات المشروع هنا أو اختر ملفًا نصيًا"/>
    <button style={buttonStyle} disabled={busy||!title.trim()||!content.trim()} onClick={()=>void act(async()=>{
     await request("/api/support/documents","POST",{projectId:chosen,title,content});
     setTitle("");setContent("");
     const d=await request("/api/support/documents?projectId="+chosen);
     setDocs(d.documents||[]);
    })}>حفظ المعلومات</button>
    {docs.length>0&&<div className="support-simple-docs">
     {docs.map(d=><div key={d.id}><span>{d.title}</span><button type="button" disabled={busy}
      onClick={()=>void act(async()=>{
       await request("/api/support/documents?projectId="+chosen+"&id="+d.id,"DELETE");
       setDocs(old=>old.filter(x=>x.id!==d.id));
      },"تم حذف الملف.")}>حذف</button></div>)}
    </div>}
   </section>

   <section className="support-simple-card">
    <h2>3. جرّب الرد</h2>
    <textarea style={inputStyle} rows={3} value={question} onChange={e=>setQuestion(e.target.value)}
     placeholder="اسأل كما يسأل العميل"/>
    <button style={buttonStyle} disabled={busy||question.trim().length<3} onClick={()=>void act(async()=>{
     const result=await request("/api/support/preview","POST",{projectId:chosen,question});
     setAnswer(result.answer||"");setSources(result.sources||[]);
    },"ظهرت نتيجة الاختبار أدناه.")}>اختبار المساعد</button>
    {answer&&<div className="support-simple-answer"><strong>الرد</strong><p>{answer}</p>
     {sources.length>0&&<small>المصادر: {sources.map(s=>s.title).join("، ")}</small>}
    </div>}
   </section>

   <section className="support-simple-card">
    <h2>4. أضف الشات إلى أي موقع</h2>
    <p style={smallStyle}>يعمل على WordPress وShopify ومواقع HTML وReact وأي استضافة تسمح بإضافة JavaScript. لا يحتاج المشروع الآخر إلى Vercel أو Supabase أو مفتاح ذكاء اصطناعي.</p>
    <p style={smallStyle}>الطريقة: أضف رابط الموقع هنا ← انسخ الكود ← الصقه مرة واحدة قبل إغلاق <code dir="ltr">&lt;/body&gt;</code> في الموقع. إعداد الذكاء الاصطناعي يتم مرة واحدة داخل AGENT.</p>
    <div className="support-simple-grid">
     <input style={inputStyle} aria-label="رابط موقع العميل" value={origin} placeholder="https://example.com"
      onChange={e=>setOrigin(e.target.value)}/>
     <button style={buttonStyle} disabled={busy||!origin.trim()} onClick={()=>void act(async()=>{
      await request("/api/support/widgets","POST",{projectId:chosen,origin});
      setOrigin("");
      const w=await request("/api/support/widgets?projectId="+chosen);
      setWidgets(w.widgets||[]);
     })}>إضافة موقع</button>
    </div>
    {widgets.map(w=><div className="support-simple-site" key={w.id}>
     <strong>{w.allowed_origin}</strong>
     <span style={smallStyle}>المفتاح العام: <code>{w.public_key}</code></span>
     <textarea readOnly aria-label={"كود ربط "+w.allowed_origin} onFocus={e=>e.currentTarget.select()} style={{...inputStyle,direction:"ltr",fontSize:12,fontFamily:"monospace"}} rows={2}
       value={`<script src="${typeof window!=="undefined"?window.location.origin:"https://YOUR-AGENT-HOST"}/support/widget.js" data-widget-key="${w.public_key}" defer></script>`}/>
     <button type="button" style={buttonStyle} onClick={()=>void copyEmbed(`<script src="${window.location.origin}/support/widget.js" data-widget-key="${w.public_key}" defer></script>`,w.public_key)}>
      {copiedKey===w.public_key?"تم نسخ الكود ✓":"نسخ كود الربط"}
     </button>
     <span style={smallStyle}>{w.enabled?"الموقع مفعّل من لوحة AGENT":"الموقع غير مفعّل؛ فعّله بعد تجهيز الشات واختبار الأمان."}</span>
     <button style={secondary} disabled={busy} onClick={()=>void act(async()=>{
      await request("/api/support/widgets","PATCH",{id:w.id,projectId:chosen,enabled:!w.enabled});
      setWidgets(v=>v.map(x=>x.id===w.id?{...x,enabled:!x.enabled}:x));
     })}>{w.enabled?"تعطيل الموقع":"تفعيل الموقع"}</button>
    </div>)}
   </section>
  </>}
 </main>;
}
