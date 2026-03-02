/**
 * Exam heartbeat API – server-authoritative session keepalive and timer sync.
 * Called every 5 seconds from the exam client. Updates last_activity_at and
 * session_security.last_verified; returns server-calculated time_remaining
 * so the client cannot pause or extend the exam.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

const HEARTBEAT_GRACE_SECONDS = 20; // Consider disconnected if no heartbeat for this long

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, securityToken, timeRemaining: clientTimeRemaining } = body as {
      sessionId?: string;
      securityToken?: string;
      timeRemaining?: number;
    };

    if (!sessionId || !securityToken) {
      return NextResponse.json(
        { error: "sessionId and securityToken required" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    // Fetch session; timer is server-based using end_time only (never store or trust time_left).
    const { data: session, error: sessionError } = await admin
      .from("exam_sessions")
      .select(
        "id, exam_id, student_id, status, started_at, end_time, extra_time_seconds, security_token, risk_count"
      )
      .eq("id", sessionId)
      .eq("security_token", securityToken)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Invalid session or token" }, { status: 401 });
    }

    if (session.status !== "in_progress") {
      return NextResponse.json(
        { error: "Session not in progress", status: session.status, expired: true },
        { status: 200 }
      );
    }

    // Server-only remaining time: use end_time when set, else fallback to started_at + duration (legacy).
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

    // Auto-submit when time is up: return expired so client can submit
    if (serverTimeRemaining <= 0) {
      return NextResponse.json({
        ok: true,
        serverTime: now,
        serverTimeRemaining: 0,
        expired: true,
        risk_count: session.risk_count ?? 0,
        max_risk_before_submit: maxRiskBeforeSubmit,
      });
    }

    // Update last activity only. NEVER store time_remaining — timer is always end_time - now().
    const isoNow = new Date().toISOString();
    await Promise.all([
      admin
        .from("exam_sessions")
        .update({
          last_activity_at: isoNow,
          updated_at: isoNow,
        })
        .eq("id", sessionId)
        .eq("security_token", securityToken),
      admin
        .from("session_security")
        .update({ last_verified: isoNow })
        .eq("session_id", sessionId)
        .eq("token", securityToken),
    ]);

    return NextResponse.json({
      ok: true,
      serverTime: now,
      serverTimeRemaining,
      expired: false,
      risk_count: session.risk_count ?? 0,
      max_risk_before_submit: maxRiskBeforeSubmit,
    });
  } catch (e) {
    console.error("[heartbeat]", e);
    return NextResponse.json({ error: "Heartbeat failed" }, { status: 500 });
  }
}
