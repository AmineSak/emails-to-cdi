import type { LeadStatus } from "@prisma/client";

export type StatusMeta = {
  label: string;
  // Badge classes
  badge: string;
  // Solid color for the pipeline rail segments
  rail: string;
};

export const STATUS_ORDER: LeadStatus[] = [
  "NOT_CONTACTED",
  "DRAFTED",
  "QUEUED",
  "SENT",
  "REPLIED",
  "INTERVIEW",
  "REJECTED",
  "NO_RESPONSE",
  "BOUNCED",
];

export const STATUS_META: Record<LeadStatus, StatusMeta> = {
  NOT_CONTACTED: {
    label: "Not contacted",
    badge: "bg-muted text-muted-foreground border-transparent",
    rail: "bg-neutral-300",
  },
  DRAFTED: {
    label: "Drafted",
    badge: "bg-amber-500/15 text-amber-800 border-amber-600/20",
    rail: "bg-amber-500",
  },
  QUEUED: {
    label: "Queued",
    badge: "bg-primary/5 text-primary border-primary/30 border-dashed",
    rail: "bg-indigo-300",
  },
  SENT: {
    label: "Sent",
    badge: "bg-primary/10 text-primary border-primary/20",
    rail: "bg-primary",
  },
  REPLIED: {
    label: "Replied",
    badge: "bg-teal-600/15 text-teal-800 border-teal-700/20",
    rail: "bg-teal-600",
  },
  INTERVIEW: {
    label: "Interview",
    badge: "bg-green-600/15 text-green-800 border-green-700/25",
    rail: "bg-green-600",
  },
  REJECTED: {
    label: "Rejected",
    badge: "bg-red-700/10 text-red-800 border-red-700/20",
    rail: "bg-red-700",
  },
  NO_RESPONSE: {
    label: "No response",
    badge: "bg-muted text-muted-foreground/70 border-border",
    rail: "bg-neutral-400",
  },
  BOUNCED: {
    label: "Bounced",
    badge: "bg-red-700/5 text-red-700 border-red-700/30 border-dashed",
    rail: "bg-red-400",
  },
};
