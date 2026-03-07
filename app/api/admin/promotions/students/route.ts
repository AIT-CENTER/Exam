import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";

type AdminRole = "super_admin" | "admin";

interface StudentWithResults {
  id: number;
  name: string;
  student_id: string;
  grade_id: number;
  grade_name: string;
  section: string;
  stream: string | null;
  results_summary: {
    subject_name: string;
    total_marks: number;
    average_score: number;
    best_score: number;
  }[];
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: adminRow } = await supabase
      .from("admin")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!adminRow || !["super_admin", "admin"].includes(adminRow.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const search = searchParams.get("search") ?? "";
    const gradeFilter = searchParams.get("grade") ?? "";
    const limit = parseInt(searchParams.get("limit") ?? "10");

    const offset = (page - 1) * limit;

    // Base query for students with their grades
    let query = supabase
      .from("students")
      .select(
        `
        id,
        name,
        student_id,
        grade_id,
        section,
        stream,
        grades(id, name)
      `,
        { count: "exact" }
      );

    // Apply filters
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,student_id.ilike.%${search}%`
      );
    }

    if (gradeFilter && gradeFilter !== "all") {
      query = query.eq("grade_id", parseInt(gradeFilter));
    }

    // Execute query with pagination
    const { data: students, count, error } = await query
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[promotions/students] error:", error);
      return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
    }

    // Fetch results for each student
    const studentsWithResults = await Promise.all(
      (students ?? []).map(async (student: any) => {
        // Get exam results for this student in their current grade
        const { data: results } = await supabase
          .from("results")
          .select(
            `
            id,
            exam_id,
            subject_id,
            marks_obtained,
            exams(id, exam_name),
            subjects(id, subject_name)
          `
          )
          .eq("student_id", student.id)
          .eq("grade_id", student.grade_id);

        // Aggregate results by subject
        const resultsBySubject: Record<
          string,
          { subject_name: string; scores: number[] }
        > = {};

        (results ?? []).forEach((result: any) => {
          const subjectName = result.subjects?.subject_name || "Unknown";
          if (!resultsBySubject[subjectName]) {
            resultsBySubject[subjectName] = {
              subject_name: subjectName,
              scores: [],
            };
          }
          if (result.marks_obtained !== null) {
            resultsBySubject[subjectName].scores.push(result.marks_obtained);
          }
        });

        // Calculate summary per subject
        const resultsSummary = Object.values(resultsBySubject).map((subject) => {
          const scores = subject.scores;
          return {
            subject_name: subject.subject_name,
            total_marks: scores.reduce((a, b) => a + b, 0),
            average_score:
              scores.length > 0
                ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
                : 0,
            best_score: scores.length > 0 ? Math.max(...scores) : 0,
          };
        });

        return {
          id: student.id,
          name: student.name,
          student_id: student.student_id,
          grade_id: student.grade_id,
          grade_name: student.grades?.name || "Unknown",
          section: student.section,
          stream: student.stream,
          results_summary: resultsSummary,
        };
      })
    );

    return NextResponse.json({
      data: studentsWithResults,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (e) {
    console.error("[promotions/students] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
