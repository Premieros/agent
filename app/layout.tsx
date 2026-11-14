import type { Metadata } from "next";
import "./globals.css";
import "./workspace-dark.css";

export const metadata: Metadata = {
  title: "AGENT | خدمة العملاء",
  description: "إدارة العملاء والمحادثات والمتابعات وتحويل الحالات إلى فريق الخدمة."
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
