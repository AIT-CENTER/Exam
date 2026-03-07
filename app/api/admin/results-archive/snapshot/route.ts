import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminUser } from "@/lib/requireAdmin";

type SnapshotRequest = {
  period_id: number;
  grade_id?: number;
  section?: string;
  stream?: string | null;
  force?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    await requireAdminUser();
    const body = (await request.json().catch(() => ({}))) as Partial<SnapshotRequest>;

    const period_id = Number(body.period_id);
    const grade_id = body.grade_id === undefined ? undefined : Number(body.grade_id);
    const section = typeof body.section === "string" && body.section.trim() ? body.section.trim() : undefined;
    const stream = body.stream === undefined ? undefined : (body.stream === null ? null : String(body.stream));
    const force = Boolean(body.force);

    if (!Number.isFinite(period_id) || period_id <= 0) {
      return NextResponse.json({ error: "Invalid period_id" }, { status: 400 });
    }
    if (grade_id !== undefined && (!Number.isFinite(grade_id) || grade_id <= 0)) {
      return NextResponse.json({ error: "Invalid grade_id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: period, error: periodError } = await admin
      .from("academic_periods")
      .select("id, academic_year, term, start_date, end_date")
      .eq("id", period_id)
      .maybeSingle();

    if (periodError || !period) {
      return NextResponse.json({ error: "Academic period not found" }, { status: 404 });
    }

    let studentQuery = admin
      .from("students")
      .select("id, grade_id, section, stream")
      .order("id", { ascending: true });

    if (grade_id !== undefined) studentQuery = studentQuery.eq("grade_id", grade_id);
    if (section !== undefined) studentQuery = studentQuery.eq("section", section);
    if (stream !== undefined) {
      if (stream === null) studentQuery = studentQuery.is("stream", null);
      else studentQuery = studentQuery.eq("stream", stream);
    }

    const { data: students, error: studentsError } = await studentQuery;
    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 500 });
    }
    if (!students || students.length === 0) {
      return NextResponse.json({ ok: true, message: "No students matched filters.", inserted: 0 }, { status: 200 });
    }

    // 1) Upsert enrollments for the period (grade/section/stream at snapshot time)
    const enrollmentRows = students.map((s) => ({
      period_id,
      student_id: s.id,
      grade_id: s.grade_id,
      section: s.section,
      stream: s.stream ?? null,
      updated_at: new Date().toISOString(),
    }));

    const { data: enrollments, error: enrollUpsertError } = await admin
      .from("student_academic_enrollments")
      .upsert(enrollmentRows, { onConflict: "period_id,student_id" })
      .select("id, student_id");

    if (enrollUpsertError) {
      return NextResponse.json({ error: enrollUpsertError.message }, { status: 500 });
    }

    const enrollmentIds = (enrollments ?? []).map((e) => e.id);
    const enrollmentByStudentId = new Map<number, number>();
    for (const e of enrollments ?? []) enrollmentByStudentId.set(e.student_id, e.id);

    if (enrollmentIds.length === 0) {
      return NextResponse.json({ ok: true, message: "No enrollments created.", inserted: 0 }, { status: 200 });
    }

    // 2) If snapshots already exist for this period + filter, require explicit confirmation
    if (!force) {
      const { count, error: existingError } = await admin
        .from("student_academic_exam_results")
        .select("id", { count: "exact", head: true })
        .in("enrollment_id", enrollmentIds);

      if (!existingError && (count ?? 0) > 0) {
        return NextResponse.json(
          {
            error: "Snapshot already exists for this academic period and filters.",
            code: "SNAPSHOT_EXISTS",
            existingRows: count ?? 0,
          },
          { status: 409 }
        );
      }
    }

    // 3) Clear previous snapshots for these enrollments (idempotent snapshot)
    await admin.from("student_academic_exam_results").delete().in("enrollment_id", enrollmentIds);
    await admin.from("student_academic_subject_summaries").delete().in("enrollment_id", enrollmentIds);

    // 4) Fetch results in the period window (based on exams.exam_date)
    const studentDbIds = students.map((s) => s.id);

    let resultsQuery = admin
      .from("results")
      .select(
        `
          exam_id,
          student_id,
          total_marks_obtained,
          exams!results_exam_id_fkey (
            id,
            title,
            exam_date,
            total_marks,
            subject_id,
            grade_id,
            section
          )
        `
      )
      .in("student_id", studentDbIds);

    if (period.start_date) resultsQuery = resultsQuery.gte("exams.exam_date", period.start_date);
    if (period.end_date) resultsQuery = resultsQuery.lte("exams.exam_date", period.end_date);
    if (grade_id !== undefined) resultsQuery = resultsQuery.eq("exams.grade_id", grade_id);
    if (section !== undefined) resultsQuery = resultsQuery.eq("exams.section", section);

    const { data: results, error: resultsError } = await resultsQuery;
    if (resultsError) {
      return NextResponse.json({ error: resultsError.message }, { status: 500 });
    }

    const examRows: {
      enrollment_id: number;
      subject_id: number;
      exam_id: number | null;
      exam_title: string;
      exam_date: string | null;
      total_marks: number;
      marks_obtained: number;
      percentage: number | null;
    }[] = [];

    for (const r of results ?? []) {
      const enrollment_id = enrollmentByStudentId.get(r.student_id);
      const ex = (r as any).exams;
      if (!enrollment_id || !ex?.subject_id) continue;

      const totalMarks = Number(ex.total_marks ?? 0);
      const obtained = Number(r.total_marks_obtained ?? 0);
      const pct = totalMarks > 0 ? Math.round((obtained / totalMarks) * 10000) / 100 : null;

      examRows.push({
        enrollment_id,
        subject_id: Number(ex.subject_id),
        exam_id: Number(ex.id) || null,
        exam_title: String(ex.title ?? "Exam"),
        exam_date: ex.exam_date ?? null,
        total_marks: totalMarks,
        marks_obtained: obtained,
        percentage: pct,
      });
    }

    if (examRows.length > 0) {
      const { error: insertExamsError } = await admin.from("student_academic_exam_results").insert(examRows);
      if (insertExamsError) {
        return NextResponse.json({ error: insertExamsError.message }, { status: 500 });
      }
    }

    // 5) Build subject summaries from inserted examRows (per enrollment + subject)
    const summaryMap = new Map<
      string,
      { enrollment_id: number; subject_id: number; total_marks_obtained: number; total_possible_marks: number; exam_count: number }
    >();
    for (const row of examRows) {
      const key = `${row.enrollment_id}:${row.subject_id}`;
      const cur = summaryMap.get(key) ?? {
        enrollment_id: row.enrollment_id,
        subject_id: row.subject_id,
        total_marks_obtained: 0,
        total_possible_marks: 0,
        exam_count: 0,
      };
      cur.total_marks_obtained += row.marks_obtained;
      cur.total_possible_marks += row.total_marks;
      cur.exam_count += 1;
      summaryMap.set(key, cur);
    }

    const summaryRows = Array.from(summaryMap.values()).map((s) => ({
      enrollment_id: s.enrollment_id,
      subject_id: s.subject_id,
      total_marks_obtained: s.total_marks_obtained,
      total_possible_marks: s.total_possible_marks,
      exam_count: s.exam_count,
      average:
        s.total_possible_marks > 0
          ? Math.round((s.total_marks_obtained / s.total_possible_marks) * 10000) / 100
          : null,
      updated_at: new Date().toISOString(),
    }));

    if (summaryRows.length > 0) {
      const { error: upsertSummaryError } = await admin
        .from("student_academic_subject_summaries")
        .upsert(summaryRows, { onConflict: "enrollment_id,subject_id" });
      if (upsertSummaryError) {
        return NextResponse.json({ error: upsertSummaryError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      period: { id: period.id, academic_year: period.academic_year, term: period.term },
      students: students.length,
      enrollments: enrollmentIds.length,
      exams_snapshotted: examRows.length,
      subjects_summarized: summaryRows.length,
    });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[results-archive/snapshot] POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

