"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateEmail } from "@/lib/gemini";
import { getProfile, getSettings } from "@/lib/singletons";
import type { ActionResult } from "@/app/actions/profile";

export async function generateDraft(leadId: string, adjust?: string): Promise<ActionResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, error: "Lead not found" };

  const profile = await getProfile();
  if (!profile.rawText) {
    return { ok: false, error: "Add your resume in Resume & Preferences before generating drafts" };
  }
  const settings = await getSettings();

  try {
    const draft = await generateEmail(profile, lead, settings.geminiModel, adjust);
    await prisma.$transaction([
      prisma.emailDraft.upsert({
        where: { leadId },
        update: { subject: draft.subject, body: draft.body, model: draft.model, generatedAt: new Date(), sentAt: null },
        create: { leadId, subject: draft.subject, body: draft.body, model: draft.model },
      }),
      // Only move forward in the pipeline — regenerating after a send or reply
      // must not reset the lead's status.
      prisma.lead.updateMany({
        where: { id: leadId, status: "NOT_CONTACTED" },
        data: { status: "DRAFTED" },
      }),
    ]);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Generation failed" };
  }
}

export async function updateDraft(leadId: string, subject: string, body: string): Promise<ActionResult> {
  if (!subject.trim() || !body.trim()) return { ok: false, error: "Subject and body cannot be empty" };
  const draft = await prisma.emailDraft.findUnique({ where: { leadId } });
  if (!draft) return { ok: false, error: "No draft to update" };
  await prisma.emailDraft.update({
    where: { leadId },
    data: { subject: subject.trim(), body: body.trim() },
  });
  revalidatePath("/");
  return { ok: true, message: "Draft saved" };
}
