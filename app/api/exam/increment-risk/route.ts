/**
 * Increment risk_count ONLY on tab exit (visibility change).
 * Fullscreen exit does NOT increment risk. One increment per tab exit; deduplicated
 * to prevent rapid duplicate counts if student quickly switches tabs.
 * Auto-submit when risk_count >= max_risk_before_submit.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

const TAB_SWITCH_DEBOUNCE_MS = 3000; // Only count one tab switch per 3 seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, securityToken } = body as {
      sessionId?: string;
      securityToken?: string;
    };

    if (!sessionId || !securityToken) {
      return NextResponse.json(
        { error: "sessionId and securityToken required" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    const { data: session, error: sessionError } = await admin
      .from("exam_sessions")
      .select("id, student_id, exam_id, teacher_id, status, risk_count, last_tab_switch_at")
      .eq("id", sessionId)
      .eq("security_token", securityToken)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Invalid session or token" }, { status: 401 });
    }

    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "Session not in progress" }, { status: 400 });
    }

    // Deduplication: only increment if last tab switch was > 3 seconds ago
    const now = Date.now();
    const lastAt = session.last_tab_switch_at
      ? new Date(session.last_tab_switch_at).getTime()
      : 0;
    if (now - lastAt < TAB_SWITCH_DEBOUNCE_MS) {
      const { data: settings } = await admin
        .from("system_settings")
        .select("max_risk_before_submit")
        .limit(1)
        .maybeSingle();
      const maxRisk = settings?.max_risk_before_submit ?? 7;
      return NextResponse.json({
        ok: true,
        autoSubmitted: false,
        risk_count: session.risk_count ?? 0,
        max_risk_before_submit: maxRisk,
        skipped: "duplicate",
      });
    }

    const currentRiskCount = session.risk_count ?? 0;
    const newRiskCount = currentRiskCount + 1;

    // Fetch max_risk_before_submit
    let maxRiskBeforeSubmit = 7;
    const { data: settings } = await admin
      .from("system_settings")
      .select("max_risk_before_submit")
      .limit(1)
      .maybeSingle();
    if (settings?.max_risk_before_submit != null) {
      maxRiskBeforeSubmit = Number(settings.max_risk_before_submit);
    }

    const shouldAutoSubmit = newRiskCount >= maxRiskBeforeSubmit;
    const isoNow = new Date().toISOString();

    if (shouldAutoSubmit) {
      await admin.from("exam_sessions").update({
        status: "submitted",
        submitted_at: isoNow,
        risk_count: newRiskCount,
        last_tab_switch_at: isoNow,
        updated_at: isoNow,
      }).eq("id", sessionId);

      await admin.from("session_security").update({ is_active: false }).eq("session_id", sessionId);

      await admin.from("exam_risk_logs").insert({
        session_id: sessionId,
        student_id: session.student_id,
        exam_id: session.exam_id,
        event_type: "risk_auto_submit",
        event_value: String(newRiskCount),
        timestamp: isoNow,
      });

      const { data: answers } = await admin.from("student_answers").select("question_id, selected_option_id, answer_text")
        .eq("session_id", sessionId);
      const { data: questions } = await admin.from("questions").select("id, marks, correct_option_id")
        .eq("exam_id", session.exam_id);
      const qMap = new Map((questions || []).map((q: { id: number; marks?: number; correct_option_id: number | null }) => [q.id, q]));
      let totalMarks = 0;
      (answers || []).forEach((a: { question_id: number; selected_option_id: number | null }) => {
        const q = qMap.get(a.question_id);
        if (q && q.correct_option_id != null && a.selected_option_id === q.correct_option_id) {
          totalMarks += q.marks || 1;
        }
      });

      await admin.from("results").upsert({
        exam_id: session.exam_id,
        student_id: session.student_id,
        teacher_id: session.teacher_id,
        total_marks_obtained: totalMarks,
        comments: "Auto-submitted: risk_count exceeded limit (tab switch).",
        submission_time: isoNow,
      }, { onConflict: "exam_id,student_id" });

      return NextResponse.json({
        ok: true,
        autoSubmitted: true,
        risk_count: newRiskCount,
        max_risk_before_submit: maxRiskBeforeSubmit,
      });
    }

    await admin.from("exam_risk_logs").insert({
      session_id: sessionId,
      student_id: session.student_id,
      exam_id: session.exam_id,
      event_type: "tab_switch",
      event_value: String(newRiskCount),
      timestamp: isoNow,
    });

    await admin.from("exam_sessions").update({
      risk_count: newRiskCount,
      last_tab_switch_at: isoNow,
      updated_at: isoNow,
    }).eq("id", sessionId);

    return NextResponse.json({
      ok: true,
      autoSubmitted: false,
      risk_count: newRiskCount,
      max_risk_before_submit: maxRiskBeforeSubmit,
    });
  } catch (e) {
    console.error("[increment-risk]", e);
    return NextResponse.json({ error: "Increment risk failed" }, { status: 500 });
  }
}
