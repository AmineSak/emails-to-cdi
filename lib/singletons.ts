import { prisma } from "@/lib/prisma";

// Single-user app: ResumeProfile, AppSettings and GmailAccount each have at
// most one row, keyed by id "singleton".

export function getProfile() {
  return prisma.resumeProfile.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export function getSettings() {
  return prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export function getGmailAccount() {
  return prisma.gmailAccount.findUnique({ where: { id: "singleton" } });
}
