import type { Metadata } from "next";
import "./globals.css";
import "./workspace-dark.css";
import WorkspaceShell from "@/components/workspace-shell";

export const metadata: Metadata = {
  title: "AGENT | مساحة العمل",
  description: "مساحة AGENT للمحادثات والعملاء والوكلاء والتسويق ببيانات مؤسستك الفعلية."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body><WorkspaceShell>{children}</WorkspaceShell></body>
    </html>
  );
}
