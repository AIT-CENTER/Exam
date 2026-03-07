import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { signStudentSession } from "@/lib/studentSession";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const student_number_raw = String(body.student_id || body.student_number || "").trim();
    const student_number = student_number_raw.toUpperCase();
    const password = body.password === undefined || body.password === null ? "" : String(body.password);

    if (!student_number) return NextResponse.json({ error: "Student ID is required" }, { status: 400 });

    const admin = supabaseAdmin();
    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id, student_id")
      .ilike("student_id", student_number)
      .maybeSingle();

    if (studentError) return NextResponse.json({ error: "Failed to lookup student" }, { status: 500 });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const { data: cred, error: credError } = await admin
      .from("student_credentials")
      .select("student_id, password_hash")
      .eq("student_id", student.id)
      .maybeSingle();

    if (credError) return NextResponse.json({ error: "Failed to verify credentials" }, { status: 500 });

    // First login: if no password exists yet, allow ID-only login and force password creation inside dashboard.
    if (!cred || !cred.password_hash) {
      if (password && password.trim().length > 0) {
        return NextResponse.json({ error: "NO_PASSWORD", message: "No password set. Sign in with ID only." }, { status: 409 });
      }
      const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 2;
      const token = signStudentSession({ sid: student.id, student_number: student.student_id, mustSetPassword: true, exp });
      const res = NextResponse.json({ ok: true, mustSetPassword: true }, { status: 200 });
      res.cookies.set("studentSession", token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 2,
      });
      return res;
    }

    if (!password || password.trim().length === 0) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const ok = await bcrypt.compare(password, cred.password_hash);
    if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
    const token = signStudentSession({ sid: student.id, student_number: student.student_id, exp });

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set("studentSession", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    console.error("[student/auth/login] POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

