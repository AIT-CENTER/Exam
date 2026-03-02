/**
 * Exam activity log API – records security-relevant student actions.
 * IMPORTANT: Risk count increments ONLY on tab exit (use /api/exam/increment-risk).
 * Fullscreen exit does NOT increment risk; first exit shows warning only.
 * Logs: fullscreen_exit (warning), disconnect, device_change for audit.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, securityToken, eventType, metadata } = body as {
      sessionId?: string;
      securityToken?: string;
      eventType?: string;
      metadata?: Record<string, unknown>;
    };

    if (!sessionId || !securityToken || !eventType) {
      return NextResponse.json(
        { error: "sessionId, securityToken, and eventType required" },
        { status: 400 }
      );
    }

    const allowed = [
      "tab_switch",
      "fullscreen_exit",
      "device_change",
      "heartbeat_fail",
      "disconnect",
      "reconnect",
    ];
    if (!allowed.includes(eventType)) {
      return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: session, error: sessionError } = await admin
      .from("exam_sessions")
      .select("id, student_id, exam_id, teacher_id, status, fullscreen_exit_count")
      .eq("id", sessionId)
      .eq("security_token", securityToken)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Invalid session or token" }, { status: 401 });
    }

    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "Session not in progress" }, { status: 400 });
    }

    // Insert activity_logs for audit
    await admin.from("activity_logs").insert({
      session_id: sessionId,
      student_id: session.student_id,
      exam_id: session.exam_id,
      event_type: eventType,
      metadata: metadata ?? null,
    });

    // Fullscreen exit: NEVER increments risk. First exit = warning only.
    if (eventType === "fullscreen_exit") {
      const fullscreenExitCount = session.fullscreen_exit_count ?? 0;
      const isFirstFullscreenExit = fullscreenExitCount === 0;

      if (isFirstFullscreenExit) {
        await admin.from("exam_sessions").update({
          fullscreen_exit_count: 1,
          updated_at: new Date().toISOString(),
        }).eq("id", sessionId);
      }
      return NextResponse.json({ ok: true, firstExit: isFirstFullscreenExit, autoSubmitted: false });
    }

    // disconnect, device_change: log to exam_risk_logs for admin visibility (no risk increment)
    if (eventType === "disconnect" || eventType === "device_change") {
      try {
        await admin.from("exam_risk_logs").insert({
          session_id: sessionId,
          student_id: session.student_id,
          exam_id: session.exam_id,
          event_type: eventType,
          timestamp: new Date().toISOString(),
        });
      } catch { /* table may not exist yet */ }
    }

    return NextResponse.json({ ok: true, autoSubmitted: false });
  } catch (e) {
    console.error("[activity]", e);
    return NextResponse.json({ error: "Activity log failed" }, { status: 500 });
  }
}
