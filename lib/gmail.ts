import { google, type gmail_v1 } from "googleapis";
import type { ResumeProfile } from "@prisma/client";
import { decrypt } from "@/lib/crypto";
import { getGmailAccount } from "@/lib/singletons";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export function getOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error("Google OAuth env vars are not set (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI)");
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

export function getAuthUrl(): string {
  return getOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
  });
}

/** Returns an authenticated Gmail client for the connected account, or null if not connected. */
export async function getGmail(): Promise<{ gmail: gmail_v1.Gmail; email: string } | null> {
  const account = await getGmailAccount();
  if (!account) return null;
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: decrypt(account.refreshTokenEnc) });
  return { gmail: google.gmail({ version: "v1", auth }), email: account.email };
}

function encodeHeaderUtf8(value: string): string {
  // RFC 2047 encoded-word, needed for accented subjects/names
  return /^[\x20-\x7E]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export function buildMime(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachment?: { filename: string; contentType: string; data: Buffer };
}): string {
  const { from, to, subject, text, attachment } = opts;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeaderUtf8(subject)}`,
    `MIME-Version: 1.0`,
  ];
  let mime: string;
  if (attachment) {
    const boundary = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    mime = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(text, "utf8").toString("base64"),
      ``,
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      attachment.data.toString("base64"),
      ``,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    mime = [
      ...headers,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(text, "utf8").toString("base64"),
    ].join("\r\n");
  }
  return Buffer.from(mime, "utf8").toString("base64url");
}

export type ResumeAttachment = { filename: string; contentType: string; data: Buffer };

/** Builds the resume attachment for an outgoing email, or undefined if none is on file. */
export function resumeAttachment(
  profile: Pick<ResumeProfile, "resumePdf" | "resumeFileName">,
): ResumeAttachment | undefined {
  if (!profile.resumePdf || !profile.resumeFileName) return undefined;
  return {
    filename: profile.resumeFileName,
    contentType: "application/pdf",
    data: Buffer.from(profile.resumePdf),
  };
}

export async function sendMessage(
  gmail: gmail_v1.Gmail,
  raw: string,
): Promise<{ id: string; threadId: string }> {
  const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return { id: res.data.id ?? "", threadId: res.data.threadId ?? "" };
}

export type ThreadReply = { snippet: string; fromMailerDaemon: boolean; date: Date };

/** Checks a thread for messages other than the one we sent. */
export async function findReplyInThread(
  gmail: gmail_v1.Gmail,
  threadId: string,
  sentMessageId: string | null,
): Promise<ThreadReply | null> {
  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
    metadataHeaders: ["From"],
  });
  const messages = res.data.messages ?? [];
  const replies = messages.filter(
    (m) => m.id !== sentMessageId && !(m.labelIds ?? []).includes("SENT"),
  );
  if (replies.length === 0) return null;
  const last = replies[replies.length - 1];
  const from =
    last.payload?.headers?.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
  return {
    snippet: last.snippet ?? "",
    fromMailerDaemon: /mailer-daemon|postmaster/i.test(from),
    date: last.internalDate ? new Date(Number(last.internalDate)) : new Date(),
  };
}
