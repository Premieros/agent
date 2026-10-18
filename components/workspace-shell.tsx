"use client";

import {useEffect,useState,type ReactNode} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {
  PanelRightClose,PanelRightOpen,Menu,MessageSquareText,Bot,BrainCircuit,
  Megaphone,PanelsTopLeft,Palette,UsersRound,Inbox,PlugZap,LayoutDashboard,
  Settings2,X,ShieldCheck,ChevronDown,Plus,Code2,Globe,ClipboardList,
  MessagesSquare,Share2,Boxes,BriefcaseBusiness,LockKeyhole
} from "lucide-react";

type GroupId="assistant"|"agents"|"marketing"|"customers"|"inbox"|"system";
type NavItem={href:string;label:string;icon:typeof Bot};
type NavGroup={id:GroupId;label:string;icon:typeof Bot;items:NavItem[]};

const navigation:NavGroup[]=[
  {id:"assistant",label:"المساعد",icon:MessageSquareText,items:[
    {href:"/assistant",label:"المحادثات الذكية",icon:MessagesSquare},
    {href:"/assistant?skill=pos_development",label:"مساعد البرمجة",icon:Code2},
    {href:"/assistant?skill=browser",label:"قراءة المواقع",icon:Globe}
  ]},
  {id:"agents",label:"الوكلاء",icon:Bot,items:[
    {href:"/studio?section=agents",label:"مدير الوكلاء",icon:Bot},
    {href:"/studio?section=outputs",label:"مخرجات الوكلاء",icon:ClipboardList}
  ]},
  {id:"marketing",label:"التسويق",icon:Megaphone,items:[
    {href:"/studio?section=pages",label:"الصفحات والعلامات",icon:PanelsTopLeft},
    {href:"/studio?section=campaigns",label:"الحملات والمهام",icon:BriefcaseBusiness},
    {href:"/studio?section=creatives",label:"التصميمات",icon:Palette}
  ]},
  {id:"customers",label:"العملاء",icon:UsersRound,items:[
    {href:"/crm?view=leads",label:"إدارة العملاء",icon:UsersRound},
    {href:"/crm?view=tasks",label:"مهام المتابعة",icon:ClipboardList}
  ]},
  {id:"inbox",label:"المحادثات",icon:Inbox,items:[
    {href:"/crm/inbox",label:"صندوق الوارد",icon:Inbox},
    {href:"/crm/inbox?channel=manual",label:"المتابعات الداخلية",icon:MessagesSquare}
  ]},
  {id:"system",label:"الإدارة والنظام",icon:Settings2,items:[
    {href:"/studio?section=models",label:"النماذج ومفاتيح AI",icon:BrainCircuit},
    {href:"/assistant/integrations",label:"مركز الإضافات",icon:PlugZap},
    {href:"/assistant/integrations?category=social",label:"فيسبوك وواتساب",icon:Share2},
    {href:"/assistant/integrations?category=developer",label:"GitHub وأدوات التطوير",icon:Boxes},
    {href:"/crm?view=account",label:"حسابي وتسجيل الدخول",icon:LockKeyhole}
  ]}
];

function activeSelection(path:string,search:string){
  const params=new URLSearchParams(search);
  const paramName=path==="/assistant"?"skill":path==="/studio"?"section":
    path==="/crm"?"view":path==="/crm/inbox"?"channel":
    path==="/assistant/integrations"?"category":"";
  const value=params.get(paramName)||(
    path==="/studio"?"agents":path==="/crm"?"leads":"");
  const item=navigation.flatMap(g=>g.items).find(i=>{
    const dest=new URL(i.href,"https://agent.local");
    if(dest.pathname!==path)return false;
    return (dest.searchParams.get(paramName)||"")===value;
  });
  const group=navigation.find(g=>g.items.some(i=>i.href===item?.href));
  const fallback:GroupId=path==="/studio"?"agents":path==="/crm"?"customers":
    path==="/crm/inbox"?"inbox":path==="/assistant/integrations"?"system":"assistant";
  return {href:item?.href||path,group:group?.id||fallback};
}

