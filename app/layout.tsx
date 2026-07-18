import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/layout/sidebar";
import { QueuePoller } from "@/components/layout/queue-poller";
import { getGmailAccount } from "@/lib/singletons";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Candidatures — spontaneous outreach",
  description: "Personal CDI outreach: import leads, draft with AI, send via Gmail, track replies.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gmail = await getGmailAccount();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <Sidebar gmailEmail={gmail?.email ?? null} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <QueuePoller />
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
