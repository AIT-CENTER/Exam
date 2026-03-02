/**
 * Teacher removes a student from live monitor display.
 * Sets hidden_from_monitor = true. Student continues exam; they just no longer appear in teacher's live view.
 */

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
      .select("id, status")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "Can only remove active sessions from monitor" }, { status: 400 });
    }

    const { error: updateError } = await admin
      .from("exam_sessions")
      .update({
        hidden_from_monitor: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[remove-student]", e);
    return NextResponse.json({ error: "Remove failed" }, { status: 500 });
  }
}
