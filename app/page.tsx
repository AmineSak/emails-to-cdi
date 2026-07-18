import { prisma } from "@/lib/prisma";
import { getGmailAccount, getProfile, getSettings } from "@/lib/singletons";
import { sentTodayCount } from "@/lib/queue";
import type { DashboardMeta, LeadDTO } from "@/lib/lead-dto";
import { Dashboard } from "@/components/leads/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [leads, gmail, profile, settings, sentToday, queuedCount] = await Promise.all([
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      include: { draft: true },
    }),
    getGmailAccount(),
    getProfile(),
    getSettings(),
    sentTodayCount(),
    prisma.sendJob.count({ where: { status: "PENDING" } }),
  ]);

  const dtos: LeadDTO[] = leads.map((l) => ({
    id: l.id,
    email: l.email,
    firstName: l.firstName,
    lastName: l.lastName,
    jobTitle: l.jobTitle,
    companyName: l.companyName,
    companyIndustry: l.companyIndustry,
    linkedinUrl: l.linkedinUrl,
    source: l.source,
    status: l.status,
    notes: l.notes,
    lastContactedAt: l.lastContactedAt?.toISOString() ?? null,
    lastRepliedAt: l.lastRepliedAt?.toISOString() ?? null,
    replySnippet: l.replySnippet,
    createdAt: l.createdAt.toISOString(),
    draft: l.draft
      ? {
          subject: l.draft.subject,
          body: l.draft.body,
          model: l.draft.model,
          generatedAt: l.draft.generatedAt.toISOString(),
          sentAt: l.draft.sentAt?.toISOString() ?? null,
        }
      : null,
  }));

  const meta: DashboardMeta = {
    gmailConnected: !!gmail,
    gmailEmail: gmail?.email ?? null,
    hasResume: profile.rawText.length > 0,
    sentToday,
    dailySendCap: settings.dailySendCap,
    queuedCount,
  };

  return <Dashboard leads={dtos} meta={meta} />;
}
