/**
 * Admin-only: list audit_logs (admin/teacher actions).
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
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
          setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as object)
            );
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: admin } = await supabase.from("admin").select("id").eq("id", user.id).single();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = supabaseAdmin();
    const { data, error } = await adminClient
      .from("audit_logs")
      .select("id, actor_type, actor_id, action, resource_type, resource_id, details, ip_address, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[admin audit-logs]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ logs: data ?? [] });
  } catch (e) {
    console.error("[admin audit-logs]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
