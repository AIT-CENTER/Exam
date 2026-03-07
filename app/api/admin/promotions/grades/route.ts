import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";

interface GradeInfo {
  id: number;
  name: string;
  hasStream: boolean;
  availableStreams: string[];
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
    console.log("[v0] promotions/grades GET - Starting request");
    
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

    // Fetch all grades
    const { data: grades, error: gradesError } = await supabase
      .from("grades")
      .select("id, grade_name, has_stream")
      .order("id", { ascending: true });

    console.log("[v0] Grades fetch result:", { count: grades?.length, hasError: !!gradesError });

    if (gradesError) {
      console.error("[v0] Grades fetch error:", gradesError);
      return NextResponse.json(
        { error: "Failed to fetch grades" },
        { status: 500 }
      );
    }

    // For each grade, fetch available streams from grade_sections
    const gradesWithStreams: GradeInfo[] = await Promise.all(
      (grades ?? []).map(async (grade: any) => {
        let availableStreams: string[] = [];

        if (grade.has_stream) {
          const { data: sections } = await supabase
            .from("grade_sections")
            .select("stream")
            .eq("grade_id", grade.id)
            .not("stream", "is", null);

          // Get unique stream values
          const streams = new Set(
            (sections ?? []).map((s: any) => s.stream).filter(Boolean)
          );
          availableStreams = Array.from(streams);
        }

        return {
          id: grade.id,
          name: grade.grade_name,
          hasStream: grade.has_stream ?? false,
          availableStreams,
        };
      })
    );

    console.log("[v0] Returning", gradesWithStreams.length, "grades");
    
    return NextResponse.json({
      data: gradesWithStreams,
    });
  } catch (e) {
    console.error("[v0] Promotions/grades GET error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
