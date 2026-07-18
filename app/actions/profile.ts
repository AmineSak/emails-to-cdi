"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/singletons";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function savePreferences(input: {
  targetRoles: string;
  industries: string;
  locations: string;
  tone: string;
  achievements: string;
  availability: string;
  extraContext: string;
}): Promise<ActionResult> {
  await getProfile();
  await prisma.resumeProfile.update({ where: { id: "singleton" }, data: input });
  revalidatePath("/profile");
  return { ok: true, message: "Preferences saved" };
}

export async function uploadResumePdf(formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file received" };
  if (file.type !== "application/pdf") return { ok: false, error: "Only PDF files are supported here — use the text tab otherwise" };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "PDF is larger than 2 MB" };

  const bytes = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(bytes) });
    const result = await parser.getText();
    text = result.text.trim();
  } catch {
    return { ok: false, error: "Could not extract text from this PDF" };
  }
  if (!text) return { ok: false, error: "This PDF contains no extractable text (scanned image?) — paste the text instead" };

  await getProfile();
  await prisma.resumeProfile.update({
    where: { id: "singleton" },
    data: { rawText: text, resumeFileName: file.name, resumePdf: bytes },
  });
  revalidatePath("/profile");
  return { ok: true, message: `Resume parsed — ${text.length.toLocaleString()} characters extracted` };
}

export async function saveResumeText(rawText: string): Promise<ActionResult> {
  if (!rawText.trim()) return { ok: false, error: "Resume text is empty" };
  await getProfile();
  await prisma.resumeProfile.update({
    where: { id: "singleton" },
    data: { rawText: rawText.trim() },
  });
  revalidatePath("/profile");
  return { ok: true, message: "Resume text saved" };
}

export async function removeResumePdf(): Promise<ActionResult> {
  await getProfile();
  await prisma.resumeProfile.update({
    where: { id: "singleton" },
    data: { resumePdf: null, resumeFileName: null },
  });
  revalidatePath("/profile");
  return { ok: true, message: "Attachment removed — emails will be sent without a PDF" };
}
