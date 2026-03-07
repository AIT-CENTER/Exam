/**
 * Teacher add time to exam session. Respects admin max_time_extension_minutes.
 * Updates end_time (extends by minutes) so timer never pauses.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, minutes } = body as { sessionId?: string; minutes?: number };

    if (!sessionId || minutes == null || minutes < 0) {
      return NextResponse.json(
        { error: "sessionId and minutes (>= 0) required" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    const { data: settings } = await admin
      .from("system_settings")
      .select("max_time_extension_minutes")
      .eq("id", 1)
      .maybeSingle();

    const maxExtensionMinutes = Math.max(1, Number(settings?.max_time_extension_minutes ?? 30));

    const { data: session, error: sessionError } = await admin
      .from("exam_sessions")
      .select("id, end_time, extra_time_seconds, status")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "Cannot add time to completed exam" }, { status: 400 });
    }

    const currentExtra = Number(session.extra_time_seconds ?? 0);
    const requestedExtra = Math.floor(Number(minutes) * 60);
    const maxExtraAllowed = maxExtensionMinutes * 60;
    const remainingAllowance = Math.max(0, maxExtraAllowed - currentExtra);
    const actualExtra = Math.min(Math.max(0, requestedExtra), remainingAllowance);

    if (actualExtra <= 0) {
      return NextResponse.json({
        error: `Cannot add more time. Max extension (${maxExtensionMinutes} min) reached for this student.`,
      }, { status: 400 });
    }

    // Defensive: ensure total extra time never exceeds admin limit
    const newExtraTimeSeconds = Math.min(currentExtra + actualExtra, maxExtraAllowed);

    const now = new Date();
    const currentEnd = session.end_time ? new Date(session.end_time) : now;
    const baseTime = currentEnd.getTime() > now.getTime() ? currentEnd : now;
    const newEndTime = new Date(baseTime.getTime() + actualExtra * 1000).toISOString();

    const { error: updateError } = await admin
      .from("exam_sessions")
      .update({
        end_time: newEndTime,
        extra_time_seconds: newExtraTimeSeconds,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      addedMinutes: actualExtra / 60,
      totalExtraMinutes: newExtraTimeSeconds / 60,
    });
  } catch (e) {
    console.error("[add-time]", e);
    return NextResponse.json({ error: "Add time failed" }, { status: 500 });
  }
}
