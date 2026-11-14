import type {Metadata} from "next";
import "./globals.css";
import "./workspace-dark.css";
import WorkspaceShell from "@/components/workspace-shell";
export const metadata:Metadata={title:"AGENT | خدمة العملاء",description:"إدارة العملاء وصندوق المحادثات والمتابعات الداخلية."};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="ar" dir="rtl"><body><WorkspaceShell>{children}</WorkspaceShell></body></html>;
}
