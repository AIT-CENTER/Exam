/**
 * Admin system settings: max_risk_before_submit, max_time_extension_minutes.
 * Used by teacher add-time (respects max) and exam activity (risk auto-submit).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseClient";

const DEFAULTS = {
  max_risk_before_submit: 7,
  max_time_extension_minutes: 30,
  enable_results_archive: false,
  enable_student_results_portal: false,
  enable_student_teacher_chat: false,
  enable_realtime_features: false,
  student_current_results_mode: "semester_1" as "semester_1" | "full_year",
  current_academic_year: null as number | null,
};

export async function GET() {
  try {
    // Only authenticated admins may view settings (role check in application).
    const cookieStore = await cookies();
    const supabase = createServerClient(
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(DEFAULTS, { status: 401 });
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("system_settings")
      .select(
        [
          "max_risk_before_submit",
          "max_time_extension_minutes",
          "enable_results_archive",
          "enable_student_results_portal",
          "enable_student_teacher_chat",
          "enable_realtime_features",
          "student_current_results_mode",
          "current_academic_year",
        ].join(",")
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(DEFAULTS);
    }
    return NextResponse.json({
      max_risk_before_submit: data?.max_risk_before_submit ?? DEFAULTS.max_risk_before_submit,
      max_time_extension_minutes: data?.max_time_extension_minutes ?? DEFAULTS.max_time_extension_minutes,
      enable_results_archive: Boolean(data?.enable_results_archive ?? DEFAULTS.enable_results_archive),
      enable_student_results_portal: Boolean(data?.enable_student_results_portal ?? DEFAULTS.enable_student_results_portal),
      enable_student_teacher_chat: Boolean(data?.enable_student_teacher_chat ?? DEFAULTS.enable_student_teacher_chat),
      enable_realtime_features: Boolean(data?.enable_realtime_features ?? DEFAULTS.enable_realtime_features),
      student_current_results_mode:
        (data?.student_current_results_mode as any) === "full_year" ? "full_year" : "semester_1",
      current_academic_year: data?.current_academic_year ?? DEFAULTS.current_academic_year,
    });
  } catch (e) {
    console.error("[system-settings]", e);
    return NextResponse.json(DEFAULTS);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminRow } = await supabase
      .from("admin")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (!adminRow || adminRow.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const max_risk_before_submit = body.max_risk_before_submit ?? DEFAULTS.max_risk_before_submit;
    const max_time_extension_minutes = body.max_time_extension_minutes ?? DEFAULTS.max_time_extension_minutes;
    const enable_results_archive = body.enable_results_archive ?? DEFAULTS.enable_results_archive;
    const enable_student_results_portal = body.enable_student_results_portal ?? DEFAULTS.enable_student_results_portal;
    const enable_student_teacher_chat = body.enable_student_teacher_chat ?? DEFAULTS.enable_student_teacher_chat;
    const enable_realtime_features = body.enable_realtime_features ?? DEFAULTS.enable_realtime_features;
    const student_current_results_mode =
      body.student_current_results_mode === "full_year" ? "full_year" : "semester_1";

    const admin = supabaseAdmin();

    // Do not allow changing current_academic_year from Settings (locked).
    // It can be derived from the active academic_period(s) instead.
    const { data: existingYear } = await admin
      .from("system_settings")
      .select("current_academic_year")
      .eq("id", 1)
      .maybeSingle();

    const { error } = await admin
      .from("system_settings")
      .upsert(
        {
          id: 1,
          max_risk_before_submit: Number(max_risk_before_submit),
          max_time_extension_minutes: Number(max_time_extension_minutes),
          enable_results_archive: Boolean(enable_results_archive),
          enable_student_results_portal: Boolean(enable_student_results_portal),
          enable_student_teacher_chat: Boolean(enable_student_teacher_chat),
          enable_realtime_features: Boolean(enable_realtime_features),
          student_current_results_mode,
          current_academic_year: existingYear?.current_academic_year ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[system-settings]", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
