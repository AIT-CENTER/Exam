import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminUser } from "@/lib/requireAdmin";

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser();
    const { searchParams } = new URL(request.url);
    const student_number = (searchParams.get("student_number") || "").trim();

    if (!student_number) {
      return NextResponse.json({ error: "student_number is required" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id, student_id, name, father_name, grandfather_name, gender, date_of_birth")
      .eq("student_id", student_number)
      .maybeSingle();

    if (studentError) return NextResponse.json({ error: studentError.message }, { status: 500 });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const { data: enrollments, error: enrollError } = await admin
      .from("student_academic_enrollments")
      .select(
        `
          id,
          grade_id,
          section,
          stream,
          academic_periods (
            id,
            academic_year,
            term,
            label,
            start_date,
            end_date
          ),
          grades (
            grade_name
          )
        `
      )
      .eq("student_id", student.id)
      .order("id", { ascending: true });

    if (enrollError) return NextResponse.json({ error: enrollError.message }, { status: 500 });

    const enrollmentIds = (enrollments ?? []).map((e: any) => e.id);
    if (enrollmentIds.length === 0) {
      return NextResponse.json({
        student: {
          student_number: student.student_id,
          full_name: [student.name, student.father_name, student.grandfather_name].filter(Boolean).join(" "),
          gender: student.gender,
          date_of_birth: student.date_of_birth,
        },
        years: [],
      });
    }

    const { data: summaries, error: sumError } = await admin
      .from("student_academic_subject_summaries")
      .select(
        `
          enrollment_id,
          subject_id,
          total_marks_obtained,
          total_possible_marks,
          average,
          exam_count,
          subjects (
            subject_name
          )
        `
      )
      .in("enrollment_id", enrollmentIds);
    if (sumError) return NextResponse.json({ error: sumError.message }, { status: 500 });

    const { data: exams, error: exError } = await admin
      .from("student_academic_exam_results")
      .select(
        `
          enrollment_id,
          subject_id,
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
      .in("enrollment_id", enrollmentIds)
      .order("exam_date", { ascending: true });
    if (exError) return NextResponse.json({ error: exError.message }, { status: 500 });

    const summariesByEnrollment = new Map<number, any[]>();
    for (const s of summaries ?? []) {
      const key = Number((s as any).enrollment_id);
      const list = summariesByEnrollment.get(key) ?? [];
      list.push({
        subject_id: (s as any).subject_id,
        subject_name: (s as any).subjects?.subject_name ?? "Subject",
        total_marks_obtained: (s as any).total_marks_obtained,
        total_possible_marks: (s as any).total_possible_marks,
        exam_count: (s as any).exam_count,
        average_percentage: (s as any).average,
      });
      summariesByEnrollment.set(key, list);
    }

    const examsByEnrollment = new Map<number, any[]>();
    for (const r of exams ?? []) {
      const key = Number((r as any).enrollment_id);
      const list = examsByEnrollment.get(key) ?? [];
      list.push({
        subject_id: (r as any).subject_id,
        subject_name: (r as any).subjects?.subject_name ?? "Subject",
        exam_title: (r as any).exam_title,
        exam_date: (r as any).exam_date,
        total_marks: (r as any).total_marks,
        marks_obtained: (r as any).marks_obtained,
        percentage: (r as any).percentage,
      });
      examsByEnrollment.set(key, list);
    }

    const baseYears = (enrollments ?? []).map((e: any) => {
      const period = e.academic_periods;
      const subjectSummaries = summariesByEnrollment.get(e.id) ?? [];
      const examRows = examsByEnrollment.get(e.id) ?? [];

      const totals = subjectSummaries.reduce(
        (acc: any, s: any) => {
          acc.obt += Number(s.total_marks_obtained ?? 0);
          acc.pos += Number(s.total_possible_marks ?? 0);
          return acc;
        },
        { obt: 0, pos: 0 }
      );

      return {
        enrollment_id: e.id,
        academic_year: period?.academic_year ?? null,
        term: period?.term ?? null,
        label: period?.label ?? null,
        grade_id: e.grade_id,
        grade_name: e.grades?.grade_name ?? null,
        section: e.section,
        stream: e.stream ?? null,
        overall_percentage: totals.pos > 0 ? Math.round((totals.obt / totals.pos) * 10000) / 100 : null,
        subject_summaries: subjectSummaries,
        exams: examRows,
      };
    });

    // Derive a \"full_year\" view by averaging Semester 1 and Semester 2
    // subject summaries when both exist for the same academic year.
    const fullYearByAcademicYear = new Map<
      number,
      { sem1?: any; sem2?: any }
    >();

    for (const y of baseYears) {
      const year = y.academic_year;
      if (year == null) continue;
      const entry = fullYearByAcademicYear.get(year) ?? {};
      if (y.term === "semester_1") entry.sem1 = y;
      if (y.term === "semester_2") entry.sem2 = y;
      fullYearByAcademicYear.set(year, entry);
    }

    const fullYearYears: any[] = [];
    for (const [academic_year, pair] of fullYearByAcademicYear.entries()) {
      const sem1 = pair.sem1;
      const sem2 = pair.sem2;
      if (!sem1 || !sem2) continue;

      const bySubject = new Map<
        number,
        {
          subject_id: number;
          subject_name: string;
          total_marks_obtained: number;
          total_possible_marks: number;
          exam_count: number;
          averages: number[];
        }
      >();

      const addSubjects = (list: any[]) => {
        for (const s of list) {
          const id = Number(s.subject_id);
          const existing =
            bySubject.get(id) ?? {
              subject_id: id,
              subject_name: String(s.subject_name ?? "Subject"),
              total_marks_obtained: 0,
              total_possible_marks: 0,
              exam_count: 0,
              averages: [] as number[],
            };
          existing.total_marks_obtained += Number(s.total_marks_obtained ?? 0);
          existing.total_possible_marks += Number(s.total_possible_marks ?? 0);
          existing.exam_count += Number(s.exam_count ?? 0);
          if (s.average_percentage != null) {
            existing.averages.push(Number(s.average_percentage));
          }
          bySubject.set(id, existing);
        }
      };

      addSubjects(sem1.subject_summaries ?? []);
      addSubjects(sem2.subject_summaries ?? []);

      const fullYearSubjectSummaries = Array.from(bySubject.values()).map((s) => ({
        subject_id: s.subject_id,
        subject_name: s.subject_name,
        total_marks_obtained: s.total_marks_obtained,
        total_possible_marks: s.total_possible_marks,
        exam_count: s.exam_count,
        average_percentage:
          s.averages.length > 0
            ? Math.round(
                (s.averages.reduce((acc, v) => acc + v, 0) / s.averages.length) * 100
              ) / 100
            : null,
      }));

      const overallFromSemesters =
        sem1.overall_percentage != null && sem2.overall_percentage != null
          ? Math.round(
              ((Number(sem1.overall_percentage) + Number(sem2.overall_percentage)) / 2) * 100
            ) / 100
          : null;

      fullYearYears.push({
        enrollment_id: null,
        academic_year,
        term: "full_year",
        label: "Full year",
        grade_id: sem1.grade_id ?? sem2.grade_id,
        grade_name: sem1.grade_name ?? sem2.grade_name,
        section: sem1.section ?? sem2.section,
        stream: sem1.stream ?? sem2.stream,
        overall_percentage: overallFromSemesters,
        subject_summaries: fullYearSubjectSummaries,
        exams: [],
      });
    }

    const years = [...baseYears, ...fullYearYears];

    return NextResponse.json({
      student: {
        student_number: student.student_id,
        full_name: [student.name, student.father_name, student.grandfather_name].filter(Boolean).join(" "),
        gender: student.gender,
        date_of_birth: student.date_of_birth,
      },
      years,
    });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[results-archive/transcript] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

