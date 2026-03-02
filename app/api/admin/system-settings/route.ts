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
      .select("max_risk_before_submit, max_time_extension_minutes")
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(DEFAULTS);
    }
    return NextResponse.json({
      max_risk_before_submit: data?.max_risk_before_submit ?? DEFAULTS.max_risk_before_submit,
      max_time_extension_minutes: data?.max_time_extension_minutes ?? DEFAULTS.max_time_extension_minutes,
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

    const admin = supabaseAdmin();
    const { error } = await admin
      .from("system_settings")
      .upsert(
        {
          id: 1,
          max_risk_before_submit: Number(max_risk_before_submit),
          max_time_extension_minutes: Number(max_time_extension_minutes),
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
