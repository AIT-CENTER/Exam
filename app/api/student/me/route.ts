import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { verifyStudentSession } from "@/lib/studentSession";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("studentSession")?.value;
    const session = verifyStudentSession(token);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const admin = supabaseAdmin();
    const { data: student } = await admin
      .from("students")
      .select("id, student_id, name, father_name, grandfather_name, grade_id, section, stream, gender, grades!students_grade_id_fkey(grade_name)")
      .eq("id", session.sid)
      .maybeSingle();

    const gradesRow = (student as { grades?: { grade_name: string } | null })?.grades;
    const grade_name = gradesRow?.grade_name ?? null;

    return NextResponse.json(
      {
        authenticated: true,
        mustSetPassword: Boolean(session.mustSetPassword),
        student: student
          ? {
              id: student.id,
              student_id: student.student_id,
              full_name: [student.name, student.father_name, student.grandfather_name].filter(Boolean).join(" "),
              grade_id: student.grade_id,
              grade_name,
              section: student.section,
              stream: student.stream ?? null,
              gender: student.gender ?? null,
            }
          : null,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("[student/me] GET error:", e);
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}

