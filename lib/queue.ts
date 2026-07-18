import { prisma } from "@/lib/prisma";
import { buildMime, findReplyInThread, getGmail, sendMessage } from "@/lib/gmail";
import { getProfile, getSettings } from "@/lib/singletons";

const BATCH_PER_DRAIN = 5;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function sentTodayCount(): Promise<number> {
  return prisma.sendJob.count({
    where: { status: "SENT", sentAt: { gte: startOfToday() } },
  });
}

export type DrainResult = {
  sent: number;
  failed: number;
  pending: number;
  capReached: boolean;
  nextScheduledAt: string | null;
};

/**
 * Sends due queued jobs. Safe to call concurrently (jobs are claimed with a
 * guarded status transition) and from both the in-app poller and a cron.
 * The daily cap is enforced here, server-side.
 */
export async function processDueJobs(): Promise<DrainResult> {
  const settings = await getSettings();
  const alreadySent = await sentTodayCount();
  const capRemaining = Math.max(0, settings.dailySendCap - alreadySent);

  let sent = 0;
  let failed = 0;

  if (capRemaining > 0) {
    const auth = await getGmail();
    if (auth) {
      const profile = await getProfile();
      const due = await prisma.sendJob.findMany({
        where: { status: "PENDING", scheduledAt: { lte: new Date() } },
        orderBy: { scheduledAt: "asc" },
        take: Math.min(capRemaining, BATCH_PER_DRAIN),
        include: { lead: true, draft: true },
      });

      for (const job of due) {
        // Claim the job; skip if another drain got it first
        const claimed = await prisma.sendJob.updateMany({
          where: { id: job.id, status: "PENDING" },
          data: { status: "SENDING", attempts: { increment: 1 } },
        });
        if (claimed.count !== 1) continue;

        try {
          const raw = buildMime({
            from: auth.email,
            to: job.lead.email,
            subject: job.draft.subject,
            text: job.draft.body,
            attachment:
              profile.resumePdf && profile.resumeFileName
                ? {
                    filename: profile.resumeFileName,
                    contentType: "application/pdf",
                    data: Buffer.from(profile.resumePdf),
                  }
                : undefined,
          });
          const { id, threadId } = await sendMessage(auth.gmail, raw);
          const now = new Date();
          await prisma.$transaction([
            prisma.sendJob.update({
              where: { id: job.id },
              data: { status: "SENT", sentAt: now, error: null },
            }),
            prisma.emailDraft.update({
              where: { id: job.draftId },
              data: { sentAt: now },
            }),
            prisma.lead.update({
              where: { id: job.leadId },
              data: {
                status: "SENT",
                lastContactedAt: now,
                gmailMessageId: id,
                gmailThreadId: threadId,
              },
            }),
          ]);
          sent++;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          await prisma.sendJob.update({
            where: { id: job.id },
            data: { status: "FAILED", error: message },
          });
          // Surface the failure on the lead so it is visible in the table
          await prisma.lead.update({
            where: { id: job.leadId },
            data: { status: "DRAFTED" },
          });
          failed++;
        }
      }
    }
  }

  const pending = await prisma.sendJob.count({ where: { status: "PENDING" } });
  const next = await prisma.sendJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { scheduledAt: "asc" },
    select: { scheduledAt: true },
  });

  return {
    sent,
    failed,
    pending,
    capReached: capRemaining === 0 && (await prisma.sendJob.count({ where: { status: "PENDING" } })) > 0,
    nextScheduledAt: next?.scheduledAt.toISOString() ?? null,
  };
}

export type SyncResult = { checked: number; replies: number; bounces: number };

/** Checks Gmail threads of SENT leads for replies. */
export async function syncReplies(): Promise<SyncResult> {
  const auth = await getGmail();
  if (!auth) throw new Error("Gmail is not connected");

  const leads = await prisma.lead.findMany({
    where: { status: "SENT", gmailThreadId: { not: null } },
  });

  let replies = 0;
  let bounces = 0;
  for (const lead of leads) {
    const reply = await findReplyInThread(auth.gmail, lead.gmailThreadId!, lead.gmailMessageId);
    if (!reply) continue;
    if (reply.fromMailerDaemon) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "BOUNCED", replySnippet: reply.snippet },
      });
      bounces++;
    } else {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "REPLIED", lastRepliedAt: reply.date, replySnippet: reply.snippet },
      });
      replies++;
    }
  }
  return { checked: leads.length, replies, bounces };
}
