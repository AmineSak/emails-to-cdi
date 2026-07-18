"use server";

import { buildMime, getGmail, resumeAttachment, sendMessage } from "@/lib/gmail";
import { generateEmail } from "@/lib/gemini";
import { getProfile, getSettings } from "@/lib/singletons";
import type { ActionResult } from "@/app/actions/profile";

/**
 * Generates a draft with the real prompt/model path, using a synthetic lead
 * context instead of a database row — for testing prompt changes without
 * creating a Lead or EmailDraft.
 */
export async function generateSelfTestDraft(
  companyName: string,
  jobTitle: string,
): Promise<ActionResult & { subject?: string; body?: string }> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "This dev tool is disabled in production" };
  }

  const profile = await getProfile();
  if (!profile.rawText) {
    return { ok: false, error: "Add your resume in Resume & Preferences before generating" };
  }
  const settings = await getSettings();

  try {
    const draft = await generateEmail(
      profile,
      {
        firstName: "",
        lastName: "",
        jobTitle: jobTitle.trim() || "Recruteur",
        companyName: companyName.trim() || "Entreprise Test",
        companyIndustry: "",
      },
      settings.geminiModel,
    );
    return { ok: true, subject: draft.subject, body: draft.body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Generation failed" };
  }
}

/**
 * Sends a freeform test email to your own connected Gmail account — for
 * exercising the send pipeline without touching real leads. Recipient is
 * always the connected account itself, never client-supplied, and the whole
 * action is a no-op outside development. Attaches the resume PDF exactly
 * like a real lead send (lib/queue.ts), then reads the sent message back
 * from Gmail to confirm the attachment actually landed.
 */
export async function sendSelfTestEmail(
  subject: string,
  body: string,
): Promise<ActionResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "This dev tool is disabled in production" };
  }
  if (!subject.trim() || !body.trim()) {
    return { ok: false, error: "Subject and body cannot be empty" };
  }

  const auth = await getGmail();
  if (!auth) return { ok: false, error: "Connect Gmail in Settings first" };

  const profile = await getProfile();
  const attachment = resumeAttachment(profile);

  try {
    const raw = buildMime({
      from: auth.email,
      to: auth.email,
      subject: subject.trim(),
      text: body.trim(),
      attachment,
    });
    const { id } = await sendMessage(auth.gmail, raw);

    if (!attachment) {
      return {
        ok: true,
        message: `Sent to ${auth.email} — no résumé on file (upload one in Resume & Preferences to test the attachment)`,
      };
    }

    const sent = await auth.gmail.users.messages.get({ userId: "me", id, format: "full" });
    const landed = (sent.data.payload?.parts ?? []).some((p) => p.filename === attachment.filename);
    return {
      ok: true,
      message: landed
        ? `Sent to ${auth.email} — résumé attached and confirmed on Gmail's copy`
        : `Sent to ${auth.email} — but the résumé did NOT show up in Gmail's copy, something's wrong`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}
