import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: adminRow, error: adminErr } = await admin
    .from("admin")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (adminErr || !adminRow) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const desiredRole = (adminRow.role as string | null) ?? "admin";
  const currentRole = (user.user_metadata as any)?.role ?? null;

  if (currentRole !== desiredRole) {
    const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata || {}),
        role: desiredRole,
      },
    });

    if (updateErr) {
      console.error("[admin/sync-role-claim] update user metadata failed", {
        message: (updateErr as any)?.message,
        code: (updateErr as any)?.code,
      });
      // Non-fatal: login can continue even without claim sync
    }
  }

  return NextResponse.json({ ok: true, role: desiredRole }, { status: 200 });
}

