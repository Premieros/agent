"use client";

import {useEffect,useState,type ReactNode} from "react";
import Link from "next/link";
import {usePathname,useSearchParams} from "next/navigation";
import {
  Bot,BookOpen,ClipboardList,FileImage,Headphones,Home,Inbox,Library,
  Menu,MessagesSquare,Plus,Settings2,UsersRound,PlugZap,Layers3,
  Megaphone,Sparkles,MonitorPlay,X
} from "lucide-react";

type Item={href:string;label:string;icon:typeof Home};
type Group={title:string;items:Item[]};
const groups:Group[]=[
 {title:"الرئيسية والمساعد",items:[
  {href:"/",label:"لوحة التحكم",icon:Home},
  {href:"/assistant",label:"المحادثات الذكية",icon:MessagesSquare},
  {href:"/assistant/library",label:"مكتبة المساعد",icon:Library}
 ]},
 {title:"المبيعات وإدارة العملاء",items:[
  {href:"/crm?view=leads",label:"سجلات العملاء",icon:UsersRound},
  {href:"/crm?view=tasks",label:"مهام المتابعة",icon:ClipboardList},
  {href:"/crm/inbox",label:"صندوق الوارد",icon:Inbox},
  {href:"/crm?view=account",label:"الحساب والصلاحيات",icon:Settings2}
 ]},
 {title:"الوكلاء والتسويق",items:[
  {href:"/studio?section=agents",label:"إدارة الوكلاء",icon:Bot},
  {href:"/studio?section=models",label:"نماذج الذكاء الاصطناعي",icon:Sparkles},
  {href:"/studio?section=pages",label:"صفحات النشاط",icon:Layers3},
  {href:"/studio?section=campaigns",label:"الحملات والمهام",icon:Megaphone},
  {href:"/studio?section=outputs",label:"النتائج والمخرجات",icon:BookOpen},
  {href:"/studio?section=creatives",label:"التصميمات الإبداعية",icon:FileImage}
 ]},
 {title:"خدمة العملاء الذكية",items:[
  {href:"/support",label:"المشاريع وقاعدة المعرفة",icon:Headphones},
  {href:"/support/conversations",label:"محادثات العملاء",icon:MessagesSquare},
  {href:"/support/customer",label:"واجهة العملاء",icon:MonitorPlay},
  {href:"/support/channels",label:"ربط قنوات التواصل",icon:PlugZap}
 ]},
 {title:"الربط والإعدادات",items:[
  {href:"/assistant/integrations",label:"الربط والتكاملات",icon:PlugZap}
 ]}
];

export default function WorkspaceShell({children}:{children:ReactNode}){
 const pathname=usePathname();
 const searchParams=useSearchParams();
 const isWorkspace=pathname==="/"||pathname==="/studio"||pathname==="/assistant"||
   pathname.startsWith("/assistant/")||pathname==="/crm"||pathname.startsWith("/crm/")||
   pathname==="/support"||pathname==="/support/conversations"||pathname==="/support/channels";
 const [mobileOpen,setMobileOpen]=useState(false);
 useEffect(()=>{
  const close=()=>setMobileOpen(false);
  const toggle=()=>setMobileOpen(v=>!v);
  window.addEventListener("agent:close-navigation",close);
  window.addEventListener("agent:toggle-navigation",toggle);
  return()=>{window.removeEventListener("agent:close-navigation",close);
    window.removeEventListener("agent:toggle-navigation",toggle)};
 },[]);
 useEffect(()=>{setMobileOpen(false)},[pathname,searchParams]);
 if(!isWorkspace)return <>{children}</>;
 const selectedHref=pathname+(searchParams.toString()?"?"+searchParams.toString():"");
 const itemSelected=(href:string)=>{
  if(href.includes("?"))return selectedHref===href;
  if(href==="/")return pathname==="/";
  if(pathname==="/assistant"&&href==="/assistant")return true;
  return pathname===href || (href==="/crm?view=leads"&&pathname==="/crm"&&!searchParams.get("view")) ||
   (href==="/studio?section=agents"&&pathname==="/studio"&&!searchParams.get("section"));
 };
 const current=groups.flatMap(g=>g.items).find(i=>itemSelected(i.href));
 const title=current?.label||"AGENT";
 return <div className="workspace-shell agent-chat-first">
  {mobileOpen&&<button type="button" className="workspace-backdrop" aria-label="إغلاق القائمة"
     onClick={()=>setMobileOpen(false)}/>}
  <aside className={"workspace-navigation"+(mobileOpen?" workspace-navigation-open":"")}
   aria-label="أقسام AGENT">
   <div className="workspace-brand">
    <Link href="/" className="workspace-logo" onClick={()=>setMobileOpen(false)}>
     <span className="workspace-brand-symbol">✦</span><strong>AGENT</strong>
    </Link>
    <button type="button" className="workspace-close-mobile" aria-label="إغلاق القائمة"
      onClick={()=>setMobileOpen(false)}><X size={20}/></button>
   </div>
   <Link href="/assistant?new=1" className="workspace-new-chat" onClick={e=>{
    setMobileOpen(false);
    if(pathname==="/assistant"){e.preventDefault();window.dispatchEvent(new Event("agent:new-chat"))}
   }}><Plus size={18}/> محادثة جديدة</Link>
   <nav className="workspace-nav-list agent-all-navigation" aria-label="كل صفحات AGENT">
    {groups.map(group=><section className="agent-navigation-group" key={group.title}
      aria-label={group.title}>
     <h2 className="agent-navigation-heading">{group.title}</h2>
     {group.items.map(item=><Link key={item.href} href={item.href}
       aria-current={itemSelected(item.href)?"page":undefined}
       className={"workspace-nav-link agent-primary-nav"+(itemSelected(item.href)?" selected":"")}
       onClick={()=>setMobileOpen(false)}>
       <item.icon size={17} strokeWidth={1.85}/><span>{item.label}</span>
     </Link>)}
    </section>)}
    {pathname==="/assistant"&&<section className="agent-navigation-group" aria-label="المحادثات المحفوظة">
     <h2 className="agent-navigation-heading">المحادثات المحفوظة</h2>
     <div id="workspace-sidebar-slot" className="workspace-sidebar-slot"/>
    </section>}
   </nav>
  </aside>
  <main className="workspace-main">
   <header className="workspace-topbar">
    <button type="button" className="workspace-mobile-menu" aria-label="فتح القائمة"
     onClick={()=>setMobileOpen(true)}><Menu size={21}/></button>
    <span className="workspace-current-title">{title}</span>
   </header>
   <div className={"workspace-page"+(pathname==="/assistant"?" workspace-chat-page":"")}>
    {children}
   </div>
  </main>
 </div>;
}
