import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseClient";

type AdminRole = "super_admin" | "admin";

type GradeRow = {
  id: number;
  grade_name: string;
  has_stream?: boolean | null;
};

function isStreamedGrade(grade: GradeRow | null | undefined) {
  if (!grade) return false;
  if (typeof grade.has_stream === "boolean") return grade.has_stream;
  return grade.grade_name.includes("11") || grade.grade_name.includes("12");
}

const PROMOTABLE_GRADE_NUMBERS = [9, 10, 11] as const;

function parseGradeNumber(gradeName: string) {
  const m = gradeName.match(/(\d+)/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function isPromotableGrade(grade: GradeRow | null | undefined): boolean {
  if (!grade) return false;
  const num = parseGradeNumber(grade.grade_name);
  return num != null && (PROMOTABLE_GRADE_NUMBERS as readonly number[]).includes(num);
}

function findNextGrade(current: GradeRow, all: GradeRow[]) {
  const curNum = parseGradeNumber(current.grade_name);
  if (curNum != null) {
    const targetNum = curNum + 1;
    const byNum = all.find((g) => parseGradeNumber(g.grade_name) === targetNum);
    if (byNum) return byNum;
  }

  // Fallback: next by id order
  const sorted = [...all].sort((a, b) => a.id - b.id);
  const idx = sorted.findIndex((g) => g.id === current.id);
  if (idx >= 0 && idx + 1 < sorted.length) return sorted[idx + 1];
  return null;
}

async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as CookieOptions)
          );
        },
      },
    }
  );
}

