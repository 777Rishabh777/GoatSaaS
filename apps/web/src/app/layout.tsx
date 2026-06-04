import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";
import PyroWidget from "@/components/PyroWidget";

export const metadata: Metadata = {
  title: "GoatSaaS — Developer Platform & Dashboard",
  description:
    "Manage every SaaS subscription in one place and run AI readiness audits with Audire. Track renewals, optimize spend, and improve AI visibility.",
  keywords: "SaaS spend dashboard, subscription management, renewal tracking, AI readiness audit, Audire",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          {children}
          <PyroWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
