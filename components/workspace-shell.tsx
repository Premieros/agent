"use client";

import {useEffect,useState,type ReactNode} from "react";
import Link from "next/link";
import QuickPinControl from "@/components/quick-pin-control";
import {usePathname,useSearchParams} from "next/navigation";
import {
  Bot,ChevronDown,Headphones,History,Home,Inbox,Library,
  Menu,MessagesSquare,Plus,Settings2,UsersRound,PlugZap,X
} from "lucide-react";

type Item={href:string;label:string;icon:typeof Home};
type Group={title:string;items:Item[]};

// Six daily-use destinations. Sub-views remain inside their actual modules.
const groups:Group[]=[
 {title:"المساعد",items:[
  {href:"/assistant",label:"المحادثات الذكية",icon:MessagesSquare}
 ]},
 {title:"خدمة العملاء",items:[
  {href:"/support/conversations",label:"محادثات العملاء",icon:Inbox},
  {href:"/support",label:"المشاريع والمعرفة",icon:Headphones},
  {href:"/support/channels",label:"قنوات التواصل",icon:PlugZap}
 ]},
 {title:"إدارة الأعمال",items:[
  {href:"/crm?view=leads",label:"إدارة العملاء",icon:UsersRound},
  {href:"/studio?section=agents",label:"الوكلاء والتسويق",icon:Bot}
 ]}
];
// Less frequently used destinations are still available without clutter.
const extraItems:Item[]=[
 {href:"/assistant/library",label:"مكتبة الملفات",icon:Library},
 {href:"/crm/inbox",label:"صندوق الفريق الداخلي",icon:Inbox},
 {href:"/assistant/integrations",label:"الربط والإعدادات",icon:Settings2}
];

export default function WorkspaceShell({children}:{children:ReactNode}){
 const pathname=usePathname();
 const searchParams=useSearchParams();
 const isWorkspace=pathname==="/"||pathname==="/studio"||pathname==="/assistant"||
   pathname.startsWith("/assistant/")||pathname==="/crm"||pathname.startsWith("/crm/")||
   pathname==="/support"||pathname==="/support/conversations"||pathname==="/support/channels";
 const [mobileOpen,setMobileOpen]=useState(false);
 const [moreOpen,setMoreOpen]=useState(false);
 const [savedOpen,setSavedOpen]=useState(false);
 useEffect(()=>{
  const showSaved=()=>{
   setSavedOpen(true);
   if(window.innerWidth<=900)setMobileOpen(true);
  };
  window.addEventListener("agent:open-saved-conversations",showSaved);
  return()=>window.removeEventListener("agent:open-saved-conversations",showSaved);
 },[]);
 useEffect(()=>{
  if(extraItems.some(item=>pathname===item.href.split("?")[0]))setMoreOpen(true);
 },[pathname]);
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
 const itemSelected=(href:string)=>{
  // CRM and Studio subsections belong to the same module, not extra main links.
  if(href.startsWith("/crm?"))return pathname==="/crm";
  if(href.startsWith("/studio?"))return pathname==="/studio";
  return pathname===href;
 };
 const current=[...groups.flatMap(g=>g.items),...extraItems].find(i=>itemSelected(i.href));
 const title=current?.label||(pathname.startsWith("/crm")?"إدارة العملاء":
  pathname.startsWith("/studio")?"الوكلاء والتسويق":"AGENT");
 return <div className="workspace-shell agent-chat-first">
  {mobileOpen&&<button type="button" className="workspace-backdrop" aria-label="إغلاق القائمة"
     onClick={()=>setMobileOpen(false)}/>}
  <aside className={"workspace-navigation"+(mobileOpen?" workspace-navigation-open":"")}
   aria-label="أقسام AGENT">
   <div className="workspace-brand">
    <Link href="/assistant" className="workspace-logo" onClick={()=>setMobileOpen(false)}>
     <span className="workspace-brand-symbol">✦</span><strong>AGENT</strong>
    </Link>
    <button type="button" className="workspace-close-mobile" aria-label="إغلاق القائمة"
      onClick={()=>setMobileOpen(false)}><X size={20}/></button>
   </div>
   <Link href="/assistant?new=1" className="workspace-new-chat" onClick={e=>{
    setMobileOpen(false);
    if(pathname==="/assistant"){e.preventDefault();window.dispatchEvent(new Event("agent:new-chat"))}
   }}><Plus size={18}/> محادثة جديدة</Link>
   <nav className="workspace-nav-list agent-all-navigation agent-clean-navigation" aria-label="تنقل AGENT المبسط">
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
    <section className="agent-navigation-group agent-secondary-group" aria-label="روابط إضافية">
     <button type="button" className="agent-nav-toggle"
       aria-expanded={moreOpen} aria-controls="agent-nav-secondary"
       onClick={()=>setMoreOpen(v=>!v)}>
       <Settings2 size={17}/><span>المزيد</span>
       <ChevronDown size={15} className={moreOpen?"expanded":""}/>
     </button>
     <div id="agent-nav-secondary" className="agent-secondary-items" hidden={!moreOpen}>
      {extraItems.map(item=><Link key={item.href} href={item.href}
       aria-current={itemSelected(item.href)?"page":undefined}
       className={"workspace-nav-link agent-primary-nav"+(itemSelected(item.href)?" selected":"")}
       onClick={()=>setMobileOpen(false)}>
       <item.icon size={16}/><span>{item.label}</span>
      </Link>)}
     </div>
    </section>
    {pathname==="/assistant"&&<section className="agent-saved-section" aria-label="سجل المحادثات">
     <button type="button" className="agent-nav-toggle agent-saved-toggle"
      aria-controls="agent-saved-content" aria-expanded={savedOpen}
      onClick={()=>setSavedOpen(v=>!v)}>
      <History size={17}/><span>المحادثات السابقة</span>
      <ChevronDown size={15} className={savedOpen?"expanded":""}/>
     </button>
     <div id="agent-saved-content" className="agent-saved-content" hidden={!savedOpen}>
      <div id="workspace-sidebar-slot" className="workspace-sidebar-slot"/>
     </div>
    </section>}
   </nav>
  </aside>
  <main className="workspace-main">
   <header className="workspace-topbar">
    <button type="button" className="workspace-mobile-menu" aria-label="فتح القائمة"
     onClick={()=>setMobileOpen(true)}><Menu size={21}/></button>
    <span className="workspace-current-title">{title}</span>
    <QuickPinControl/>
   </header>
   <div className={"workspace-page"+(pathname==="/assistant"?" workspace-chat-page":"")}>
    {children}
   </div>
  </main>
 </div>;
}
