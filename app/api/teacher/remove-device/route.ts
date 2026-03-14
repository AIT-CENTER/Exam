/**
 * Remove Device (teacher action):
 * - Revokes the currently active device(s) for an in_progress session by deactivating session_security
 * - Rotates exam_sessions.security_token so old device API calls fail immediately
 * - DOES NOT submit the exam (student can continue via controlled takeover on a new device)
 *
 * Result: if the student is on the exam page, their monitor detects the deactivation and exits.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

function randomToken32() {
  return [...Array(32)].map(() => Math.random().toString(36)[2]).join("");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = String(body.sessionId || "").trim();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: session, error: sessionError } = await admin
      .from("exam_sessions")
      .select("id, status, exam_id, student_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "Session is not active" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newToken = randomToken32();

    // 1) Revoke all active security rows for this session (kicks the device off exam page).
    await admin
      .from("session_security")
      .update({ is_active: false, last_verified: now })
      .eq("session_id", sessionId)
      .eq("is_active", true);

    // 2) Rotate the session token to immediately invalidate API heartbeats.
    await admin
      .from("exam_sessions")
      .update({
        security_token: newToken,
        last_device_fingerprint: null,
        updated_at: now,
      })
      .eq("id", sessionId);

    // 3) Audit trail (best-effort; do not fail the request).
    try {
      await admin.from("activity_logs").insert({
        session_id: sessionId,
        student_id: session.student_id,
        exam_id: session.exam_id,
        event_type: "device_change",
        metadata: { by: "teacher", action: "remove_device" },
        created_at: now,
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[remove-device]", e);
    return NextResponse.json({ error: "Remove device failed" }, { status: 500 });
  }
}

