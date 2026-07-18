import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.redirect(getAuthUrl());
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth configuration error";
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(message)}`, process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000"),
    );
  }
}
