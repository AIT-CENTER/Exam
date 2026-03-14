import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId?: string };

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId required" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    const { data: session, error: sessionError } = await admin
      .from("exam_sessions")
      .select("id, exam_id, student_id, teacher_id, status")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "Can only remove active sessions from monitor" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 1) Mark the session as submitted and hide it from the monitor.
    const { error: updateError } = await admin
      .from("exam_sessions")
      .update({
        status: "submitted",
        hidden_from_monitor: true,
        submitted_at: now,
        updated_at: now,
      })
      .eq("id", sessionId);

    if (updateError) throw updateError;

    // 2) Deactivate any active session_security rows for this session.
    await admin
      .from("session_security")
      .update({ is_active: false })
      .eq("session_id", sessionId);

    // 3) Upsert a results row so the exam is clearly ended; teacher can adjust marks later.
    const { error: resultErr } = await admin.from("results").upsert(
      {
        exam_id: session.exam_id,
        student_id: session.student_id,
        teacher_id: session.teacher_id,
        total_marks_obtained: 0,
        comments: "Auto-submitted by teacher via live monitor removal.",
        submission_time: now,
      },
      { onConflict: "exam_id,student_id" }
    );

    if (resultErr) {
      console.error("[remove-student] result upsert error:", resultErr);
    }

    return NextResponse.json({ ok: true, terminated: true });
  } catch (e) {
    console.error("[remove-student]", e);
    return NextResponse.json({ error: "Remove failed" }, { status: 500 });
  }
}
