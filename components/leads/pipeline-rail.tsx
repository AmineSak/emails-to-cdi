"use client";

import type { LeadStatus } from "@prisma/client";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * The funnel as a single proportional rail. Each segment's width encodes how
 * many leads sit at that stage; clicking a segment filters the table.
 */
export function PipelineRail({
  counts,
  active,
  onToggle,
}: {
  counts: Record<LeadStatus, number>;
  active: LeadStatus | null;
  onToggle: (status: LeadStatus) => void;
}) {
  const present = STATUS_ORDER.filter((s) => counts[s] > 0);
  const total = present.reduce((sum, s) => sum + counts[s], 0);
  if (total === 0) return null;

  return (
    <div className="flex h-14 w-full items-stretch gap-px overflow-hidden rounded-md border bg-border">
      {present.map((status) => {
        const meta = STATUS_META[status];
        const pct = (counts[status] / total) * 100;
        const isActive = active === status;
        const dimmed = active !== null && !isActive;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onToggle(status)}
            title={`${meta.label} — ${counts[status]}`}
            style={{ width: `${pct}%` }}
            className={cn(
              "group relative min-w-9 bg-card text-left transition-opacity focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring",
              dimmed && "opacity-40",
            )}
            aria-pressed={isActive}
          >
            <span className={cn("absolute inset-x-0 top-0 h-1.5", meta.rail)} />
            <span className="absolute inset-x-0 bottom-0 flex flex-col px-2 pb-1.5">
              <span className="font-mono text-sm leading-none font-semibold tabular-nums">
                {counts[status]}
              </span>
              <span className="mt-0.5 truncate text-[10px] tracking-wide text-muted-foreground uppercase">
                {meta.label}
              </span>
            </span>
            <span
              className={cn(
                "absolute inset-0 transition-colors",
                isActive ? "bg-accent/50" : "group-hover:bg-accent/30",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