async function requireAdmin(requestedPageKey?: string) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const { data: adminRow } = await supabase
    .from("admin")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  const role: AdminRole = (adminRow.role as AdminRole) ?? "super_admin";

  if (requestedPageKey && role === "admin") {
    const { data: permRow, error: permError } = await supabase
      .from("admin_page_permissions")
      .select("allowed")
      .eq("role", "admin")
      .eq("page_key", requestedPageKey)
      .maybeSingle();

    if (permError) {
      console.error("[student-promotions] permission error:", permError);
      return { ok: false as const, status: 403, error: "Forbidden" };
    }

    const allowed =
      requestedPageKey === "students_promotions"
        ? permRow?.allowed === true
        : (permRow?.allowed ?? true);
    if (!allowed) return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, role, userId: user.id };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin("students_promotions");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const adminClient = supabaseAdmin();

    const { searchParams } = new URL(request.url);
    const gradeIdRaw = searchParams.get("gradeId");
    const studentIdRaw = searchParams.get("studentId");

    // Detail endpoint: /api/admin/student-promotions/student?...
    if (request.nextUrl.pathname.endsWith("/student-promotions/student")) {
      const gradeId = Number.parseInt(gradeIdRaw || "", 10);
      const studentId = Number.parseInt(studentIdRaw || "", 10);
      if (!Number.isFinite(gradeId) || !Number.isFinite(studentId)) {
        return NextResponse.json({ error: "Invalid gradeId/studentId" }, { status: 400 });
      }

      const [{ data: grade }, { data: student }] = await Promise.all([
        adminClient.from("grades").select("id, grade_name, has_stream").eq("id", gradeId).maybeSingle(),
        adminClient
          .from("students")
          .select("id, student_id, name, father_name, grandfather_name, section, stream, grade_id, grades!students_grade_id_fkey(grade_name)")
          .eq("id", studentId)
          .maybeSingle(),
      ]);

      if (!grade) return NextResponse.json({ error: "Grade not found" }, { status: 404 });
      if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

      // Registered subjects for this grade (stream-aware)
      const { data: gradeSubjects } = await adminClient
        .from("grade_subjects")
        .select("subject_id, stream")
        .eq("grade_id", gradeId);

      const subjectIds = Array.from(new Set((gradeSubjects ?? []).map((r: any) => r.subject_id).filter(Boolean)));
      const { data: subjects } = subjectIds.length
        ? await adminClient.from("subjects").select("id, subject_name, stream").in("id", subjectIds)
        : { data: [] as any[] };

      const byId = new Map<number, { id: number; subject_name: string; stream: string | null }>();
      (subjects ?? []).forEach((s: any) => byId.set(s.id, { id: s.id, subject_name: s.subject_name, stream: s.stream ?? null }));

      const gradeHasStreams = isStreamedGrade(grade as any);
      const studentStream = (student as any).stream as string | null;
      const registeredIds = new Set<number>();

      for (const gs of gradeSubjects ?? []) {
        const sid = (gs as any).subject_id as number;
        const stream = ((gs as any).stream as string | null) ?? "Common";
        if (!Number.isFinite(sid)) continue;

        if (!gradeHasStreams) {
          registeredIds.add(sid);
          continue;
        }

        if (stream === "Common") registeredIds.add(sid);
        if (studentStream && stream === studentStream) registeredIds.add(sid);
      }

      const registeredSubjects = Array.from(registeredIds)
        .map((id) => byId.get(id))
        .filter(Boolean)
        .sort((a, b) => a!.subject_name.localeCompare(b!.subject_name))
        .map((s) => ({ subject_id: s!.id, subject_name: s!.subject_name, stream: s!.stream }));

      // Results for this student in this grade (grade is derived from exams.grade_id)
      const { data: exams } = await adminClient
        .from("exams")
        .select("id, title, exam_date, total_marks, subject_id, grade_id")
        .eq("grade_id", gradeId);

      const examMap = new Map<number, { title: string; exam_date: string; total_marks: number; subject_id: number }>();
      const examIds: number[] = [];
      (exams ?? []).forEach((e: any) => {
        examIds.push(e.id);
        examMap.set(e.id, {
          title: e.title ?? "Exam",
          exam_date: e.exam_date ?? null,
          total_marks: e.total_marks ?? 0,
          subject_id: e.subject_id,
        });
      });

      const { data: results } =
        examIds.length > 0
          ? await adminClient
              .from("results")
              .select("exam_id, student_id, total_marks_obtained")
              .eq("student_id", studentId)
              .in("exam_id", examIds)
          : { data: [] as any[] };

      const bySubject = new Map<number, SubjectAgg>();
      type SubjectAgg = {
        subject_id: number;
        exam_count: number;
        total_marks_obtained: number;
        total_possible_marks: number;
      };

      for (const r of results ?? []) {
        const examId = (r as any).exam_id as number;
        const obtained = Number((r as any).total_marks_obtained ?? 0);
        const exam = examMap.get(examId);
        if (!exam) continue;
        const subjId = exam.subject_id;
        const total = Number(exam.total_marks ?? 0);

        const prev = bySubject.get(subjId) ?? {
          subject_id: subjId,
          exam_count: 0,
          total_marks_obtained: 0,
          total_possible_marks: 0,
        };
        prev.exam_count += 1;
        prev.total_marks_obtained += obtained;
        prev.total_possible_marks += total;
        bySubject.set(subjId, prev);
      }

      const subjectSummaries = registeredSubjects
        .map((sub) => {
          const agg = bySubject.get(sub.subject_id) ?? {
            subject_id: sub.subject_id,
            exam_count: 0,
            total_marks_obtained: 0,
            total_possible_marks: 0,
          };
          const percentage =
            agg.total_possible_marks > 0
              ? Number(((agg.total_marks_obtained / agg.total_possible_marks) * 100).toFixed(2))
              : null;
          return {
            subject_id: sub.subject_id,
            subject_name: sub.subject_name,
            stream: sub.stream,
            exam_count: agg.exam_count,
            total_marks_obtained: agg.total_marks_obtained,
            total_possible_marks: agg.total_possible_marks,
            percentage,
          };
        })
        .sort((a, b) => a.subject_name.localeCompare(b.subject_name));

      // Per-subject exam-level results for tabs (all subjects the student studies)
      const resultByExam = new Map<number, number>();
      for (const r of results ?? []) {
        resultByExam.set((r as any).exam_id, Number((r as any).total_marks_obtained ?? 0));
      }
      const subject_exam_results = registeredSubjects
        .map((sub) => {
          const examList: { exam_id: number; exam_title: string; exam_date: string | null; total_marks: number; marks_obtained: number; percentage: number | null }[] = [];
          for (const [eid, meta] of examMap) {
            if (meta.subject_id !== sub.subject_id) continue;
            const obtained = resultByExam.get(eid) ?? 0;
            const total = meta.total_marks || 0;
            const percentage = total > 0 ? Number(((obtained / total) * 100).toFixed(2)) : null;
            examList.push({
              exam_id: eid,
              exam_title: meta.title,
              exam_date: meta.exam_date,
              total_marks: total,
              marks_obtained: obtained,
              percentage,
            });
          }
          examList.sort((a, b) => (a.exam_date || "").localeCompare(b.exam_date || ""));
          return {
            subject_id: sub.subject_id,
            subject_name: sub.subject_name,
            stream: sub.stream,
            exams: examList,
          };
        })
        .sort((a, b) => a.subject_name.localeCompare(b.subject_name));

      return NextResponse.json({
        student: {
          id: (student as any).id,
          student_id: (student as any).student_id,
          name: (student as any).name,
          father_name: (student as any).father_name ?? "",
          grandfather_name: (student as any).grandfather_name ?? "",
          section: (student as any).section,
          stream: (student as any).stream ?? null,
          grade_id: (student as any).grade_id,
          grade_name: (student as any).grades?.grade_name ?? "Unknown",
        },
        grade: { id: (grade as any).id, grade_name: (grade as any).grade_name, has_stream: (grade as any).has_stream },
        registered_subjects: registeredSubjects,
        subject_summaries: subjectSummaries,
        subject_exam_results: subject_exam_results,
      });
    }

    // List endpoint: /api/admin/student-promotions?gradeId=...
    const { data: grades, error: gradesError } = await adminClient
      .from("grades")
      .select("id, grade_name, has_stream")
      .order("id", { ascending: true });

    if (gradesError) {
      console.error("[student-promotions] grades error:", gradesError);
      return NextResponse.json({ error: "Failed to load grades" }, { status: 500 });
    }

    if (!gradeIdRaw) {
      const promotableOnly = (grades ?? []).filter((g: any) =>
        isPromotableGrade(g as GradeRow)
      );
      return NextResponse.json({ grades: promotableOnly });
    }

    const gradeId = Number.parseInt(gradeIdRaw, 10);
    if (!Number.isFinite(gradeId)) {
      return NextResponse.json({ error: "Invalid gradeId" }, { status: 400 });
    }

    const allGrades = grades ?? [];
    const current = allGrades.find((g: any) => g.id === gradeId) ?? null;
    if (!current) {
      return NextResponse.json({ error: "Grade not found" }, { status: 404 });
    }
    const next = isPromotableGrade(current as GradeRow)
      ? findNextGrade(current as any, allGrades as any)
      : null;

    const { data: students, error: studentsError } = await adminClient
      .from("students")
      .select("id, student_id, name, father_name, grandfather_name, section, stream, grade_id")
      .eq("grade_id", gradeId)
      .order("name", { ascending: true });

    if (studentsError) {
      console.error("[student-promotions] students error:", studentsError);
      return NextResponse.json({ error: "Failed to load students" }, { status: 500 });
    }

    const studentIds = (students ?? []).map((s: any) => s.id as number);

    // Subjects for this grade (stream-aware count)
    const { data: gradeSubjects } = await adminClient
      .from("grade_subjects")
      .select("subject_id, stream")
      .eq("grade_id", gradeId);

    const gradeHasStreams = isStreamedGrade(current as any);
    const commonSubjectIds = new Set<number>();
    const naturalSubjectIds = new Set<number>();
    const socialSubjectIds = new Set<number>();
    const allSubjectIds = new Set<number>();

    for (const gs of gradeSubjects ?? []) {
      const sid = (gs as any).subject_id as number;
      const stream = ((gs as any).stream as string | null) ?? "Common";
      if (!Number.isFinite(sid)) continue;
      allSubjectIds.add(sid);
      if (stream === "Common") commonSubjectIds.add(sid);
      if (stream === "Natural") naturalSubjectIds.add(sid);
      if (stream === "Social") socialSubjectIds.add(sid);
    }

    // Exams + results for this grade (for aggregates)
    const { data: exams, error: examsError } = await adminClient
      .from("exams")
      .select("id, total_marks, subject_id, grade_id")
      .eq("grade_id", gradeId);

    if (examsError) {
      console.error("[student-promotions] exams error:", examsError);
      return NextResponse.json({ error: "Failed to load exams" }, { status: 500 });
    }

    const examMap = new Map<number, { total_marks: number; subject_id: number }>();
    const examIds: number[] = [];
    (exams ?? []).forEach((e: any) => {
      examIds.push(e.id);
      examMap.set(e.id, { total_marks: e.total_marks ?? 0, subject_id: e.subject_id });
    });

    const { data: results } =
      examIds.length > 0 && studentIds.length > 0
        ? await adminClient
            .from("results")
            .select("exam_id, student_id, total_marks_obtained")
            .in("exam_id", examIds)
            .in("student_id", studentIds)
        : { data: [] as any[] };

    const agg = new Map<number, { exams_taken: number; obtained: number; possible: number }>();
    for (const r of results ?? []) {
      const studentId = (r as any).student_id as number;
      const examId = (r as any).exam_id as number;
      const obtained = Number((r as any).total_marks_obtained ?? 0);
      const exam = examMap.get(examId);
      if (!exam) continue;
      const possible = Number(exam.total_marks ?? 0);

      const prev = agg.get(studentId) ?? { exams_taken: 0, obtained: 0, possible: 0 };
      prev.exams_taken += 1;
      prev.obtained += obtained;
      prev.possible += possible;
      agg.set(studentId, prev);
    }

    const computedStudents = (students ?? []).map((s: any) => {
      const a = agg.get(s.id) ?? { exams_taken: 0, obtained: 0, possible: 0 };
      const overall_percentage =
        a.possible > 0 ? Number(((a.obtained / a.possible) * 100).toFixed(2)) : null;

      let registeredCount = 0;
      if (!gradeHasStreams) {
        registeredCount = allSubjectIds.size;
      } else {
        const st = (s.stream as string | null) ?? null;
        if (st === "Natural") registeredCount = new Set([...commonSubjectIds, ...naturalSubjectIds]).size;
        else if (st === "Social") registeredCount = new Set([...commonSubjectIds, ...socialSubjectIds]).size;
        else registeredCount = commonSubjectIds.size;
      }

      return {
        id: s.id,
        student_id: s.student_id,
        name: s.name,
        father_name: s.father_name,
        grandfather_name: s.grandfather_name,
        section: s.section,
        stream: s.stream ?? null,
        grade_id: s.grade_id,
        registered_subjects_count: registeredCount,
        exams_taken: a.exams_taken,
        overall_percentage,
      };
    });

    return NextResponse.json({
      grades: grades ?? [],
      currentGrade: current,
      nextGrade: next,
      students: computedStudents,
    });
  } catch (e) {
    console.error("[student-promotions] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin("students_promotions");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => null);
    const fromGradeId = Number.parseInt(String(body?.fromGradeId ?? ""), 10);
    const toGradeId = Number.parseInt(String(body?.toGradeId ?? ""), 10);
    const studentIds = Array.isArray(body?.studentIds) ? (body.studentIds as any[]).map((n) => Number(n)) : [];
    const streamForAll = typeof body?.streamForAll === "string" ? body.streamForAll : undefined;
    const streamByStudentId =
      body?.streamByStudentId && typeof body.streamByStudentId === "object" ? (body.streamByStudentId as Record<string, string>) : undefined;

    if (!Number.isFinite(fromGradeId) || !Number.isFinite(toGradeId) || studentIds.length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const adminClient = supabaseAdmin();

    const { data: grades } = await adminClient
      .from("grades")
      .select("id, grade_name, has_stream")
      .order("id", { ascending: true });

    const allGrades = grades ?? [];
    const fromGrade = allGrades.find((g: any) => g.id === fromGradeId) as GradeRow | undefined;
    const toGrade = allGrades.find((g: any) => g.id === toGradeId) as GradeRow | undefined;
    if (!fromGrade || !toGrade) return NextResponse.json({ error: "Grade not found" }, { status: 404 });
    if (!isPromotableGrade(fromGrade)) {
      return NextResponse.json(
        { error: "Upgrading is only allowed from Grade 9, 10, or 11" },
        { status: 400 }
      );
    }

    const expectedNext = findNextGrade(fromGrade, allGrades as any);
    if (!expectedNext || expectedNext.id !== toGradeId) {
      return NextResponse.json({ error: "Target grade must be the next grade" }, { status: 400 });
    }

    const { data: students, error: studentsError } = await adminClient
      .from("students")
      .select("id, grade_id, stream, section")
      .in("id", studentIds);

    if (studentsError) {
      console.error("[student-promotions] select students error:", studentsError);
      return NextResponse.json({ error: "Failed to load students" }, { status: 500 });
    }

    const notInFromGrade = (students ?? []).filter((s: any) => s.grade_id !== fromGradeId).map((s: any) => s.id);
    if (notInFromGrade.length > 0) {
      return NextResponse.json(
        { error: "Some students are not in the selected grade", studentIds: notInFromGrade },
        { status: 400 }
      );
    }

    const targetRequiresStream = isStreamedGrade(toGrade);
    const streamForStudent = (studentId: number) => {
      const per = streamByStudentId?.[String(studentId)];
      const s = per ?? streamForAll;
      return s === "Natural" || s === "Social" ? s : null;
    };

    if (targetRequiresStream) {
      const missing = studentIds.filter((id) => streamForStudent(id) == null);
      if (missing.length > 0) {
        return NextResponse.json({ error: "Stream required for target grade", missingStudentIds: missing }, { status: 400 });
      }
    }

    const nowIso = new Date().toISOString();

    let promotedCount = 0;
    const auditRows: any[] = [];

    // Optimization: if no streams required or one stream for all, a single update is enough.
    if (!targetRequiresStream) {
      const { error } = await adminClient
        .from("students")
        .update({ grade_id: toGradeId, stream: null, updated_at: nowIso })
        .in("id", studentIds);

      if (error) {
        console.error("[student-promotions] bulk update error:", error);
        return NextResponse.json({ error: "Promotion failed" }, { status: 500 });
      }

      promotedCount = studentIds.length;
      for (const id of studentIds) {
        auditRows.push({
          actor_type: "admin",
          actor_id: auth.userId,
          action: "promote_student",
          resource_type: "student",
          resource_id: String(id),
          details: { fromGradeId, toGradeId },
          ip_address: request.headers.get("x-forwarded-for") ?? null,
        });
      }
    } else if (streamForAll && (streamForAll === "Natural" || streamForAll === "Social") && !streamByStudentId) {
      const { error } = await adminClient
        .from("students")
        .update({ grade_id: toGradeId, stream: streamForAll, updated_at: nowIso })
        .in("id", studentIds);

      if (error) {
        console.error("[student-promotions] bulk update error:", error);
        return NextResponse.json({ error: "Promotion failed" }, { status: 500 });
      }

      promotedCount = studentIds.length;
      for (const id of studentIds) {
        auditRows.push({
          actor_type: "admin",
          actor_id: auth.userId,
          action: "promote_student",
          resource_type: "student",
          resource_id: String(id),
          details: { fromGradeId, toGradeId, stream: streamForAll },
          ip_address: request.headers.get("x-forwarded-for") ?? null,
        });
      }
    } else {
      // Per-student updates (stream may differ).
      for (const id of studentIds) {
        const targetStream = streamForStudent(id);
        const { error } = await adminClient
          .from("students")
          .update({ grade_id: toGradeId, stream: targetStream, updated_at: nowIso })
          .eq("id", id);

        if (error) {
          console.error("[student-promotions] update error:", { id, error });
          return NextResponse.json({ error: `Promotion failed for student ${id}` }, { status: 500 });
        }

        promotedCount += 1;
        auditRows.push({
          actor_type: "admin",
          actor_id: auth.userId,
          action: "promote_student",
          resource_type: "student",
          resource_id: String(id),
          details: { fromGradeId, toGradeId, stream: targetStream },
          ip_address: request.headers.get("x-forwarded-for") ?? null,
        });
      }
    }

    // Best-effort audit logging
    if (auditRows.length > 0) {
      const { error: auditError } = await adminClient.from("audit_logs").insert(auditRows);
      if (auditError) console.warn("[student-promotions] audit insert failed:", auditError);
    }

    return NextResponse.json({ ok: true, promotedCount });
  } catch (e) {
    console.error("[student-promotions] POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

