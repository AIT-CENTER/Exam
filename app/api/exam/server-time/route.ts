/**
 * Server-time API – returns server timestamp and server-calculated time_remaining
 * for an exam session. Use for initial sync and periodic sync so the timer
 * cannot be paused or manipulated client-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const securityToken = searchParams.get("securityToken");

    if (!sessionId || !securityToken) {
      return NextResponse.json(
        { error: "sessionId and securityToken required" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    const { data: session, error: sessionError } = await admin
      .from("exam_sessions")
      .select("id, exam_id, status, started_at, end_time, extra_time_seconds, instruction_seen, risk_count")
      .eq("id", sessionId)
      .eq("security_token", securityToken)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Invalid session or token" }, { status: 401 });
    }

    if (session.status !== "in_progress") {
      return NextResponse.json({
        serverTime: Date.now(),
        serverTimeRemaining: 0,
        status: session.status,
        expired: true,
      });
    }

    // Server-only remaining: use end_time when set (timer never pauses on server).
    const now = Date.now();
    let serverTimeRemaining: number;
    if (session.end_time) {
      const endMs = new Date(session.end_time).getTime();
      serverTimeRemaining = Math.max(0, Math.floor((endMs - now) / 1000));
    } else {
      const { data: exam } = await admin
        .from("exams")
        .select("duration")
        .eq("id", session.exam_id)
        .single();
      const durationMinutes = exam?.duration ?? 60;
      const extraSeconds = session.extra_time_seconds ?? 0;
      const totalSeconds = durationMinutes * 60 + extraSeconds;
      const startedAt = new Date(session.started_at).getTime();
      const elapsedSeconds = Math.floor((now - startedAt) / 1000);
      serverTimeRemaining = Math.max(0, totalSeconds - elapsedSeconds);
    }

    let maxRiskBeforeSubmit = 7;
    const { data: settings } = await admin
      .from("system_settings")
      .select("max_risk_before_submit")
      .limit(1)
      .maybeSingle();
    if (settings?.max_risk_before_submit != null) {
      maxRiskBeforeSubmit = Number(settings.max_risk_before_submit);
    }

    return NextResponse.json({
      serverTime: now,
      serverTimeRemaining,
      status: session.status,
      expired: serverTimeRemaining <= 0,
      instruction_seen: session.instruction_seen ?? false,
      risk_count: session.risk_count ?? 0,
      max_risk_before_submit: maxRiskBeforeSubmit,
    });
  } catch (e) {
    console.error("[server-time]", e);
    return NextResponse.json({ error: "Server time failed" }, { status: 500 });
  }
}
