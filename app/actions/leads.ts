"use server";

import { revalidatePath } from "next/cache";
import type { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { syncReplies } from "@/lib/queue";
import type { ActionResult } from "@/app/actions/profile";
import type { SyncResult } from "@/lib/queue";

export async function setLeadStatus(leadId: string, status: LeadStatus): Promise<ActionResult> {
  await prisma.lead.update({ where: { id: leadId }, data: { status } });
  // Leaving QUEUED manually should also cancel the pending send
  if (status !== "QUEUED") {
    await prisma.sendJob.updateMany({
      where: { leadId, status: "PENDING" },
      data: { status: "CANCELED" },
    });
  }
  revalidatePath("/");
  return { ok: true };
}

export async function saveNotes(leadId: string, notes: string): Promise<ActionResult> {
  await prisma.lead.update({ where: { id: leadId }, data: { notes } });
  revalidatePath("/");
  return { ok: true, message: "Notes saved" };
}

export async function deleteLeads(leadIds: string[]): Promise<ActionResult> {
  if (leadIds.length === 0) return { ok: false, error: "No leads selected" };
  await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  revalidatePath("/");
  return { ok: true, message: `${leadIds.length} lead${leadIds.length > 1 ? "s" : ""} deleted` };
}

export async function syncRepliesAction(): Promise<ActionResult & { result?: SyncResult }> {
  try {
    const result = await syncReplies();
    revalidatePath("/");
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sync failed" };
  }
}
