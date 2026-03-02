/**
 * Mark instruction_seen = true when student clicks Continue on instructions.
 * Ensures instructions show only on first login for that session.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, securityToken } = body as { sessionId?: string; securityToken?: string };

    if (!sessionId || !securityToken) {
      return NextResponse.json(
        { error: "sessionId and securityToken required" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    const { error } = await admin
      .from("exam_sessions")
      .update({
        instruction_seen: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("security_token", securityToken);

    if (error) {
      return NextResponse.json({ error: "Update failed" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[instruction-seen]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
