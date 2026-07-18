"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/singletons";
import type { ActionResult } from "@/app/actions/profile";

export async function saveSendSettings(input: {
  sendDelaySeconds: number;
  dailySendCap: number;
  geminiModel: string;
}): Promise<ActionResult> {
  const delay = Math.floor(input.sendDelaySeconds);
  const cap = Math.floor(input.dailySendCap);
  if (!Number.isFinite(delay) || delay < 5 || delay > 3600) {
    return { ok: false, error: "Delay must be between 5 and 3600 seconds" };
  }
  if (!Number.isFinite(cap) || cap < 1 || cap > 500) {
    return { ok: false, error: "Daily cap must be between 1 and 500" };
  }
  if (!input.geminiModel.trim()) {
    return { ok: false, error: "Model name cannot be empty" };
  }
  await getSettings();
  await prisma.appSettings.update({
    where: { id: "singleton" },
    data: { sendDelaySeconds: delay, dailySendCap: cap, geminiModel: input.geminiModel.trim() },
  });
  revalidatePath("/settings");
  return { ok: true, message: "Settings saved" };
}

export async function disconnectGmail(): Promise<ActionResult> {
  await prisma.gmailAccount.deleteMany({ where: { id: "singleton" } });
  // Pending sends can no longer go out without an account
  await prisma.sendJob.updateMany({ where: { status: "PENDING" }, data: { status: "CANCELED" } });
  await prisma.lead.updateMany({ where: { status: "QUEUED" }, data: { status: "DRAFTED" } });
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: "Gmail disconnected" };
}
