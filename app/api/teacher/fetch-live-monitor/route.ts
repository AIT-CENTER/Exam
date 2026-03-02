/**
 * Teacher live monitor API – fetches active exam sessions and recent risk logs.
 * Only returns in_progress sessions (submitted = false). Max 10 flagged students.
 * Poll every 5 seconds for live updates.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

const MAX_FLAGGED = 10;
const RISK_LOGS_LIMIT = 20;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId") || undefined;

    const admin = supabaseAdmin();

    // Fetch only active (in_progress) sessions, exclude hidden_from_monitor
    let sessionsQuery = admin
      .from("exam_sessions")
      .select(
        `
        id,
        student_id,
        exam_id,
        teacher_id,
        status,
        started_at,
        end_time,
        last_activity_at,
        extra_time_seconds,
        score,
        risk_score,
        risk_count,
        students (name, student_id),
        exams (title, duration)
      `
      )
      .eq("status", "in_progress")
      .eq("hidden_from_monitor", false);

    if (teacherId) {
      sessionsQuery = sessionsQuery.eq("teacher_id", teacherId);
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery;

    if (sessionsError) {
      console.error("[fetch-live-monitor] sessions:", sessionsError);
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        sessions: [],
        riskLogs: [],
      });
    }

    const sessionIds = sessions.map((s: { id: string }) => s.id);
    const now = Date.now();
    const DISCONNECT_THRESHOLD_SEC = 25;

    let maxRiskBeforeSubmit = 7;
    const { data: settings } = await admin.from("system_settings").select("max_risk_before_submit").limit(1).maybeSingle();
    if (settings?.max_risk_before_submit != null) maxRiskBeforeSubmit = Number(settings.max_risk_before_submit);

    const liveSessions = sessions.map((session: any) => {
      const lastActivity = session.last_activity_at ? new Date(session.last_activity_at).getTime() : 0;
      const secSinceActivity = (now - lastActivity) / 1000;
      const statusLabel = secSinceActivity > DISCONNECT_THRESHOLD_SEC ? "Disconnected" : "Active";

      const startedAt = session.started_at ? new Date(session.started_at).getTime() : now;
      const exam = session.exams || { title: "Unknown Exam", duration: 60 };
      const durationMinutes = exam.duration ?? 60;
      let remainingSeconds = 0;
      if (session.end_time) {
        const endMs = new Date(session.end_time).getTime();
        remainingSeconds = Math.max(0, Math.floor((endMs - now) / 1000));
      } else {
        const totalSeconds = durationMinutes * 60 + (session.extra_time_seconds || 0);
        const elapsedSeconds = Math.floor((now - startedAt) / 1000);
        remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
      }

    const riskCount = session.risk_count ?? 0;
    const riskScore = session.risk_score ?? 0;
    const isFlagged = riskCount > 0 || riskScore > 0 || statusLabel === "Disconnected";

    return {
      sessionId: session.id,
      studentId: session.students?.student_id || "Unknown",
      name: session.students?.name || "Unknown",
      examId: session.exam_id,
      examName: exam.title || "Unknown Exam",
      status: statusLabel,
      remainingTime: remainingSeconds,
      score: session.score || 0,
      startedAt: session.started_at ? new Date(session.started_at).toISOString() : new Date(now).toISOString(),
      examDurationMinutes: durationMinutes,
      extraTimeSeconds: session.extra_time_seconds || 0,
      timeRemainingSeconds: remainingSeconds,
      riskScore,
      riskCount,
      maxRiskBeforeSubmit,
      lastActivityAt: session.last_activity_at ?? null,
      isFlagged,
    };
    });

    // Sort: flagged first, then by remaining time
    liveSessions.sort((a: { isFlagged: boolean }, b: { isFlagged: boolean }) =>
      (a.isFlagged ? 0 : 1) - (b.isFlagged ? 0 : 1)
    );

    // Limit to max 10 flagged + all non-flagged (or max 10 total if all flagged)
    const flagged = liveSessions.filter((s: { isFlagged: boolean }) => s.isFlagged);
    const nonFlagged = liveSessions.filter((s: { isFlagged: boolean }) => !s.isFlagged);
    const limitedFlagged = flagged.slice(0, MAX_FLAGGED);
    const displaySessions = [...limitedFlagged, ...nonFlagged];

    // Fetch recent risk logs for these sessions
    const { data: riskLogs, error: logsError } = await admin
      .from("exam_risk_logs")
      .select("id, session_id, student_id, exam_id, event_type, timestamp")
      .in("session_id", sessionIds)
      .order("timestamp", { ascending: false })
      .limit(RISK_LOGS_LIMIT);

    if (logsError) {
      console.error("[fetch-live-monitor] risk logs:", logsError);
    }

    return NextResponse.json({
      sessions: displaySessions,
      riskLogs: riskLogs ?? [],
    });
  } catch (e) {
    console.error("[fetch-live-monitor]", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}
