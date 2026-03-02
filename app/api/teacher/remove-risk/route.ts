/**
 * Teacher removes (resets) a student's counted tab-switch risk for an active session.
 * Sets exam_sessions.risk_count back to 0 (does not delete historical logs).
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId?: string };

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
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
      return NextResponse.json(
        { error: "Can only remove risk for active sessions" },
        { status: 400 }
      );
    }

    const isoNow = new Date().toISOString();
    const { error: updateError } = await admin
      .from("exam_sessions")
      .update({
        risk_count: 0,
        last_tab_switch_at: null,
        updated_at: isoNow,
      })
      .eq("id", sessionId);

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, risk_count: 0 });
  } catch (e) {
    console.error("[remove-risk]", e);
    return NextResponse.json({ error: "Remove risk failed" }, { status: 500 });
  }
}

