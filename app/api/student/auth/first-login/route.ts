import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { signStudentSession } from "@/lib/studentSession";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const student_number = String(body.student_id || body.student_number || "").trim();
    const date_of_birth = String(body.date_of_birth || "").trim(); // YYYY-MM-DD

    if (!student_number) return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    if (!date_of_birth) return NextResponse.json({ error: "Date of birth is required" }, { status: 400 });

    const admin = supabaseAdmin();
    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id, student_id, date_of_birth")
      .eq("student_id", student_number)
      .maybeSingle();

    if (studentError) return NextResponse.json({ error: "Failed to lookup student" }, { status: 500 });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    if (String(student.date_of_birth ?? "") !== date_of_birth) {
      return NextResponse.json({ error: "Verification failed" }, { status: 401 });
    }

    const { data: cred } = await admin
      .from("student_credentials")
      .select("student_id")
      .eq("student_id", student.id)
      .maybeSingle();

    if (cred) {
      return NextResponse.json({ error: "Password already set. Please login with password." }, { status: 409 });
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
  } catch (e) {
    console.error("[student/auth/first-login] POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

