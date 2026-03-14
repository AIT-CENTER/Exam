/**
 * Server-side auto-submit for exam sessions whose time has expired.
 * Used by cron and fetch-live-monitor to ensure disconnected students
 * get auto-submitted when exam time reaches 00.
 */

import { supabaseAdmin } from "@/lib/supabaseClient";

export async function autoSubmitExpiredSessions(): Promise<{ processed: number }> {
  const admin = supabaseAdmin();
  const now = new Date().toISOString();

  const { data: sessions, error: fetchError } = await admin
    .from("exam_sessions")
    .select("id, exam_id, student_id, teacher_id, started_at, end_time, extra_time_seconds")
    .eq("status", "in_progress");

  if (fetchError || !sessions?.length) {
    return { processed: 0 };
  }

  const { data: exams } = await admin
    .from("exams")
    .select("id, duration")
    .in("id", [...new Set(sessions.map((s) => s.exam_id))]);

  const examDurationMap = new Map(
    (exams ?? []).map((e) => [e.id, e.duration ?? 60])
  );
  const nowMs = Date.now();

  const expired = sessions.filter((s) => {
    if (s.end_time) {
      return nowMs >= new Date(s.end_time).getTime();
    }
    const durationMin = examDurationMap.get(s.exam_id) ?? 60;
    const extra = s.extra_time_seconds ?? 0;
    const endMs =
      new Date(s.started_at).getTime() +
      (durationMin * 60 + extra) * 1000;
    return nowMs >= endMs;
  });

  let processed = 0;
  for (const s of expired) {
    const { error: updateErr } = await admin
      .from("exam_sessions")
      .update({
        status: "submitted",
        submitted_at: now,
        updated_at: now,
        time_remaining: 0,
      })
      .eq("id", s.id);

    if (updateErr) continue;

    await admin.from("session_security").update({ is_active: false }).eq("session_id", s.id);

    const { error: resultErr } = await admin.from("results").upsert(
      {
        exam_id: s.exam_id,
        student_id: s.student_id,
        teacher_id: s.teacher_id,
        total_marks_obtained: 0,
        comments:
          "Auto-submitted by system (time expired). Please correct manually.",
        submission_time: now,
      },
      { onConflict: "exam_id,student_id" }
    );

    if (!resultErr) processed++;
  }

  return { processed };
}
