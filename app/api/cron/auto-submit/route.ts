/**
 * Cron: auto-submit exam sessions that have passed their end time.
 * Call via GET with CRON_SECRET or from Vercel Cron. Marks session as submitted
 * and creates a result row so the teacher can correct later if needed.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const now = new Date().toISOString();

    // Get in_progress sessions; use end_time when set (server-based timer), else compute from started_at + duration
    const { data: sessions, error: fetchError } = await admin
      .from("exam_sessions")
      .select("id, exam_id, student_id, teacher_id, started_at, end_time, extra_time_seconds")
      .eq("status", "in_progress");

    if (fetchError) {
      console.error("[auto-submit] fetch sessions:", fetchError);
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    if (!sessions?.length) {
      return NextResponse.json({ processed: 0, message: "No in-progress sessions" });
    }

    const { data: exams } = await admin
      .from("exams")
      .select("id, duration")
      .in("id", [...new Set(sessions.map((s) => s.exam_id))]);

    const examDurationMap = new Map((exams ?? []).map((e) => [e.id, e.duration ?? 60]));
    const now = Date.now();
    const expired = sessions.filter((s) => {
      if (s.end_time) {
        return now >= new Date(s.end_time).getTime();
      }
      const durationMin = examDurationMap.get(s.exam_id) ?? 60;
      const extra = s.extra_time_seconds ?? 0;
      const endMs = new Date(s.started_at).getTime() + (durationMin * 60 + extra) * 1000;
      return now >= endMs;
    });

    let processed = 0;
    for (const s of expired) {
      const { error: updateErr } = await admin
        .from("exam_sessions")
        .update({
          status: "submitted",
          submitted_at: now,
          updated_at: now,
        })
        .eq("id", s.id);

      if (updateErr) {
        console.error("[auto-submit] update session:", s.id, updateErr);
        continue;
      }

      await admin.from("session_security").update({ is_active: false }).eq("session_id", s.id);

      const { error: resultErr } = await admin.from("results").upsert(
        {
          exam_id: s.exam_id,
          student_id: s.student_id,
          teacher_id: s.teacher_id,
          total_marks_obtained: 0,
          comments: "Auto-submitted by system (time expired). Please correct manually.",
          submission_time: now,
        },
        { onConflict: "exam_id,student_id" }
      );

      if (resultErr) console.error("[auto-submit] result insert:", s.id, resultErr);
      else processed++;
    }

    return NextResponse.json({ processed, totalExpired: expired.length });
  } catch (e) {
    console.error("[auto-submit]", e);
    return NextResponse.json({ error: "Auto-submit failed" }, { status: 500 });
  }
}
