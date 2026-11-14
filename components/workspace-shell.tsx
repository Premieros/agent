"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {UsersRound,Inbox} from "lucide-react";
import type {ReactNode} from "react";
const sections=[{href:"/crm/inbox",label:"صندوق المحادثات",icon:Inbox},{href:"/crm",label:"العملاء والمتابعات",icon:UsersRound}];
export default function WorkspaceShell({children}:{children:ReactNode}){
 const pathname=usePathname();
 return <div className="workspace-shell agent-chat-first">
  <aside className="workspace-navigation" aria-label="خدمة العملاء">
   <div className="workspace-brand"><Link href="/crm/inbox" className="workspace-logo"><strong>AGENT · خدمة العملاء</strong></Link></div>
   <nav className="workspace-nav-list" aria-label="التنقل الرئيسي">
    {sections.map(item=><Link key={item.href} href={item.href} aria-current={(item.href==="/crm"?pathname==="/crm":pathname.startsWith("/crm/inbox"))?"page":undefined} className={"workspace-nav-link agent-primary-nav"+((item.href==="/crm"?pathname==="/crm":pathname.startsWith("/crm/inbox"))?" selected":"")}><item.icon size={18}/><span>{item.label}</span></Link>)}
   </nav>
   <div className="workspace-navigation-footer">متابعة العملاء والمحادثات الداخلية فقط.</div>
  </aside>
  <main className="workspace-main"><header className="workspace-topbar"><span className="workspace-current-title">خدمة العملاء</span></header><div className="workspace-page">{children}</div></main>
 </div>;
}
