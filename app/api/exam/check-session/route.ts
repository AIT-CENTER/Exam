/**
 * Check for an existing active exam session (student_id + exam_id).
 * Used on index (/) login: if an in_progress session exists, reuse it instead of creating a new one.
 * Enforces single active session per student per exam.
 * Security: server-only; uses service role. Do not trust frontend for session existence.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const studentId = body.studentId ?? body.student_id;
    const examId = body.examId ?? body.exam_id;
    const deviceFingerprint = body.deviceFingerprint ?? body.device_fingerprint;

    if (studentId == null || examId == null) {
      return NextResponse.json(
        { error: "studentId and examId required" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    // Find exactly one in_progress session for this student + exam (DB allows at most one via unique index).
    const { data: session, error } = await admin
      .from("exam_sessions")
      .select("id, security_token, started_at, end_time, status")
      .eq("student_id", Number(studentId))
      .eq("exam_id", Number(examId))
      .eq("status", "in_progress")
      .maybeSingle();

    if (error) {
      console.error("[check-session]", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ exists: false });
    }

    // Optionally determine if current device already has this session (for resume vs takeover UI).
    let isSameDevice = false;
    if (deviceFingerprint) {
      const { data: sec } = await admin
        .from("session_security")
        .select("id")
        .eq("session_id", session.id)
        .eq("device_fingerprint", deviceFingerprint)
        .eq("is_active", true)
        .maybeSingle();
      isSameDevice = !!sec;
    }

    const endMs = session.end_time ? new Date(session.end_time).getTime() : Date.now() + 3600000;
    const timeRemaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
    return NextResponse.json({
      exists: true,
      isSameDevice,
      session: {
        id: session.id,
        security_token: session.security_token,
        started_at: session.started_at,
        end_time: session.end_time,
        time_remaining: timeRemaining,
        status: session.status,
      },
    });
  } catch (e) {
    console.error("[check-session]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
