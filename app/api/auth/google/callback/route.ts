import { NextResponse, type NextRequest } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { getOAuthClient } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const settingsUrl = (params: string) => new URL(`/settings${params}`, url.origin);

  if (!code) {
    return NextResponse.redirect(settingsUrl("?error=Google%20authorization%20was%20denied"));
  }

  try {
    const auth = getOAuthClient();
    const { tokens } = await auth.getToken(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        settingsUrl("?error=Google%20did%20not%20return%20a%20refresh%20token%20—%20remove%20the%20app%20from%20your%20Google%20account%20permissions%20and%20try%20again"),
      );
    }
    auth.setCredentials(tokens);

    const gmail = google.gmail({ version: "v1", auth });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const email = profile.data.emailAddress ?? "";

    await prisma.gmailAccount.upsert({
      where: { id: "singleton" },
      update: { email, refreshTokenEnc: encrypt(tokens.refresh_token) },
      create: { id: "singleton", email, refreshTokenEnc: encrypt(tokens.refresh_token) },
    });

    return NextResponse.redirect(settingsUrl("?connected=1"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth exchange failed";
    return NextResponse.redirect(settingsUrl(`?error=${encodeURIComponent(message)}`));
  }
}
