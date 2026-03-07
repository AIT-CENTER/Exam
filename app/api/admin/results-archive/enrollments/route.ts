import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminUser } from "@/lib/requireAdmin";

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser();

    const { searchParams } = new URL(request.url);
    const period_id = Number(searchParams.get("period_id"));
    const grade_id = searchParams.get("grade_id") ? Number(searchParams.get("grade_id")) : undefined;
    const section = searchParams.get("section") ? String(searchParams.get("section")) : undefined;
    const stream = searchParams.has("stream") ? searchParams.get("stream") : undefined; // may be null
    const q = (searchParams.get("q") || "").trim();

    if (!Number.isFinite(period_id) || period_id <= 0) {
      return NextResponse.json({ error: "period_id is required" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    let query = admin
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
            grandfather_name
          ),
          grades (
            grade_name
          ),
          student_academic_subject_summaries (
            total_marks_obtained,
            total_possible_marks
          )
        `
      )
      .eq("period_id", period_id)
      .order("section", { ascending: true })
      .order("id", { ascending: true });

    if (grade_id !== undefined && Number.isFinite(grade_id) && grade_id > 0) query = query.eq("grade_id", grade_id);
    if (section) query = query.eq("section", section);
    if (stream !== undefined) {
      if (stream === null) query = query.is("stream", null);
      else query = query.eq("stream", stream);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? [])
      .map((e: any) => {
        const s = e.students;
        const fullName = [s?.name, s?.father_name, s?.grandfather_name].filter(Boolean).join(" ");
        const summaries = (e.student_academic_subject_summaries ?? []) as any[];
        const totalObt = summaries.reduce((acc, r) => acc + Number(r.total_marks_obtained ?? 0), 0);
        const totalPos = summaries.reduce((acc, r) => acc + Number(r.total_possible_marks ?? 0), 0);
        const overallPct = totalPos > 0 ? Math.round((totalObt / totalPos) * 10000) / 100 : null;
        return {
          enrollment_id: e.id,
          student_db_id: s?.id ?? null,
          student_number: s?.student_id ?? null,
          full_name: fullName,
          grade_id: e.grade_id,
          grade_name: e.grades?.grade_name ?? null,
          section: e.section,
          stream: e.stream ?? null,
          subjects: summaries.length,
          total_marks_obtained: totalObt,
          total_possible_marks: totalPos,
          overall_percentage: overallPct,
        };
      })
      .filter((r) => {
        if (!q) return true;
        const qq = q.toLowerCase();
        return (
          safeStr(r.student_number).toLowerCase().includes(qq) ||
          safeStr(r.full_name).toLowerCase().includes(qq)
        );
      });

    return NextResponse.json({ enrollments: rows });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[results-archive/enrollments] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

