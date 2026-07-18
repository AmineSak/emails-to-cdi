"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import { ArrowRight, FileSpreadsheet, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { importLeads, type ImportRow } from "@/app/actions/import";

type Field = keyof ImportRow;

const FIELDS: { key: Field; label: string; required?: boolean; hints: string[] }[] = [
  { key: "email", label: "Email", required: true, hints: ["email", "e-mail", "mail"] },
  { key: "firstName", label: "First name", hints: ["first name", "firstname", "first", "prénom", "prenom", "given"] },
  { key: "lastName", label: "Last name", hints: ["last name", "lastname", "last", "nom", "surname", "family"] },
  { key: "jobTitle", label: "Job title", hints: ["title", "job title", "jobtitle", "poste", "position", "role", "fonction"] },
  { key: "companyName", label: "Company", hints: ["company", "company name", "entreprise", "organization", "organisation", "account"] },
  { key: "companyIndustry", label: "Industry", hints: ["industry", "industrie", "secteur", "sector"] },
  { key: "linkedinUrl", label: "LinkedIn URL", hints: ["linkedin", "person linkedin url", "linkedin url", "profile url"] },
];

const IGNORE = "__ignore__";

function guessMapping(headers: string[]): Record<Field, string> {
  const mapping = {} as Record<Field, string>;
  const taken = new Set<string>();
  for (const field of FIELDS) {
    const found = field.hints
      .map((hint) => headers.find((h) => !taken.has(h) && h.trim().toLowerCase() === hint))
      .find(Boolean) ??
      field.hints
        .map((hint) => headers.find((h) => !taken.has(h) && h.trim().toLowerCase().includes(hint)))
        .find(Boolean);
    mapping[field.key] = found ?? IGNORE;
    if (found) taken.add(found);
  }
  return mapping;
}

type Batch = {
  id: string;
  filename: string;
  rowCount: number;
  importedCount: number;
  skippedCount: number;
  importedAt: string;
};

export function ImportWizard({ history }: { history: Batch[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<Field, string>>(() => guessMapping([]));
  const [pending, startTransition] = useTransition();

  function parseFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (result) => {
        const fields = result.meta.fields ?? [];
        if (fields.length === 0 || result.data.length === 0) {
          toast.error("Could not read any rows from this file");
          return;
        }
        setFilename(file.name);
        setHeaders(fields);
        setRows(result.data);
        setMapping(guessMapping(fields));
      },
      error: () => toast.error("Failed to parse this file as CSV"),
    });
  }

  const preview = useMemo(() => rows.slice(0, 5), [rows]);
  const emailMapped = mapping.email !== IGNORE;

  function reset() {
    setFilename(null);
    setHeaders([]);
    setRows([]);
  }

  function runImport() {
    const mapped: ImportRow[] = rows.map((row) => ({
      email: row[mapping.email] ?? "",
      firstName: mapping.firstName !== IGNORE ? (row[mapping.firstName] ?? "") : "",
      lastName: mapping.lastName !== IGNORE ? (row[mapping.lastName] ?? "") : "",
      jobTitle: mapping.jobTitle !== IGNORE ? (row[mapping.jobTitle] ?? "") : "",
      companyName: mapping.companyName !== IGNORE ? (row[mapping.companyName] ?? "") : "",
      companyIndustry: mapping.companyIndustry !== IGNORE ? (row[mapping.companyIndustry] ?? "") : "",
      linkedinUrl: mapping.linkedinUrl !== IGNORE ? (row[mapping.linkedinUrl] ?? "") : "",
    }));
    startTransition(async () => {
      const res = await importLeads(filename ?? "import.csv", mapped);
      if (res.ok && res.summary) {
        const { imported, duplicates, invalid } = res.summary;
        toast.success(`${imported} lead${imported === 1 ? "" : "s"} imported`, {
          description: [
            duplicates > 0 && `${duplicates} already existed`,
            invalid > 0 && `${invalid} row${invalid > 1 ? "s" : ""} without a valid email`,
          ]
            .filter(Boolean)
            .join(" · "),
        });
        router.push("/");
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  if (!filename) {
    return (
      <div className="flex flex-col gap-6">
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) parseFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex w-full flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/40"
        >
          <FileSpreadsheet className="size-7" />
          <span className="text-sm">
            Click to choose a CSV file
            <span className="block text-xs">
              Expected columns: email, first/last name, job title, company, industry, LinkedIn
            </span>
          </span>
        </button>

        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Previous imports</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead className="text-right">Imported</TableHead>
                    <TableHead className="text-right">Skipped</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.filename}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{b.rowCount}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{b.importedCount}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{b.skippedCount}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {new Date(b.importedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-mono text-sm">{filename}</CardTitle>
              <CardDescription>
                {rows.length.toLocaleString()} rows · map each app field to a CSV column
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="size-4" /> Choose another file
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive"> *</span>}
                </span>
                <Select
                  items={{
                    [IGNORE]: "— not in this file —",
                    ...Object.fromEntries(headers.map((h) => [h, h])),
                  }}
                  value={mapping[field.key]}
                  onValueChange={(v) =>
                    setMapping((m) => ({ ...m, [field.key]: v ?? IGNORE }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={IGNORE}>— not in this file —</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {!emailMapped && (
            <p className="text-xs text-destructive">
              Map the Email field to continue — it is how duplicates are detected.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>First {preview.length} rows as they will be imported.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {FIELDS.map((f) => (
                  <TableHead key={f.key}>{f.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((row, i) => (
                <TableRow key={i}>
                  {FIELDS.map((f) => (
                    <TableCell key={f.key} className="max-w-40 truncate font-mono text-xs">
                      {mapping[f.key] !== IGNORE ? (row[mapping[f.key]] ?? "") : ""}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={!emailMapped || pending} onClick={runImport}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Import {rows.length.toLocaleString()} rows
        </Button>
      </div>
    </div>
  );
}
