import type { LeadStatus } from "@prisma/client";

export type DraftDTO = {
  subject: string;
  body: string;
  model: string;
  generatedAt: string;
  sentAt: string | null;
};

export type LeadDTO = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  companyName: string;
  companyIndustry: string;
  linkedinUrl: string;
  source: string;
  status: LeadStatus;
  notes: string;
  lastContactedAt: string | null;
  lastRepliedAt: string | null;
  replySnippet: string | null;
  createdAt: string;
  draft: DraftDTO | null;
};

export type DashboardMeta = {
  gmailConnected: boolean;
  gmailEmail: string | null;
  hasResume: boolean;
  sentToday: number;
  dailySendCap: number;
  queuedCount: number;
};
