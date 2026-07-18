"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Import, LayoutGrid, MailWarning, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/import", label: "Import CSV", icon: Import },
  { href: "/profile", label: "Resume & Preferences", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function Sidebar({ gmailEmail }: { gmailEmail: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-5 pt-6 pb-4">
        <p className="font-mono text-[10px] font-medium tracking-[0.28em] text-primary uppercase">
          Candidatures
        </p>
        <p className="mt-0.5 text-lg leading-tight font-semibold tracking-tight text-sidebar-foreground">
          spontanées&nbsp;·&nbsp;CDI
        </p>
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4" strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pb-5">
        {gmailEmail ? (
          <div className="rounded-md border border-sidebar-border bg-card px-3 py-2.5">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Sending as
            </p>
            <p className="mt-1 truncate font-mono text-xs text-foreground" title={gmailEmail}>
              {gmailEmail}
            </p>
          </div>
        ) : (
          <Link
            href="/settings"
            className="flex items-start gap-2 rounded-md border border-dashed border-amber-600/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 transition-colors hover:bg-amber-500/15"
          >
            <MailWarning className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Gmail not connected.
              <span className="block font-medium underline underline-offset-2">Connect in Settings</span>
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
}
