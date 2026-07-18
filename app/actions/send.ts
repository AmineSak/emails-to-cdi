"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getGmailAccount, getSettings } from "@/lib/singletons";
import { sentTodayCount } from "@/lib/queue";
import type { ActionResult } from "@/app/actions/profile";

/**
 * Queues the drafts of the given leads for sending, spaced by the configured
 * delay. Never sends anything that has no reviewable draft.
 */
export async function queueSend(
  leadIds: string[],
): Promise<ActionResult & { queued?: number; capNote?: string }> {
  if (leadIds.length === 0) return { ok: false, error: "No leads selected" };

  const account = await getGmailAccount();
  if (!account) return { ok: false, error: "Connect your Gmail account in Settings first" };

  const settings = await getSettings();
  const leads = await prisma.lead.findMany({
    where: {
      id: { in: leadIds },
      status: { in: ["DRAFTED", "NOT_CONTACTED", "NO_RESPONSE"] },
      draft: { isNot: null },
    },
    include: { draft: true },
  });
  if (leads.length === 0) {
    return { ok: false, error: "None of the selected leads has an unsent draft — generate drafts first" };
  }

  // Space sends starting after the last already-queued job
  const lastPending = await prisma.sendJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { scheduledAt: "desc" },
    select: { scheduledAt: true },
  });
  const delayMs = Math.max(5, settings.sendDelaySeconds) * 1000;
  let t = Math.max(Date.now(), lastPending ? lastPending.scheduledAt.getTime() + delayMs : 0);

  for (const lead of leads) {
    const jitter = Math.floor(delayMs * 0.3 * Math.random());
    await prisma.$transaction([
      prisma.sendJob.create({
        data: {
          leadId: lead.id,
          draftId: lead.draft!.id,
          scheduledAt: new Date(t),
        },
      }),
      prisma.lead.update({ where: { id: lead.id }, data: { status: "QUEUED" } }),
    ]);
    t += delayMs + jitter;
  }

  const sentToday = await sentTodayCount();
  const capNote =
    sentToday + leads.length > settings.dailySendCap
      ? `Daily cap is ${settings.dailySendCap} — sends beyond it will wait until tomorrow.`
      : undefined;

  revalidatePath("/");
  return { ok: true, queued: leads.length, capNote };
}

/** Cancels pending sends for the given leads and returns them to Drafted. */
export async function cancelQueued(leadIds: string[]): Promise<ActionResult & { canceled?: number }> {
  const { count } = await prisma.sendJob.updateMany({
    where: { leadId: { in: leadIds }, status: "PENDING" },
    data: { status: "CANCELED" },
  });
  await prisma.lead.updateMany({
    where: { id: { in: leadIds }, status: "QUEUED" },
    data: { status: "DRAFTED" },
  });
  revalidatePath("/");
  return { ok: true, canceled: count };
}
