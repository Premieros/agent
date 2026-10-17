import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent | مركز قيادة المبيعات الذكي",
  description: "لوحة تجريبية لإدارة العملاء والمحادثات وتسليم فرص البيع للفريق البشري"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
