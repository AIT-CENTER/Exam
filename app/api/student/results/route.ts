import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { verifyStudentSession } from "@/lib/studentSession";

type TermKey = "semester_1" | "semester_2" | "full_year";

function mergeSubjectResults(
  acc: Map<number, { subject_id: number; subject_name: string; exams: any[] }>,
  rows: { subject_id: number; subject_name: string; exams: any[] }[]
) {
  for (const r of rows) {
    const cur = acc.get(r.subject_id) ?? { subject_id: r.subject_id, subject_name: r.subject_name, exams: [] as any[] };
    cur.exams.push(...(r.exams ?? []));
    acc.set(r.subject_id, cur);
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("studentSession")?.value;
    const session = verifyStudentSession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();

    const { data: sys } = await admin
      .from("system_settings")
      .select(
        [
          "enable_student_results_portal",
          "enable_realtime_features",
          "student_current_results_mode",
          "current_academic_year",
        ].join(",")
      )
      .eq("id", 1)
      .maybeSingle();

    if (!sys?.enable_student_results_portal) {
      return NextResponse.json({ error: "Student results portal is disabled" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period_id = searchParams.get("period_id") ? Number(searchParams.get("period_id")) : null;
    const realtime = Boolean(sys?.enable_realtime_features);
    const currentMode: "semester_1" | "full_year" =
      sys?.student_current_results_mode === "full_year" ? "full_year" : "semester_1";

    // If admin requires password setup first, block results view until password is set.
    if (session.mustSetPassword) {
      return NextResponse.json({ error: "PASSWORD_REQUIRED" }, { status: 409 });
    }

    if (period_id && Number.isFinite(period_id) && period_id > 0) {
      const { data: enrollment } = await admin
        .from("student_academic_enrollments")
        .select(
          `
            id,
            grade_id,
            section,
            stream,
            grades (grade_name),
            academic_periods (academic_year, term, label, start_date, end_date)
          `
        )
        .eq("period_id", period_id)
        .eq("student_id", session.sid)
        .maybeSingle();

      if (!enrollment) {
        return NextResponse.json({ source: "snapshot", period_id, subject_exam_results: [] }, { status: 200 });
      }

      // Archived view: always from snapshots for a specific period.
      const { data: exams } = await admin
        .from("student_academic_exam_results")
        .select(
          `
            subject_id,
            exam_title,
            exam_date,
            total_marks,
            marks_obtained,
            percentage,
            subjects (subject_name)
          `
        )
        .eq("enrollment_id", (enrollment as any).id)
        .order("subject_id", { ascending: true })
        .order("exam_date", { ascending: true });

      const bySubject = new Map<number, { subject_id: number; subject_name: string; exams: any[] }>();
      for (const r of exams ?? []) {
        const sid = Number((r as any).subject_id);
        const name = (r as any).subjects?.subject_name ?? "Subject";
        const cur = bySubject.get(sid) ?? { subject_id: sid, subject_name: name, exams: [] as any[] };
        cur.exams.push({
          exam_title: (r as any).exam_title,
          exam_date: (r as any).exam_date,
          total_marks: (r as any).total_marks,
          marks_obtained: (r as any).marks_obtained,
          percentage: (r as any).percentage,
        });
        bySubject.set(sid, cur);
      }

      return NextResponse.json(
        {
          source: "snapshot",
          enrollment: {
            grade_id: (enrollment as any).grade_id,
            grade_name: (enrollment as any).grades?.grade_name ?? null,
            section: (enrollment as any).section,
            stream: (enrollment as any).stream ?? null,
          },
          period: (enrollment as any).academic_periods,
          subject_exam_results: Array.from(bySubject.values()),
        },
        { status: 200 }
      );
    }

    // Current view: controlled by Settings switches (semester_1 only vs full_year includes semester_1).
    // We use academic_periods (is_current + same academic_year) to decide which stored period(s) to show.
    const { data: currentPeriod } = await admin
      .from("academic_periods")
      .select("id, academic_year, term, start_date, end_date")
      .eq("is_current", true)
      .maybeSingle();

    if (!currentPeriod) {
      return NextResponse.json({ error: "No current academic period configured" }, { status: 400 });
    }

    const academicYear = currentPeriod.academic_year;

    const wantedTerms: TermKey[] =
      currentMode === "full_year" ? ["full_year", "semester_1", "semester_2"] : ["semester_1"];

    const { data: periods } = await admin
      .from("academic_periods")
      .select("id, academic_year, term, start_date, end_date")
      .eq("academic_year", academicYear)
      .in("term", wantedTerms as any);

    const selectedPeriods = (periods ?? []).length ? (periods ?? []) : [currentPeriod];

    const { data: student } = await admin
      .from("students")
      .select("id, grade_id, section, stream, grades!students_grade_id_fkey(grade_name)")
      .eq("id", session.sid)
      .maybeSingle();

    const merged = new Map<number, { subject_id: number; subject_name: string; exams: any[] }>();

    if (realtime) {
      // Real-time: pull from live results within each academic period's date range.
      for (const p of selectedPeriods) {
        if (!p.start_date || !p.end_date) continue;
        const { data: results, error: resultsError } = await admin
          .from("results")
          .select(
            `
              total_marks_obtained,
              exams!results_exam_id_fkey (
                id,
                title,
                exam_date,
                total_marks,
                subject_id,
                subjects!exams_subject_id_fkey (subject_name)
              )
            `
          )
          .eq("student_id", session.sid)
          .gte("exams.exam_date", p.start_date)
          .lte("exams.exam_date", p.end_date)
          .order("created_at", { ascending: true });

        if (resultsError) return NextResponse.json({ error: resultsError.message }, { status: 500 });

        const bySubject = new Map<number, { subject_id: number; subject_name: string; exams: any[] }>();
        for (const r of results ?? []) {
          const ex = (r as any).exams;
          if (!ex?.subject_id) continue;
          const sid = Number(ex.subject_id);
          const name = ex.subjects?.subject_name ?? "Subject";
          const totalMarks = Number(ex.total_marks ?? 0);
          const obtained = Number((r as any).total_marks_obtained ?? 0);
          const percentage = totalMarks > 0 ? Math.round((obtained / totalMarks) * 10000) / 100 : null;
          const cur = bySubject.get(sid) ?? { subject_id: sid, subject_name: name, exams: [] as any[] };
          cur.exams.push({
            exam_title: String(ex.title ?? "Exam"),
            exam_date: ex.exam_date ?? null,
            total_marks: totalMarks,
            marks_obtained: obtained,
            percentage,
          });
          bySubject.set(sid, cur);
        }
        mergeSubjectResults(merged, Array.from(bySubject.values()));
      }

      return NextResponse.json(
        {
          source: "live",
          current_mode: currentMode,
          academic_year: academicYear ?? (sys?.current_academic_year ?? null),
          periods: selectedPeriods.map((p) => ({ id: p.id, term: p.term, start_date: p.start_date, end_date: p.end_date })),
          enrollment: {
            grade_id: student?.grade_id ?? null,
            grade_name: (student as any)?.grades?.grade_name ?? null,
            section: student?.section ?? null,
            stream: student?.stream ?? null,
          },
          subject_exam_results: Array.from(merged.values()),
        },
        { status: 200 }
      );
    }

    // Snapshot mode: merge snapshots from the selected academic periods (semester_1 only OR full_year+semester periods).
    for (const p of selectedPeriods) {
      const { data: enrollment } = await admin
        .from("student_academic_enrollments")
        .select("id, grade_id, section, stream, grades(grade_name)")
        .eq("period_id", p.id)
        .eq("student_id", session.sid)
        .maybeSingle();

      if (!enrollment) continue;

      const { data: exams, error: examsError } = await admin
        .from("student_academic_exam_results")
        .select(
          `
            subject_id,
            exam_title,
            exam_date,
            total_marks,
            marks_obtained,
            percentage,
            subjects (subject_name)
          `
        )
        .eq("enrollment_id", (enrollment as any).id)
        .order("subject_id", { ascending: true })
        .order("exam_date", { ascending: true });

      if (examsError) return NextResponse.json({ error: examsError.message }, { status: 500 });

      const bySubject = new Map<number, { subject_id: number; subject_name: string; exams: any[] }>();
      for (const r of exams ?? []) {
        const sid = Number((r as any).subject_id);
        const name = (r as any).subjects?.subject_name ?? "Subject";
        const cur = bySubject.get(sid) ?? { subject_id: sid, subject_name: name, exams: [] as any[] };
        cur.exams.push({
          exam_title: (r as any).exam_title,
          exam_date: (r as any).exam_date,
          total_marks: (r as any).total_marks,
          marks_obtained: (r as any).marks_obtained,
          percentage: (r as any).percentage,
        });
        bySubject.set(sid, cur);
      }
      mergeSubjectResults(merged, Array.from(bySubject.values()));
    }

    return NextResponse.json(
      {
        source: "snapshot",
        current_mode: currentMode,
        academic_year: academicYear ?? (sys?.current_academic_year ?? null),
        periods: selectedPeriods.map((p) => ({ id: p.id, term: p.term, start_date: p.start_date, end_date: p.end_date })),
        enrollment: {
          grade_id: student?.grade_id ?? null,
          grade_name: (student as any)?.grades?.grade_name ?? null,
          section: student?.section ?? null,
          stream: student?.stream ?? null,
        },
        subject_exam_results: Array.from(merged.values()),
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("[student/results] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

