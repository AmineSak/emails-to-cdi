"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/app/actions/profile";

export type ImportRow = {
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  companyName: string;
  companyIndustry: string;
  linkedinUrl: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ImportSummary = {
  imported: number;
  duplicates: number;
  invalid: number;
};

export async function importLeads(
  filename: string,
  rows: ImportRow[],
): Promise<(ActionResult & { summary?: ImportSummary })> {
  if (rows.length === 0) return { ok: false, error: "No rows to import" };
  if (rows.length > 5000) return { ok: false, error: "Import is limited to 5,000 rows per file" };

  const seen = new Set<string>();
  const valid: ImportRow[] = [];
  let invalid = 0;
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase() ?? "";
    if (!EMAIL_RE.test(email) || seen.has(email)) {
      invalid++;
      continue;
    }
    seen.add(email);
    valid.push({
      email,
      firstName: row.firstName?.trim() ?? "",
      lastName: row.lastName?.trim() ?? "",
      jobTitle: row.jobTitle?.trim() ?? "",
      companyName: row.companyName?.trim() ?? "",
      companyIndustry: row.companyIndustry?.trim() ?? "",
      linkedinUrl: row.linkedinUrl?.trim() ?? "",
    });
  }
  if (valid.length === 0) return { ok: false, error: "No rows with a valid email address" };

  const { count } = await prisma.lead.createMany({
    data: valid.map((v) => ({ ...v, source: filename })),
    skipDuplicates: true,
  });

  await prisma.csvImportBatch.create({
    data: {
      filename,
      rowCount: rows.length,
      importedCount: count,
      skippedCount: rows.length - count,
    },
  });

  revalidatePath("/");
  return {
    ok: true,
    summary: { imported: count, duplicates: valid.length - count, invalid },
  };
}

/**
 * Deletes an import batch's history entry and every lead still tagged with
 * that filename (their drafts/send jobs cascade). Leads are only linked to a
 * batch by filename — re-importing the same filename later would be caught
 * by the same deletion, which is the intended, if coarse, behavior.
 */
export async function deleteImportBatch(
  batchId: string,
): Promise<ActionResult & { deletedLeads?: number }> {
  const batch = await prisma.csvImportBatch.findUnique({ where: { id: batchId } });
  if (!batch) return { ok: false, error: "Import batch not found" };

  const deletedLeads = await prisma.$transaction(async (tx) => {
    const { count } = await tx.lead.deleteMany({ where: { source: batch.filename } });
    await tx.csvImportBatch.delete({ where: { id: batchId } });
    return count;
  });

  revalidatePath("/import");
  revalidatePath("/");
  return {
    ok: true,
    deletedLeads,
    message: `Deleted "${batch.filename}" and ${deletedLeads} lead${deletedLeads === 1 ? "" : "s"}`,
  };
}
