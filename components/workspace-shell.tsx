"use client";

import {useEffect,useState,type ReactNode} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Menu,MessagesSquare,PlugZap,Library,Plus,X} from "lucide-react";

const sections=[
  {href:"/assistant",label:"المحادثات",icon:MessagesSquare},
  {href:"/assistant/integrations",label:"الربط وإعداداته",icon:PlugZap},
  {href:"/assistant/library",label:"المكتبة",icon:Library}
] as const;

export default function WorkspaceShell({children}:{children:ReactNode}){
  const pathname=usePathname();
  const isWorkspace=pathname==="/"||pathname==="/studio"||pathname==="/assistant"||
    pathname.startsWith("/assistant/")||pathname==="/crm"||pathname.startsWith("/crm/");
  const [mobileOpen,setMobileOpen]=useState(false);
  useEffect(()=>{
    const close=()=>setMobileOpen(false);
    const toggle=()=>setMobileOpen(v=>!v);
    window.addEventListener("agent:close-navigation",close);
    window.addEventListener("agent:toggle-navigation",toggle);
    return()=>{
      window.removeEventListener("agent:close-navigation",close);
      window.removeEventListener("agent:toggle-navigation",toggle);
    };
  },[]);
  useEffect(()=>{setMobileOpen(false);},[pathname]);
  if(!isWorkspace)return <>{children}</>;
  const active=pathname.startsWith("/assistant/library")?sections[2]:
    pathname.startsWith("/assistant/integrations")?sections[1]:sections[0];
  const title=active.label;
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
        if(pathname==="/assistant"){e.preventDefault();window.dispatchEvent(new Event("agent:new-chat"));}
      }}><Plus size={18}/> محادثة جديدة</Link>
      <nav className="workspace-nav-list" aria-label="التنقل الرئيسي">
        {sections.map(item=><Link key={item.href} href={item.href}
          aria-current={active.href===item.href?"page":undefined}
          className={"workspace-nav-link agent-primary-nav"+(active.href===item.href?" selected":"")}
          onClick={()=>setMobileOpen(false)}>
          <item.icon size={18} strokeWidth={1.85}/><span>{item.label}</span>
        </Link>)}
        {pathname==="/assistant"&&<div id="workspace-sidebar-slot" className="workspace-sidebar-slot"/>}
      </nav>
      <div className="workspace-navigation-footer">
        <span>البحث والتحليل والوكلاء وإدارة العمل من داخل المحادثة.</span>
      </div>
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
