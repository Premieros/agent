"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {getSupabase} from "@/lib/supabase-browser";
import {currentSession} from "@/lib/auth-session";

type Project={id:string;name:string;slug:string;instructions:string};
type Doc={id:string;title:string;created_at:string};
type Widget={id:string;public_key:string;allowed_origin:string;enabled:boolean};

export default function SupportAdmin(){
 const db=getSupabase();
 const [projects,setProjects]=useState<Project[]>([]),[chosen,setChosen]=useState("");
 const [name,setName]=useState(""),[slug,setSlug]=useState(""),[instructions,setInstructions]=useState("");
 const [title,setTitle]=useState(""),[content,setContent]=useState("");
 const [origin,setOrigin]=useState(""),[docs,setDocs]=useState<Doc[]>([]),[widgets,setWidgets]=useState<Widget[]>([]);
 const [notice,setNotice]=useState<{kind:"success"|"error";text:string}|null>(null),[busy,setBusy]=useState(false);
 const [question,setQuestion]=useState(""),[answer,setAnswer]=useState(""),[sources,setSources]=useState<Array<{id:string;title:string}>>([]);
 async function request(path:string,method="GET",body?:unknown){
  if(!db)throw new Error("Supabase غير مُعد.");
  const session=await currentSession(db);if(!session)throw new Error("سجل الدخول أولًا.");
  const res=await fetch(path,{method,headers:{Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  const data=await res.json();if(!res.ok)throw new Error((data.error||"تعذر تنفيذ العملية.")+(data.code&&data.code!=="UNKNOWN"?" (code: "+data.code+")":""));return data;
 }
 async function load(){
  const data=await request("/api/support/projects");
  setProjects(data.projects);
  return data.projects as Project[];
 }
 async function refresh(){
  try{await load();setNotice(null);}catch(e){setNotice({kind:"error",text:e instanceof Error?e.message:String(e)});}
 }
 useEffect(()=>{if(db)void refresh();},[db]);
 useEffect(()=>{if(!chosen)return;void Promise.all([
  request("/api/support/documents?projectId="+encodeURIComponent(chosen)),
  request("/api/support/widgets?projectId="+encodeURIComponent(chosen))
 ]).then(([d,w])=>{setDocs(d.documents);setWidgets(w.widgets)}).catch(e=>setNotice({kind:"error",text:e instanceof Error?e.message:String(e)}));
 const p=projects.find(p=>p.id===chosen);setInstructions(p?.instructions||"");
 },[chosen,projects]);
 async function act(fn:()=>Promise<void>){setBusy(true);setNotice(null);try{await fn();setNotice({kind:"success",text:"تم حفظ التغيير بنجاح."})}catch(e){setNotice({kind:"error",text:e instanceof Error?e.message:String(e)})}finally{setBusy(false)}}
 const field={width:"100%",padding:10,border:"1px solid #9ca3af",borderRadius:8,background:"transparent",color:"inherit"} as const;
 const button={padding:"10px 16px",borderRadius:8,border:"1px solid #888",cursor:"pointer"} as const;
 return <main className="support-admin-theme" dir="rtl" style={{maxWidth:1100,margin:"30px auto",padding:28,lineHeight:1.7}}>
  <Link href="/assistant">← العودة إلى AGENT</Link>
  <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",marginTop:16}}>
   <Link href="/support/customer" target="_blank" style={{display:"inline-block",padding:"10px 16px",borderRadius:12,background:"#0b758b",color:"#fff",textDecoration:"none"}}>فتح نسخة العملاء التجريبية ↗</Link>
   <span style={{fontSize:13,color:"#6b7280"}}>معاينة شكل الشات وأسئلته دون ربطه ببيانات حقيقية.</span>
  </div>
  <h1>خدمة العملاء متعددة المشاريع</h1>
  <p>كل مشروع له إعداداته ومصادر معرفته المستقلة. الربط العام والرد الآلي لا يُفعّلان قبل اكتمال الاختبارات الأمنية ونشر واجهة العميل.</p>
  {notice&&<div role={notice.kind==="error"?"alert":"status"} style={{padding:16,border:notice.kind==="error"?"1px solid #dfb5aa":"1px solid #a3d9ce",background:notice.kind==="error"?"#fff6f3":"#effaf6",borderRadius:13,color:notice.kind==="error"?"#853f30":"#136c5a",display:"grid",gap:10}}>
   <strong>{notice.kind==="error"?"تعذر تنفيذ العملية":"تمت العملية بنجاح"}</strong><span>{notice.text}</span>
   {notice.kind==="error"&&<button type="button" disabled={busy} onClick={()=>void refresh()} style={{width:"fit-content",padding:"8px 15px",borderRadius:10,border:"1px solid #b77b68",background:"#fff",color:"#853f30"}}>إعادة محاولة التحميل</button>}
  </div>}
  <section style={{display:"grid",gap:10,margin:"24px 0"}}>
   <h2>إضافة مشروع</h2><input style={field} placeholder="اسم المشروع" value={name} onChange={e=>setName(e.target.value)}/>
   <input style={field} placeholder="رمز المشروع مثل premier" value={slug} onChange={e=>setSlug(e.target.value)}/>
   <button style={button} disabled={busy} onClick={()=>void act(async()=>{const created=await request("/api/support/projects","POST",{name,slug});setName("");setSlug("");await load();if(created.project?.id)setChosen(created.project.id)})}>إضافة المشروع</button>
  </section>
  <section style={{display:"grid",gap:12}}>
   <h2>إدارة المشروع</h2>
   <select style={field} value={chosen} onChange={e=>setChosen(e.target.value)}><option value="">اختر مشروعًا</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
   {chosen&&<>
    <label>تعليمات المساعد</label>
    <textarea style={field} rows={5} value={instructions} onChange={e=>setInstructions(e.target.value)}/>
    <button style={button} disabled={busy} onClick={()=>void act(async()=>{await request("/api/support/projects","PATCH",{projectId:chosen,instructions});await load()})}>حفظ التعليمات</button>
    <h3>إضافة ملف معرفة نصي</h3>
    <input style={field} placeholder="عنوان الملف" value={title} onChange={e=>setTitle(e.target.value)}/>
    <input type="file" accept=".txt,.md,.csv,.json" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>200000){setNotice({kind:"error",text:"الملف يتجاوز الحد الحالي (200 ألف حرف)."});return;}setTitle(f.name);setContent(await f.text())}}/>
    <textarea style={field} rows={8} value={content} onChange={e=>setContent(e.target.value)} placeholder="محتوى المعرفة"/>
    <button style={button} disabled={busy} onClick={()=>void act(async()=>{await request("/api/support/documents","POST",{projectId:chosen,title,content});setTitle("");setContent("");const d=await request("/api/support/documents?projectId="+chosen);setDocs(d.documents)})}>حفظ المستند</button>
    <ul>{docs.map(d=><li key={d.id}>{d.title} <button disabled={busy} onClick={()=>void act(async()=>{await request("/api/support/documents?projectId="+chosen+"&id="+d.id,"DELETE");setDocs(v=>v.filter(x=>x.id!==d.id))})}>حذف</button></li>)}</ul>
    <h3>تجربة رد المساعد قبل النشر</h3>
    <p>هذه تجربة خاصة بالمدير، لا ترسل رسالة إلى عميل ولا تحفظ المحادثة. تستخدم المستندات المعتمدة لهذا المشروع فقط.</p>
    <textarea style={field} rows={3} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="اكتب سؤال العميل لاختبار المساعد"/>
    <button style={button} disabled={busy||question.trim().length<3} onClick={()=>void act(async()=>{const result=await request("/api/support/preview","POST",{projectId:chosen,question});setAnswer(result.answer);setSources(result.sources||[])})}>تجربة الرد الذكي</button>
    {answer&&<div style={{padding:16,border:"1px solid #888",borderRadius:8,whiteSpace:"pre-wrap"}}><strong>رد المساعد</strong><p>{answer}</p>{sources.length>0&&<p>المصادر: {sources.map(x=>x.title).join("، ")}</p>}</div>}
    <h3>مواقع المشروع المسموحة</h3>
    <input style={field} placeholder="https://example.com" value={origin} onChange={e=>setOrigin(e.target.value)}/>
    <button style={button} disabled={busy} onClick={()=>void act(async()=>{await request("/api/support/widgets","POST",{projectId:chosen,origin});setOrigin("");const w=await request("/api/support/widgets?projectId="+chosen);setWidgets(w.widgets)})}>إنشاء مفتاح موقع</button>
    {widgets.map(w=><div key={w.id} style={{padding:10,border:"1px solid #888",borderRadius:8,overflowWrap:"anywhere"}}>
     <b>{w.allowed_origin}</b><p>Widget Key: <code>{w.public_key}</code></p>
     <p style={{fontSize:13}}>لإضافة الشات إلى موقعك المسموح به، انسخ الكود التالي وضعه قبل إغلاق صفحة الموقع:</p>
     <textarea readOnly rows={2} style={{...field,fontFamily:"monospace",fontSize:12,direction:"ltr"}} value={`<script src="${typeof window!=="undefined"?window.location.origin:"https://YOUR-AGENT-HOST"}/support/widget.js" data-widget-key="${w.public_key}" defer></script>`}/>
     <p style={{fontSize:12,color:"#64748b"}}>لن يعمل الشات العام قبل تطبيق ترحيلات قاعدة البيانات وتفعيل مفاتيح الخادم وإجراء اختبارات الأمان.</p>
     <button disabled={busy} onClick={()=>void act(async()=>{await request("/api/support/widgets","PATCH",{id:w.id,projectId:chosen,enabled:!w.enabled});setWidgets(a=>a.map(x=>x.id===w.id?{...x,enabled:!x.enabled}:x))})}>{w.enabled?"تعطيل":"تفعيل"}</button>
    </div>)}
   </>}
  </section>
 </main>;
}
