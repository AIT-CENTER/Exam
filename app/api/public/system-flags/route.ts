import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

type TermKey = "semester_1" | "semester_2" | "full_year";

export async function GET() {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("system_settings")
      .select(
        [
          "enable_results_archive",
          "enable_student_results_portal",
          "enable_student_teacher_chat",
          "enable_realtime_features",
          "student_current_results_mode",
          "current_academic_year",
          "current_semester_1_start",
          "current_semester_1_end",
          "current_semester_2_start",
          "current_semester_2_end",
          "current_full_year_start",
          "current_full_year_end",
        ].join(",")
      )
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          enable_results_archive: false,
          enable_student_results_portal: false,
          enable_student_teacher_chat: false,
          enable_realtime_features: false,
          student_current_results_mode: "semester_1",
          current_academic_year: null,
          terms: {} as Record<TermKey, { start: string | null; end: string | null }>,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        enable_results_archive: Boolean(data?.enable_results_archive),
        enable_student_results_portal: Boolean(data?.enable_student_results_portal),
        enable_student_teacher_chat: Boolean(data?.enable_student_teacher_chat),
        enable_realtime_features: Boolean(data?.enable_realtime_features),
        student_current_results_mode: data?.student_current_results_mode === "full_year" ? "full_year" : "semester_1",
        current_academic_year: data?.current_academic_year ?? null,
        terms: {
          semester_1: {
            start: data?.current_semester_1_start ?? null,
            end: data?.current_semester_1_end ?? null,
          },
          semester_2: {
            start: data?.current_semester_2_start ?? null,
            end: data?.current_semester_2_end ?? null,
          },
          full_year: {
            start: data?.current_full_year_start ?? null,
            end: data?.current_full_year_end ?? null,
          },
        } satisfies Record<TermKey, { start: string | null; end: string | null }>,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("[system-flags] GET error:", e);
    return NextResponse.json(
      {
        enable_results_archive: false,
        enable_student_results_portal: false,
        enable_student_teacher_chat: false,
        current_academic_year: null,
        terms: {} as Record<TermKey, { start: string | null; end: string | null }>,
      },
      { status: 200 }
    );
  }
}

