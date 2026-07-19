"use client";

import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeadDTO } from "@/lib/lead-dto";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/leads/status-badge";

function sortHeader(label: string) {
  // eslint-disable-next-line react/display-name
  return ({ column }: { column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => (
    <button
      type="button"
      className="flex items-center gap-1 text-left font-medium hover:text-foreground"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="size-3 opacity-50" />
    </button>
  );
}

export function LeadsTable({
  leads,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  onOpenLead,
}: {
  leads: LeadDTO[];
  sorting: SortingState;
  onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => void;
  onOpenLead: (id: string) => void;
}) {
  const columns = useMemo<ColumnDef<LeadDTO>[]>(
    () => [
      {
        id: "select",
        size: 32,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={!table.getIsAllPageRowsSelected() && table.getIsSomePageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        ),
      },
      {
        id: "name",
        accessorFn: (l) => `${l.firstName} ${l.lastName}`.trim() || l.email,
        header: sortHeader("Name"),
        cell: ({ row }) => {
          const l = row.original;
          const name = `${l.firstName} ${l.lastName}`.trim();
          return (
            <div className="min-w-0">
              <p className="truncate font-medium">{name || "—"}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{l.email}</p>
            </div>
          );
        },
      },
      {
        id: "company",
        accessorFn: (l) => l.companyName,
        header: sortHeader("Company"),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate">{row.original.companyName || "—"}</p>
            {row.original.companyIndustry && (
              <p className="truncate text-xs text-muted-foreground">
                {row.original.companyIndustry}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "jobTitle",
        accessorFn: (l) => l.jobTitle,
        header: sortHeader("Job title"),
        cell: ({ row }) => (
          <span className="line-clamp-2 text-sm">{row.original.jobTitle || "—"}</span>
        ),
      },
      {
        id: "status",
        accessorFn: (l) => l.status,
        header: sortHeader("Status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "lastContactedAt",
        accessorFn: (l) => l.lastContactedAt ?? "",
        header: sortHeader("Contacted"),
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.lastContactedAt)}
          </span>
        ),
      },
      {
        id: "reply",
        header: () => "Reply",
        cell: ({ row }) =>
          row.original.replySnippet ? (
            <span className="line-clamp-2 max-w-56 text-xs text-muted-foreground italic">
              “{row.original.replySnippet}”
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50">—</span>
          ),
      },
      {
        id: "linkedin",
        size: 36,
        header: () => null,
        cell: ({ row }) =>
          row.original.linkedinUrl ? (
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={
                <a
                  href={row.original.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Open LinkedIn profile"
                />
              }
            >
              <ExternalLink className="size-3.5" />
            </Button>
          ) : null,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting, rowSelection },
    onSortingChange,
    onRowSelectionChange,
    getRowId: (l) => l.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
  });

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} className="text-xs">
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                No leads match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() => onOpenLead(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    // The select checkbox renders a hidden native <input> alongside the
                    // visible one for form semantics; it dispatches its own bubbling click
                    // that a stopPropagation on the checkbox itself doesn't catch. Stopping
                    // it here, on the cell, catches it regardless of that internal detail.
                    onClick={cell.column.id === "select" ? (e) => e.stopPropagation() : undefined}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
