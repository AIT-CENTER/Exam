import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { signStudentSession, verifyStudentSession } from "@/lib/studentSession";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("studentSession")?.value;
    const session = verifyStudentSession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const current_password = body.current_password ? String(body.current_password) : "";
    const new_password = String(body.new_password || "");
    const verify_student_id = body.verify_student_id ? String(body.verify_student_id).trim().toUpperCase() : "";
    const verify_phone = body.verify_phone ? String(body.verify_phone).trim() : "";

    if (new_password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    if (new_password.length > 64) {
      return NextResponse.json({ error: "Password too long" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // First-time password creation requires verification with student ID + phone number.
    if (session.mustSetPassword) {
      if (!verify_student_id) return NextResponse.json({ error: "Student ID is required for verification" }, { status: 400 });
      if (!verify_phone) return NextResponse.json({ error: "Phone number is required for verification" }, { status: 400 });

      const { data: student, error: studentError } = await admin
        .from("students")
        .select("id, student_id, phone, parent_phone")
        .eq("id", session.sid)
        .maybeSingle();
      if (studentError || !student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

      const normalize = (s: string | null | undefined) => String(s ?? "").replace(/\s+/g, "");
      const phoneOk =
        normalize(student.phone) === normalize(verify_phone) ||
        normalize(student.parent_phone) === normalize(verify_phone);
      if (String(student.student_id).toUpperCase() !== verify_student_id || !phoneOk) {
        return NextResponse.json({ error: "Verification failed (ID/phone mismatch)" }, { status: 401 });
      }
    }

    const { data: cred, error: credError } = await admin
      .from("student_credentials")
      .select("student_id, password_hash")
      .eq("student_id", session.sid)
      .maybeSingle();

    if (credError) return NextResponse.json({ error: "Failed to verify credentials" }, { status: 500 });

    const hasExisting = Boolean(cred?.password_hash);
    if (hasExisting && !session.mustSetPassword) {
      if (!current_password) return NextResponse.json({ error: "Current password is required" }, { status: 400 });
      const ok = await bcrypt.compare(current_password, cred!.password_hash);
      if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    const { error: upsertError } = await admin
      .from("student_credentials")
      .upsert(
        {
          student_id: session.sid,
          password_hash,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id" }
      );
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
    const newToken = signStudentSession({ sid: session.sid, student_number: session.student_number, exp });

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set("studentSession", newToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    console.error("[student/password/set] POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

