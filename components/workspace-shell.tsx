"use client";

import {useEffect,useState,type ReactNode} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {
  PanelRightClose,PanelRightOpen,Menu,MessageSquareText,Bot,BrainCircuit,
  Megaphone,PanelsTopLeft,Palette,UsersRound,Inbox,PlugZap,LayoutDashboard,
  Settings2,X,ShieldCheck,ChevronLeft,Plus
} from "lucide-react";

type NavItem={href:string;label:string;icon:typeof Bot;description?:string};
const navigation: Array<{label:string;items:NavItem[]}>= [
  {label:"المساعد",items:[
    {href:"/assistant",label:"المحادثات",icon:MessageSquareText,description:"الشات والمهارات"},
    {href:"/assistant/integrations",label:"الإضافات والاتصالات",icon:PlugZap,description:"GitHub والبرامج ومفاتيح API"}
  ]},
  {label:"الوكلاء والتسويق",items:[
    {href:"/studio?section=agents",label:"مدير الوكلاء",icon:Bot},
    {href:"/studio?section=models",label:"النماذج والذكاء الاصطناعي",icon:BrainCircuit},
    {href:"/studio?section=pages",label:"الصفحات والحملات",icon:Megaphone},
    {href:"/studio?section=outputs",label:"مخرجات الوكلاء",icon:PanelsTopLeft},
    {href:"/studio?section=creatives",label:"التصميمات",icon:Palette}
  ]},
  {label:"إدارة العملاء",items:[
    {href:"/crm",label:"العملاء والمتابعة",icon:UsersRound},
    {href:"/crm/inbox",label:"صندوق المحادثات",icon:Inbox}
  ]}
];
const pageLabels:Record<string,string>={
  "/assistant":"المساعد الذكي",
  "/assistant/integrations":"الإضافات والاتصالات",
  "/studio":"الوكلاء والتسويق",
  "/crm":"العملاء والمتابعة",
  "/crm/inbox":"صندوق المحادثات"
};

export default function WorkspaceShell({children}:{children:ReactNode}){
  const pathname=usePathname();
  const isWorkspace=pathname==="/assistant"||pathname.startsWith("/assistant/")||
    pathname==="/studio"||pathname==="/crm"||pathname.startsWith("/crm/");
  const [isMobileOpen,setMobileOpen]=useState(false);
  const [isCollapsed,setCollapsed]=useState(false);
  const [section,setSection]=useState("agents");
  useEffect(()=>{
    setMobileOpen(false);
    setSection(new URLSearchParams(window.location.search).get("section")||"agents");
  },[pathname]);
  useEffect(()=>{
    const toggle=()=>setMobileOpen(old=>!old);
    window.addEventListener("agent:toggle-navigation",toggle);
    return ()=>window.removeEventListener("agent:toggle-navigation",toggle);
  },[]);
  if(!isWorkspace)return <>{children}</>;
  const matches=(item:NavItem)=>{
    if(item.href.startsWith("/studio?"))return pathname==="/studio"&&section===new URL(item.href,"https://agent.local").searchParams.get("section");
    return pathname===item.href;
  };
  return <div className={"workspace-shell"+(isCollapsed?" workspace-collapsed":"")}>
    {isMobileOpen&&<button type="button" className="workspace-backdrop" aria-label="إغلاق القائمة"
      onClick={()=>setMobileOpen(false)}/>}
    <aside className={"workspace-navigation"+(isMobileOpen?" workspace-navigation-open":"")} aria-label="القائمة الرئيسية">
      <div className="workspace-brand">
        <Link href="/assistant" className="workspace-logo" title="AGENT"><span className="workspace-brand-symbol">✦</span><strong>AGENT</strong></Link>
        <button type="button" className="workspace-collapse" aria-label={isCollapsed?"توسيع القائمة":"تصغير القائمة"}
          title={isCollapsed?"توسيع القائمة":"تصغير القائمة"}
          onClick={()=>setCollapsed(v=>!v)}>{isCollapsed?<PanelRightOpen size={19}/>:<PanelRightClose size={19}/>}</button>
        <button type="button" className="workspace-close-mobile" aria-label="إغلاق القائمة" onClick={()=>setMobileOpen(false)}><X size={20}/></button>
      </div>
      <Link className="workspace-new-chat" href="/assistant?new=1" title="محادثة جديدة"
        onClick={()=>setMobileOpen(false)}><Plus size={19}/><span>محادثة جديدة</span></Link>
      <nav className="workspace-nav-list" aria-label="أقسام AGENT">
        {navigation.map(group=><div className="workspace-nav-group" key={group.label}>
          <span className="workspace-group-label">{group.label}</span>
          {group.items.map(item=><Link href={item.href} key={item.href} title={item.label}
            onClick={()=>{setMobileOpen(false);if(item.href.startsWith("/studio?"))setSection(new URL(item.href,"https://agent.local").searchParams.get("section")||"agents");}}
            className={"workspace-nav-link"+(matches(item)?" selected":"")} aria-current={matches(item)?"page":undefined}>
            <item.icon size={19} strokeWidth={1.85}/><span>{item.label}</span>{matches(item)&&<ChevronLeft size={13} className="workspace-nav-chevron"/>}
          </Link>)}
        </div>)}
        {pathname==="/assistant"&&<div id="workspace-sidebar-slot" className="workspace-sidebar-slot"/>}
      </nav>
      <div className="workspace-navigation-footer">
        <Link href="/" title="الصفحة الرئيسية"><LayoutDashboard size={18}/><span>الصفحة الرئيسية</span></Link>
        <Link href="/assistant/integrations" title="إعدادات الأدوات"><Settings2 size={18}/><span>الإعدادات والأدوات</span></Link>
        <div className="workspace-security"><ShieldCheck size={16}/><span>إجراءات النشر والتعديل تتطلب الموافقة</span></div>
      </div>
    </aside>
    <main className="workspace-main">
      <header className="workspace-topbar">
        <button className="workspace-mobile-menu" type="button" onClick={()=>setMobileOpen(true)}
          aria-label="فتح القائمة"><Menu size={21}/></button>
        {isCollapsed&&<button className="workspace-desktop-open" type="button" onClick={()=>setCollapsed(false)}
          aria-label="توسيع القائمة"><PanelRightOpen size={20}/></button>}
        <span className="workspace-current-title">{pathname==="/studio"?
          navigation[1].items.find(item=>matches(item))?.label||pageLabels[pathname]:
          pageLabels[pathname]||"AGENT"}</span>
        <div className="workspace-topbar-right"><span className="workspace-workspace-label">Premier.OS / AGENT</span><span className="workspace-status-dot" title="مساحة العمل"/></div>
      </header>
      <div className={"workspace-page"+(pathname==="/assistant"?" workspace-chat-page":"")}>{children}</div>
    </main>
  </div>;
}
