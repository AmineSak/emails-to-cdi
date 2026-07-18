import { NextResponse, type NextRequest } from "next/server";
import { getAuthUrl } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  try {
    return NextResponse.redirect(getAuthUrl());
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth configuration error";
    // Base the fallback on the actual incoming request, not a hardcoded origin —
    // otherwise a misconfigured env var sends real users to localhost.
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(message)}`, req.url));
  }
}
