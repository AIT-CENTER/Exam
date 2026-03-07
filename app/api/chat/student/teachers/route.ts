import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { verifyStudentSession } from "@/lib/studentSession";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("studentSession")?.value;
    const session = verifyStudentSession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();
    const { data: sys } = await admin
      .from("system_settings")
      .select("enable_student_teacher_chat")
      .eq("id", 1)
      .maybeSingle();
    if (!sys?.enable_student_teacher_chat) {
      return NextResponse.json({ error: "Chat is disabled" }, { status: 403 });
    }

    const { data: student } = await admin
      .from("students")
      .select("id, grade_id, section, stream")
      .eq("id", session.sid)
      .maybeSingle();
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    // Subjects the student studies in this grade (Common + stream-specific)
    let subjQuery = admin
      .from("grade_subjects")
      .select("subject_id, stream, subjects(subject_name)")
      .eq("grade_id", student.grade_id);

    const stream = student.stream ?? null;
    if (stream) {
      subjQuery = subjQuery.in("stream", ["Common", stream]);
    } else {
      subjQuery = subjQuery.eq("stream", "Common");
    }

    const { data: gradeSubjects, error: gsError } = await subjQuery;
    if (gsError) return NextResponse.json({ error: gsError.message }, { status: 500 });

    const subjectIds = Array.from(new Set((gradeSubjects ?? []).map((s: any) => Number(s.subject_id)).filter(Boolean)));
    if (subjectIds.length === 0) return NextResponse.json({ subjects: [] }, { status: 200 });

    const { data: teachers, error: tError } = await admin
      .from("teacher")
      .select("id, full_name, grade_id, subject_id, section, stream")
      .eq("grade_id", student.grade_id)
      .in("subject_id", subjectIds);
    if (tError) return NextResponse.json({ error: tError.message }, { status: 500 });

    const section = String(student.section ?? "").trim();
    const teacherBySubject = new Map<number, any[]>();
    for (const t of teachers ?? []) {
      // Stream match when set on teacher
      if (t.stream && stream && t.stream !== stream) continue;
      if (t.section) {
        const allowed = String(t.section)
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        if (allowed.length > 0 && section && !allowed.includes(section)) continue;
      }
      const sid = Number((t as any).subject_id);
      const list = teacherBySubject.get(sid) ?? [];
      list.push({ id: (t as any).id, full_name: (t as any).full_name });
      teacherBySubject.set(sid, list);
    }

    const subjects = (gradeSubjects ?? []).map((s: any) => {
      const sid = Number(s.subject_id);
      return {
        subject_id: sid,
        subject_name: s.subjects?.subject_name ?? "Subject",
        stream: s.stream,
        teachers: (teacherBySubject.get(sid) ?? []).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name))),
      };
    });

    return NextResponse.json({ subjects }, { status: 200 });
  } catch (e) {
    console.error("[chat/student/teachers] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

