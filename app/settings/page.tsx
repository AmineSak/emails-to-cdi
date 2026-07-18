import { getGmailAccount, getSettings } from "@/lib/singletons";
import { sentTodayCount } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { GmailCard } from "@/components/settings/gmail-card";
import { SendSettingsForm } from "@/components/settings/send-settings-form";
import { SettingsToasts } from "@/components/settings/settings-toasts";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [gmail, settings, sentToday, queued] = await Promise.all([
    getGmailAccount(),
    getSettings(),
    sentTodayCount(),
    prisma.sendJob.count({ where: { status: "PENDING" } }),
  ]);

  const envReady = {
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI),
    gemini: !!process.env.GEMINI_API_KEY,
  };

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <SettingsToasts />
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gmail connection and sending guardrails.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <GmailCard
          email={gmail?.email ?? null}
          envReady={envReady.google}
          sentToday={sentToday}
          dailyCap={settings.dailySendCap}
          queued={queued}
        />
        <SendSettingsForm
          initial={{
            sendDelaySeconds: settings.sendDelaySeconds,
            dailySendCap: settings.dailySendCap,
            geminiModel: settings.geminiModel,
          }}
          geminiEnvReady={envReady.gemini}
        />
      </div>
    </div>
  );
}