export default function WorkspaceShell({children}:{children:ReactNode}){
  const pathname=usePathname();
  const isWorkspace=pathname==="/studio"||pathname==="/assistant"||
    pathname.startsWith("/assistant/")||pathname==="/crm"||pathname.startsWith("/crm/");
  const [mobileOpen,setMobileOpen]=useState(false);
  const [collapsed,setCollapsed]=useState(false);
  const [openGroup,setOpenGroup]=useState<GroupId|null>("assistant");
  const [activeHref,setActiveHref]=useState("/assistant");

  useEffect(()=>{
    const sync=()=>{
      const current=activeSelection(pathname,window.location.search);
      setActiveHref(current.href);
      setOpenGroup(current.group);
    };
    sync();
    setMobileOpen(false);
    window.addEventListener("popstate",sync);
    return()=>window.removeEventListener("popstate",sync);
  },[pathname]);
  useEffect(()=>{
    const toggle=()=>setMobileOpen(v=>!v);
    const close=()=>setMobileOpen(false);
    window.addEventListener("agent:toggle-navigation",toggle);
    window.addEventListener("agent:close-navigation",close);
    return()=>{
      window.removeEventListener("agent:toggle-navigation",toggle);
      window.removeEventListener("agent:close-navigation",close);
    };
  },[]);
  if(!isWorkspace)return <>{children}</>;

  function choose(item:NavItem,group:GroupId){
    setActiveHref(item.href);setOpenGroup(group);setMobileOpen(false);
    const u=new URL(item.href,"https://agent.local");
    const dispatch=(name:string,param:string,fallback:string)=>
      window.dispatchEvent(new CustomEvent(name,{detail:u.searchParams.get(param)||fallback}));
    if(u.pathname==="/studio")dispatch("agent:select-studio-section","section","agents");
    else if(u.pathname==="/crm")dispatch("agent:select-crm-view","view","leads");
    else if(u.pathname==="/crm/inbox")dispatch("agent:select-inbox-channel","channel","all");
    else if(u.pathname==="/assistant/integrations")dispatch("agent:select-integrations-category","category","all");
    else if(u.pathname==="/assistant")dispatch("agent:select-assistant-skill","skill","auto");
  }

  const pageTitle=navigation.flatMap(g=>g.items).find(i=>i.href===activeHref)?.label||"المساعد الذكي";
  return <div className={"workspace-shell"+(collapsed?" workspace-collapsed":"")}>
    {mobileOpen&&<button className="workspace-backdrop" type="button" aria-label="إغلاق القائمة"
      onClick={()=>setMobileOpen(false)}/>}
    <aside className={"workspace-navigation"+(mobileOpen?" workspace-navigation-open":"")} aria-label="القائمة الجانبية">
      <div className="workspace-brand">
        <Link href="/assistant" className="workspace-logo">
          <span className="workspace-brand-symbol">✦</span><strong>AGENT</strong>
        </Link>
        <button className="workspace-collapse" type="button" onClick={()=>setCollapsed(v=>!v)}
          aria-label={collapsed?"توسيع القائمة":"تصغير القائمة"}
          title={collapsed?"توسيع القائمة":"تصغير القائمة"}>
          {collapsed?<PanelRightOpen size={20}/>:<PanelRightClose size={20}/>}
        </button>
        <button className="workspace-close-mobile" type="button" onClick={()=>setMobileOpen(false)}
          aria-label="إغلاق القائمة"><X size={20}/></button>
      </div>
      <Link href="/assistant?new=1" className="workspace-new-chat" title="محادثة جديدة"
        onClick={e=>{
          setMobileOpen(false);
          if(pathname==="/assistant"){e.preventDefault();window.dispatchEvent(new Event("agent:new-chat"));}
        }}><Plus size={19}/><span>محادثة جديدة</span></Link>
      <nav className="workspace-nav-list">
        {navigation.map(group=><div key={group.id} className={"workspace-nav-group"+(openGroup===group.id?" is-open":"")}>
          <button className={"workspace-group-toggle"+(openGroup===group.id?" is-open":"")} type="button"
            onClick={()=>{setOpenGroup(current=>current===group.id?null:group.id);if(collapsed)setCollapsed(false);}}
            aria-expanded={openGroup===group.id} aria-controls={"workspace-group-"+group.id}
            title={group.label}>
            <group.icon size={19}/><span>{group.label}</span>
            <ChevronDown size={17} className="workspace-group-chevron"/>
          </button>
          {openGroup===group.id&&<div id={"workspace-group-"+group.id} className="workspace-subnav">
            {group.items.map(item=><Link key={item.href} href={item.href} title={item.label}
              className={"workspace-nav-link"+(activeHref===item.href?" selected":"")}
              aria-current={activeHref===item.href?"page":undefined}
              onClick={()=>choose(item,group.id)}>
              <item.icon size={17} strokeWidth={1.85}/><span>{item.label}</span>
            </Link>)}
            {group.id==="assistant"&&pathname==="/assistant"&&
              <div id="workspace-sidebar-slot" className="workspace-sidebar-slot"/>}
          </div>}
        </div>)}
      </nav>
      <div className="workspace-navigation-footer">
        <Link href="/" title="الصفحة الرئيسية"><LayoutDashboard size={18}/><span>الرئيسية</span></Link>
        <div className="workspace-security"><ShieldCheck size={16}/><span>لا تعديل أو نشر خارجي بدون موافقة</span></div>
      </div>
    </aside>
    <main className="workspace-main">
      <header className="workspace-topbar">
        <button type="button" className="workspace-mobile-menu" aria-label="فتح القائمة"
          onClick={()=>setMobileOpen(true)}><Menu size={21}/></button>
        {collapsed&&<button type="button" className="workspace-desktop-open"
          aria-label="توسيع القائمة" onClick={()=>setCollapsed(false)}><PanelRightOpen size={20}/></button>}
        <span className="workspace-current-title">{pageTitle}</span>
        <div className="workspace-topbar-right"><span className="workspace-workspace-label">AGENT Workspace</span>
          <span className="workspace-status-dot" title="مساحة العمل"/></div>
      </header>
      <div className={"workspace-page"+(pathname==="/assistant"?" workspace-chat-page":"")}>{children}</div>
    </main>
  </div>;
}
