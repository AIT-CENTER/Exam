import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { signStudentSession } from "@/lib/studentSession";

async function normalizeStudentId(admin: ReturnType<typeof supabaseAdmin>, raw: string) {
  const cleaned = String(raw || "").trim().toUpperCase();

  if (!cleaned) {
    return { normalized: "", config: null };
  }

  try {
    const { data: config, error } = await admin
      .from("id_configurations")
      .select("prefix, digits, separator")
      .single();

    if (error || !config) {
      console.warn("[student/auth/login] Using raw student ID (id_configurations not available)", {
        error,
      });
      return { normalized: cleaned, config: null };
    }

    const prefix = String(config.prefix ?? "").toUpperCase();
    const separator =
      config.separator && config.separator !== "none" ? String(config.separator) : "";
    const digits = Number(config.digits) || 0;

    const sepRegex =
      separator !== "" ? new RegExp(separator.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "g") : null;

    const withoutPrefix = prefix ? cleaned.replace(prefix, "") : cleaned;
    const numericPart = withoutPrefix
      .replace(sepRegex ?? "", "")
      .replace(/\D/g, "");

    const padded = digits > 0 ? numericPart.padStart(digits, "0") : numericPart;
    const normalized = `${prefix}${separator}${padded}`;

    return { normalized, config };
  } catch (error) {
    console.warn("[student/auth/login] Failed to read id_configurations, using raw ID", {
      error,
    });
    return { normalized: cleaned, config: null };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const student_number_raw = String(body.student_id || body.student_number || "").trim();
    const password =
      body.password === undefined || body.password === null ? "" : String(body.password);

    if (!student_number_raw) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { normalized: student_number } = await normalizeStudentId(admin, student_number_raw);

    console.log("[student/auth/login] Incoming login", {
      student_number_raw,
      normalized_student_number: student_number,
    });

    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id, student_id")
      .eq("student_id", student_number)
      .maybeSingle();

    if (studentError) {
      console.error("[student/auth/login] Student lookup error", {
        code: (studentError as any).code,
        message: studentError.message,
        details: (studentError as any).details,
        hint: (studentError as any).hint,
      });
      return NextResponse.json({ error: "Failed to lookup student" }, { status: 500 });
    }

    if (!student) {
      console.warn("[student/auth/login] Student not found", {
        normalized_student_number: student_number,
      });
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const { data: cred, error: credError } = await admin
      .from("student_credentials")
      .select("student_id, password_hash")
      .eq("student_id", student.id)
      .maybeSingle();

    if (credError) {
      console.error("[student/auth/login] Credential lookup error", {
        code: (credError as any).code,
        message: credError.message,
        details: (credError as any).details,
        hint: (credError as any).hint,
      });
      return NextResponse.json({ error: "Failed to verify credentials" }, { status: 500 });
    }

    // First login: if no password exists yet, allow ID-only login and force password creation inside dashboard.
    if (!cred || !cred.password_hash) {
      if (password && password.trim().length > 0) {
        return NextResponse.json(
          { error: "NO_PASSWORD", message: "No password set. Sign in with ID only." },
          { status: 409 },
        );
      }
      const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 2;
      const token = signStudentSession({
        sid: student.id,
        student_number: student.student_id,
        mustSetPassword: true,
        exp,
      });
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
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
    const token = signStudentSession({
      sid: student.id,
      student_number: student.student_id,
      exp,
    });

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
    return NextResponse.json(
      { error: "Server error", message: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}

