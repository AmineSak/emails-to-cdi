"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const POLL_MS = 20_000;

/**
 * Drains the send queue while the app is open. The server enforces spacing and
 * the daily cap; this just tickles the endpoint and refreshes the UI when
 * something went out.
 */
export function QueuePoller() {
  const router = useRouter();
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled || busy.current || document.visibilityState !== "visible") return;
      busy.current = true;
      try {
        const res = await fetch("/api/queue/process", { method: "POST" });
        if (res.ok) {
          const data: { sent: number; failed: number; pending: number } = await res.json();
          if (data.sent > 0) {
            toast.success(`${data.sent} email${data.sent > 1 ? "s" : ""} sent`, {
              description: data.pending > 0 ? `${data.pending} still queued` : "Queue is empty",
            });
            router.refresh();
          }
          if (data.failed > 0) {
            toast.error(`${data.failed} send${data.failed > 1 ? "s" : ""} failed`, {
              description: "The affected leads are back in Drafted — check their drafts.",
            });
            router.refresh();
          }
        }
      } catch {
        // Network hiccup — next tick will retry
      } finally {
        busy.current = false;
      }
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  return null;
}
