import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";

interface PromotionRequest {
  promotions: {
    studentId: number;
    targetGradeId: number;
    targetStream: string | null;
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

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] promotions/execute POST - Starting request");
    
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("[v0] User check:", user ? `User ${user.id}` : "No user");

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: adminRow } = await supabase
      .from("admin")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    console.log("[v0] Admin check:", adminRow ? `Role: ${adminRow.role}` : "No admin record");

    if (!adminRow || !["super_admin", "admin"].includes(adminRow.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse request body
    const body: PromotionRequest = await request.json();

    console.log("[v0] Request body promotions count:", body.promotions?.length);

    if (!body.promotions || !Array.isArray(body.promotions) || body.promotions.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: promotions array required" },
        { status: 400 }
      );
    }

    // Validate all promotions
    const studentIds = body.promotions.map((p) => p.studentId);
    const targetGradeIds = body.promotions.map((p) => p.targetGradeId);

    // Fetch all students to validate and get their current grades
    const { data: students, error: studentError } = await supabase
      .from("students")
      .select("id, name, grade_id, stream, grades(id, grade_name)")
      .in("id", studentIds);

    if (studentError || !students) {
      return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
    }

    if (students.length !== studentIds.length) {
      return NextResponse.json({ error: "One or more students not found" }, { status: 404 });
    }

    // Fetch target grades to validate
    const { data: targetGrades, error: gradesError } = await supabase
      .from("grades")
      .select("id, grade_name, has_stream")
      .in("id", targetGradeIds);

    if (gradesError || !targetGrades) {
      return NextResponse.json({ error: "Failed to fetch target grades" }, { status: 500 });
    }

    if (targetGrades.length !== new Set(targetGradeIds).size) {
      return NextResponse.json({ error: "One or more target grades not found" }, { status: 404 });
    }

    // Create a map for easier lookup
    const gradeMap = new Map(targetGrades.map((g) => [g.id, g]));
    const studentMap = new Map(students.map((s) => [s.id, s]));

    // Validate streams for grades that require them
    for (const promotion of body.promotions) {
      const targetGrade = gradeMap.get(promotion.targetGradeId);
      if (targetGrade?.has_stream && !promotion.targetStream) {
        return NextResponse.json(
          {
            error: `Grade "${targetGrade.name}" requires a stream assignment`,
          },
          { status: 400 }
        );
      }

      if (targetGrade?.has_stream && promotion.targetStream) {
        // Validate that the stream exists for this grade
        const { data: validStream } = await supabase
          .from("grade_sections")
          .select("id")
          .eq("grade_id", promotion.targetGradeId)
          .eq("stream", promotion.targetStream)
          .maybeSingle();

        if (!validStream) {
          return NextResponse.json(
            {
              error: `Invalid stream "${promotion.targetStream}" for grade "${targetGrade.name}"`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Execute promotions - update each student
    const updatedStudents = [];
    const errors = [];

    for (const promotion of body.promotions) {
      try {
        const student = studentMap.get(promotion.studentId);
        const oldGrade = student?.grades?.name || "Unknown";
        const targetGrade = gradeMap.get(promotion.targetGradeId);
        const newGrade = targetGrade?.name || "Unknown";

        // Update student's grade and stream
        const { error: updateError } = await supabase
          .from("students")
          .update({
            grade_id: promotion.targetGradeId,
            stream: promotion.targetStream || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", promotion.studentId);

        if (updateError) {
          errors.push({
            studentId: promotion.studentId,
            error: updateError.message,
          });
          continue;
        }

        // Create audit log entry
        const { error: auditError } = await supabase
          .from("audit_logs")
          .insert({
            action: "student_promotion",
            admin_id: user.id,
            student_id: promotion.studentId,
            details: {
              old_grade: oldGrade,
              new_grade: newGrade,
              old_stream: student?.stream || null,
              new_stream: promotion.targetStream || null,
              student_name: student?.name,
            },
            created_at: new Date().toISOString(),
          });

        if (auditError) {
          console.warn("[promotions/execute] audit log warning:", auditError);
          // Don't fail the promotion if audit fails
        }

        updatedStudents.push({
          id: promotion.studentId,
          name: student?.name,
          oldGrade,
          newGrade,
          newStream: promotion.targetStream || null,
        });
      } catch (e) {
        errors.push({
          studentId: promotion.studentId,
          error: String(e),
        });
      }
    }

    // Return results
    console.log("[v0] Promotion complete:", { 
      successCount: updatedStudents.length, 
      errorCount: errors.length 
    });

    if (errors.length > 0 && updatedStudents.length === 0) {
      // All promotions failed
      return NextResponse.json(
        {
          error: "All promotions failed",
          details: errors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully promoted ${updatedStudents.length} student(s)`,
      updatedStudents,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("[v0] Promotions/execute POST error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
