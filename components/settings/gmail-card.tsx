"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { disconnectGmail } from "@/app/actions/settings";

export function GmailCard({
  email,
  envReady,
  sentToday,
  dailyCap,
  queued,
}: {
  email: string | null;
  envReady: boolean;
  sentToday: number;
  dailyCap: number;
  queued: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gmail connection</CardTitle>
        <CardDescription>
          Emails are sent through your own Gmail account via OAuth — the refresh token is stored
          encrypted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {email ? (
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-green-700" />
              <div>
                <p className="font-mono text-sm">{email}</p>
                <p className="text-xs text-muted-foreground">
                  {sentToday}/{dailyCap} sent today{queued > 0 && ` · ${queued} queued`}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await disconnectGmail();
                  if (res.ok) {
                    toast.success(res.message, {
                      description: queued > 0 ? "Queued sends were canceled." : undefined,
                    });
                    router.refresh();
                  } else toast.error(res.error);
                })
              }
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            {!envReady && (
              <p className="rounded-md border border-amber-600/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
                Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI in your
                environment first. Create OAuth credentials (Web application) in Google Cloud
                Console with the redirect URI pointing to
                <span className="font-mono"> /api/auth/google/callback</span>, and enable the Gmail
                API.
              </p>
            )}
            {envReady ? (
              <Button nativeButton={false} render={<a href="/api/auth/google" />}>
                Connect Gmail
              </Button>
            ) : (
              <Button disabled>Connect Gmail</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
