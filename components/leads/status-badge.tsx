import type { LeadStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant="outline" className={cn("font-mono text-[11px] font-medium", meta.badge, className)}>
      {meta.label}
    </Badge>
  );
}
