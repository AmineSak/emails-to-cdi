"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/** Surfaces OAuth callback results (?connected=1 / ?error=…) as toasts. */
export function SettingsToasts() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) toast.success("Gmail connected");
    if (error) toast.error("Gmail connection failed", { description: error });
    if (connected || error) router.replace(pathname);
  }, [params, router, pathname]);

  return null;
}
