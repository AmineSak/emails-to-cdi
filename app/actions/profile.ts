"use server";

import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/singletons";

// pdf-parse (pdfjs-dist under the hood) can need these on-disk data folders
// to decode non-embedded/CID-keyed fonts during text extraction — both
// default to `undefined` in Node (see pdf-parse's own type defs), so any PDF
// that hits that path throws unless we point at them explicitly. Verified
// these files themselves *do* reach the Vercel bundle already via
// `serverExternalPackages`, so this alone likely isn't the deployed-only
// failure — kept as a real defensive gap either way, and paired with the
// console.error below so the actual cause is no longer swallowed.
const pdfjsDataDir = path.join(process.cwd(), "node_modules", "pdfjs-dist");
const STANDARD_FONT_DATA_URL = path.join(pdfjsDataDir, "standard_fonts") + path.sep;
const CMAP_URL = path.join(pdfjsDataDir, "cmaps") + path.sep;

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
    // Required in serverless environments (Vercel/Lambda) per pdf-parse's
    // own Next.js/Vercel troubleshooting guidance — without it, worker
    // initialization can fail silently in ways that surface as extraction
    // errors below.
    await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({
      data: new Uint8Array(bytes),
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
      cMapUrl: CMAP_URL,
      cMapPacked: true,
    });
    const result = await parser.getText();
    text = result.text.trim();
  } catch (err) {
    // Never swallow this silently — it's the only way to see *why* a given
    // PDF fails (missing font data, corrupt structure, etc.) in Vercel's
    // runtime logs, since the user only ever sees the generic message below.
    console.error("[uploadResumePdf] pdf-parse extraction failed:", err);
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
