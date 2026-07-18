import { prisma } from "@/lib/prisma";
import { ImportWizard } from "@/components/import/import-wizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [batches, leadCounts] = await Promise.all([
    prisma.csvImportBatch.findMany({
      orderBy: { importedAt: "desc" },
      take: 10,
    }),
    prisma.lead.groupBy({ by: ["source"], _count: { _all: true } }),
  ]);
  const leadCountBySource = new Map(leadCounts.map((c) => [c.source, c._count._all]));

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Import CSV</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bring in leads from Apollo or any CSV export. Headers are matched automatically — adjust
          the mapping before importing. Existing emails are skipped.
        </p>
      </header>

      <ImportWizard
        history={batches.map((b) => ({
          id: b.id,
          filename: b.filename,
          rowCount: b.rowCount,
          importedCount: b.importedCount,
          skippedCount: b.skippedCount,
          importedAt: b.importedAt.toISOString(),
          currentLeadCount: leadCountBySource.get(b.filename) ?? 0,
        }))}
      />
    </div>
  );
}
