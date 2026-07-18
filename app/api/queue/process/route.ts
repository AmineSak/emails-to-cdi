import { NextResponse, type NextRequest } from "next/server";
import { processDueJobs } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Called by the in-app poller while the app is open. */
export async function POST() {
  const result = await processDueJobs();
  return NextResponse.json(result);
}

/** Called by Vercel Cron (see vercel.json) so the queue drains even when no tab is open. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processDueJobs();
  return NextResponse.json(result);
}
