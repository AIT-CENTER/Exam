/**
 * Cron: auto-submit exam sessions that have passed their end time.
 * Called by Vercel Cron every minute, or manually with CRON_SECRET.
 * Ensures disconnected students get auto-submitted when exam time reaches 00.
 */

import { NextRequest, NextResponse } from "next/server";
import { autoSubmitExpiredSessions } from "@/lib/autoSubmitExpiredSessions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { processed } = await autoSubmitExpiredSessions();
    return NextResponse.json({ processed, ok: true });
  } catch (e) {
    console.error("[auto-submit]", e);
    return NextResponse.json(
      { error: "Auto-submit failed" },
      { status: 500 }
    );
  }
}