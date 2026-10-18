"use client";

import {useCallback,useEffect,useState} from "react";
import {BookMarked,Check,Plus,Trash2} from "lucide-react";
import {getSupabase} from "@/lib/supabase-browser";
import {currentSession} from "@/lib/auth-session";

type Memory={id:string;scope:"global"|"thread";subject:string;content:string;
  status:"suggested"|"active";source:"user"|"automatic";category:string};
type Skill={id:string;title:string;description:string;instructions:string;
  phrases:string[];base_skill:string;status:"suggested"|"active"|"disabled";
  source:"automatic"|"user"};
const statuses:Record<string,string>={
  suggested:"بانتظار الموافقة",active:"نشط",disabled:"معطّل"
};
export default function AssistantLearningPanel({threadId,refreshKey,initialOpen=false}:{
  threadId:string;refreshKey:number;initialOpen?:boolean
}){
  const db=getSupabase();
  const [open,setOpen]=useState(initialOpen);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [memories,setMemories]=useState<Memory[]>([]);
  const [skills,setSkills]=useState<Skill[]>([]);
  const [subject,setSubject]=useState("");
  const [content,setContent]=useState("");
  const [threadOnly,setThreadOnly]=useState(false);
  const [showSkillForm,setShowSkillForm]=useState(false);
  const [skillTitle,setSkillTitle]=useState("");
  const [skillPhrase,setSkillPhrase]=useState("");
  const [skillInstruction,setSkillInstruction]=useState("");
  const [baseSkill,setBaseSkill]=useState("general");

  const headers=useCallback(async()=>{
    if(!db)throw new Error("اتصال AGENT غير متاح.");
    const session=await currentSession(db);
    if(!session?.access_token)throw new Error("انتهت الجلسة؛ سجل دخولك مرة أخرى.");
    return {"Content-Type":"application/json",Authorization:"Bearer "+session.access_token};
  },[db]);

  const load=useCallback(async()=>{
    try{
      const res=await fetch("/api/assistant/learning?threadId="+encodeURIComponent(threadId),{
        headers:await headers(),cache:"no-store"
      });
      const data=await res.json() as {
        memories?:Memory[];skills?:Skill[];error?:string
      };
      if(!res.ok)throw new Error(data.error||"تعذر قراءة الذاكرة.");
      setMemories(data.memories||[]);setSkills(data.skills||[]);setError("");
    }catch(e){setError(e instanceof Error?e.message:"تعذر التحميل.");}
  },[headers,threadId]);
  useEffect(()=>{if(open)void load();},[open,load,refreshKey]);

  async function action(kind:string,body:Record<string,unknown>,after?:()=>void){
    if(busy)return;
    setBusy(true);setError("");
    try{
      const res=await fetch("/api/assistant/learning",{
        method:"POST",headers:await headers(),body:JSON.stringify({action:kind,...body})
      });
      const result=await res.json() as {error?:string};
      if(!res.ok)throw new Error(result.error||"تعذر حفظ التغيير.");
      after?.();await load();
    }catch(e){setError(e instanceof Error?e.message:"تعذر إتمام الطلب.");}
    finally{setBusy(false);}
  }
  const pendingMemories=memories.filter(x=>x.status==="suggested");
  const pendingSkills=skills.filter(x=>x.status==="suggested");
  return <details className="assistant-learning" open={open}
    onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary><BookMarked size={15}/> الذاكرة والمهارات
      {(pendingMemories.length+pendingSkills.length)>0&&
        <span className="assistant-learning-count">{pendingMemories.length+pendingSkills.length} للمراجعة</span>}
    </summary>
    <div className="assistant-learning-content">
      {error&&<p className="assistant-learning-error" role="alert">{error}</p>}
      <p className="assistant-learning-hint">
        الذكريات المعتمدة تُستخدم في الردود الجديدة. المهارات المقترحة لا تعمل قبل اعتمادها، ولا تمنح صلاحيات إضافية.
      </p>
      <section>
        <strong>معلومات مقترحة ({pendingMemories.length})</strong>
        {pendingMemories.length===0?<small>لا توجد معلومات تنتظر الموافقة.</small>:
          pendingMemories.map(item=><div key={item.id} className="assistant-learning-item">
            <div><b>{item.subject}</b><p>{item.content}</p></div>
            <button type="button" disabled={busy} onClick={()=>void action("approve_memory",{id:item.id})}>
              <Check size={13}/> اعتماد</button>
            <button type="button" disabled={busy} title="تجاهل المعلومة"
              onClick={()=>void action("delete_memory",{id:item.id})}><Trash2 size={13}/></button>
          </div>)}
      </section>
      <section>
        <strong>الذاكرة المعتمدة ({memories.filter(x=>x.status==="active").length})</strong>
        {memories.filter(x=>x.status==="active").map(item=>
          <div key={item.id} className="assistant-learning-item">
            <div><b>{item.subject}</b><small>{item.scope==="thread"?"المحادثة الحالية":"كل المحادثات"}</small>
              <p>{item.content}</p></div>
            <button type="button" title="حذف المعلومة" disabled={busy}
              onClick={()=>void action("delete_memory",{id:item.id})}><Trash2 size={13}/></button>
          </div>)}
        <form className="assistant-learning-form" onSubmit={e=>{
          e.preventDefault();
          void action("add_memory",{
            subject,content,scope:threadOnly?"thread":"global",threadId
          },()=>{setSubject("");setContent("");});
        }}>
          <input aria-label="عنوان المعلومة" placeholder="عنوان المعلومة أو القرار"
            minLength={3} maxLength={110} required value={subject}
            onChange={e=>setSubject(e.target.value)}/>
          <textarea aria-label="المعلومة" placeholder="معلومة مؤكدة تريد من AGENT تذكرها..."
            minLength={4} maxLength={900} required rows={2} value={content}
            onChange={e=>setContent(e.target.value)}/>
          <div className="assistant-learning-form-actions">
            <label><input type="checkbox" checked={threadOnly} onChange={e=>setThreadOnly(e.target.checked)}/>
              لهذه المحادثة فقط</label>
            <button type="submit" disabled={busy||!subject.trim()||!content.trim()||(threadOnly&&!threadId)}>
              <Plus size={13}/> حفظ المعلومة
            </button>
          </div>
        </form>
      </section>
      <section>
        <strong>المهارات ({skills.length})</strong>
        {skills.length===0?<small>المهارات المتكررة ستظهر هنا كمقترحات للموافقة.</small>:
          skills.map(item=><div key={item.id} className="assistant-learning-item">
            <div><b>{item.title}</b><small>{statuses[item.status]||item.status} · {item.base_skill}</small>
              <p>{item.description||item.instructions}</p>
              <small>تعمل عند ورود: {item.phrases.join("، ")}</small>
            </div>
            {item.status!=="active"&&<button type="button" disabled={busy}
              onClick={()=>void action("approve_skill",{id:item.id})}><Check size={13}/> تفعيل</button>}
            {item.status==="active"&&<button type="button" disabled={busy}
              onClick={()=>void action("disable_skill",{id:item.id})}>تعطيل</button>}
            <button type="button" disabled={busy} title="حذف المهارة"
              onClick={()=>void action("delete_skill",{id:item.id})}><Trash2 size={13}/></button>
          </div>)}
        <button type="button" className="assistant-learning-secondary"
          onClick={()=>setShowSkillForm(v=>!v)}>
          <Plus size={13}/> اقتراح مهارة مخصصة
        </button>
        {showSkillForm&&<form className="assistant-learning-form" onSubmit={e=>{
          e.preventDefault();
          void action("create_skill",{
            title:skillTitle,description:"مهارة مخصصة للمهمة المذكورة.",
            instructions:skillInstruction,phrases:skillPhrase.split("،").map(x=>x.trim()).filter(Boolean),
            baseSkill
          },()=>{setSkillTitle("");setSkillPhrase("");setSkillInstruction("");setShowSkillForm(false);});
        }}>
          <input aria-label="اسم المهارة" value={skillTitle} minLength={3} maxLength={90}
            placeholder="اسم المهارة" required onChange={e=>setSkillTitle(e.target.value)}/>
          <input aria-label="عبارات التفعيل" value={skillPhrase} required
            placeholder="عبارات التفعيل، افصل بينها بـ ،"
            onChange={e=>setSkillPhrase(e.target.value)}/>
          <textarea aria-label="تعليمات المهارة" rows={2} minLength={12} maxLength={1000}
            placeholder="تعليمات واضحة للمهارة (لا تغيّر الصلاحيات)" required
            value={skillInstruction} onChange={e=>setSkillInstruction(e.target.value)}/>
          <select aria-label="التخصص الأساسي" value={baseSkill} onChange={e=>setBaseSkill(e.target.value)}>
            <option value="general">عام</option><option value="analysis">تحليل</option>
            <option value="coding">تطوير</option><option value="planning">تخطيط</option>
            <option value="marketing">تسويق</option><option value="writing">كتابة</option>
            <option value="learning">تعليم</option><option value="translation">ترجمة</option>
          </select>
          <button type="submit" disabled={busy}><Plus size={13}/> حفظ للمراجعة</button>
        </form>}
      </section>
    </div>
  </details>;
}
