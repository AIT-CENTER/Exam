import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminUser } from "@/lib/requireAdmin";

export async function GET(_request: NextRequest, { params }: { params: { enrollmentId: string } }) {
  try {
    await requireAdminUser();
    const { enrollmentId } = params;
    const id = Number(enrollmentId);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid enrollmentId" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: enrollment, error: enrollmentError } = await admin
      .from("student_academic_enrollments")
      .select(
        `
          id,
          period_id,
          grade_id,
          section,
          stream,
          students (
            id,
            student_id,
            name,
            father_name,
            grandfather_name,
            gender
          ),
          grades (
            grade_name
          ),
          academic_periods (
            id,
            academic_year,
            term,
            label,
            start_date,
            end_date
          )
        `
      )
      .eq("id", id)
      .maybeSingle();

    if (enrollmentError) return NextResponse.json({ error: enrollmentError.message }, { status: 500 });
    if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: exams, error: examsError } = await admin
      .from("student_academic_exam_results")
      .select(
        `
          subject_id,
          exam_id,
          exam_title,
          exam_date,
          total_marks,
          marks_obtained,
          percentage,
          subjects (
            subject_name
          )
        `
      )
      .eq("enrollment_id", id)
      .order("subject_id", { ascending: true })
      .order("exam_date", { ascending: true });

    if (examsError) return NextResponse.json({ error: examsError.message }, { status: 500 });

    const subjectsMap = new Map<number, { subject_id: number; subject_name: string; exams: any[] }>();
    for (const row of exams ?? []) {
      const subjectId = Number((row as any).subject_id);
      const subjectName = (row as any).subjects?.subject_name ?? "Subject";
      const cur = subjectsMap.get(subjectId) ?? { subject_id: subjectId, subject_name: subjectName, exams: [] as any[] };
      cur.exams.push({
        exam_id: (row as any).exam_id ?? null,
        exam_title: (row as any).exam_title,
        exam_date: (row as any).exam_date,
        total_marks: (row as any).total_marks,
        marks_obtained: (row as any).marks_obtained,
        percentage: (row as any).percentage,
      });
      subjectsMap.set(subjectId, cur);
    }

    const student = (enrollment as any).students;
    const fullName = [student?.name, student?.father_name, student?.grandfather_name].filter(Boolean).join(" ");

    return NextResponse.json({
      enrollment: {
        id: (enrollment as any).id,
        section: (enrollment as any).section,
        stream: (enrollment as any).stream ?? null,
        grade_id: (enrollment as any).grade_id,
        grade_name: (enrollment as any).grades?.grade_name ?? null,
      },
      period: (enrollment as any).academic_periods,
      student: {
        id: student?.id,
        student_id: student?.student_id,
        full_name: fullName,
        gender: student?.gender ?? null,
      },
      subject_exam_results: Array.from(subjectsMap.values()),
    });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[results-archive/enrollments/:id] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

