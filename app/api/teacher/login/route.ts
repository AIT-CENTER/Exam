import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { emailOrPhone, password } = body;

    if (!emailOrPhone || !password) {
      return NextResponse.json(
        { error: "Email/phone and password are required" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = emailRegex.test(emailOrPhone);

    let query = admin
      .from("teacher")
      .select(
        `
        id,
        username,
        full_name,
        email,
        phone_number,
        password,
        grade_id,
        subject_id,
        section,
        stream,
        grades (id, grade_name),
        subjects (id, subject_name)
      `
      );

    if (isEmail) {
      query = query.eq("email", emailOrPhone);
    } else {
      query = query.eq("phone_number", emailOrPhone);
    }

    const { data: teacherRecords, error: teacherError } = await query;

    if (teacherError) {
      console.error("Teacher login query error:", teacherError);
      return NextResponse.json(
        { error: "Teacher not found. Please check your credentials." },
        { status: 401 }
      );
    }

    if (!teacherRecords || teacherRecords.length === 0) {
      return NextResponse.json(
        { error: "Teacher not found. Please check your credentials." },
        { status: 401 }
      );
    }

    const firstRecord = teacherRecords[0] as any;
    if (!firstRecord.password) {
      return NextResponse.json(
        { error: "Password not set. Please contact administrator." },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, firstRecord.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid password. Please try again." },
        { status: 401 }
      );
    }

    // Return teacher data without password for cookie (single or multiple for subject selection)
    const sanitize = (r: any) => ({
      id: r.id,
      username: r.username,
      full_name: r.full_name,
      email: r.email,
      phone_number: r.phone_number,
      grade_id: r.grade_id,
      subject_id: r.subject_id,
      section: r.section,
      stream: r.stream ?? null,
      grades: r.grades,
      subjects: r.subjects,
    });

    const payload = teacherRecords.length === 1
      ? { single: sanitize(teacherRecords[0]) }
      : { multiple: teacherRecords.map(sanitize) };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Teacher login error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
