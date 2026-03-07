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
      .select("enable_student_results_portal, current_academic_year")
      .eq("id", 1)
      .maybeSingle();

    if (!sys?.enable_student_results_portal) {
      return NextResponse.json({ error: "Student results portal is disabled" }, { status: 403 });
    }

    let q = admin
      .from("academic_periods")
      .select("id, academic_year, term, label, start_date, end_date, is_current")
      .order("academic_year", { ascending: false })
      .order("term", { ascending: true });

    // Prefer keeping the list reasonable for students
    if (sys?.current_academic_year) {
      q = q.gte("academic_year", Number(sys.current_academic_year) - 5);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ periods: data ?? [] }, { status: 200 });
  } catch (e) {
    console.error("[student/periods] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

