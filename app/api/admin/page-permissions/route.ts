import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";

type AdminRole = "super_admin" | "admin";

type PermissionsResponse = {
  role: AdminRole;
  permissions: Record<string, boolean>;
  /** For super_admin: stored permissions for admin role (so they can edit in Settings) */
  adminRolePermissions?: Record<string, boolean>;
};

const PAGE_KEYS: string[] = [
  "dashboard_home",
  "analytics",
  "settings_system",
  "teachers_page",
  "teachers_create",
  "students_page",
  "students_create",
  "students_promotions",
  "results_archive",
  "grades_page",
  "grades_create",
  "subjects_page",
  "subjects_create",
  "exams_page",
];

// Pages restricted to super_admin only (hidden for admin users)
const SUPER_ADMIN_ONLY_PAGES = [
  "dashboard_home",
  "analytics",
  "settings_system",
  "teachers_page",
  "teachers_create",
  "exams_page",
];

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

export async function GET() {
  try {
    const supabase = await getSupabaseServer();
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

    if (!adminRow) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const role: AdminRole = (adminRow.role as AdminRole) ?? "super_admin";

    // Super admins always have full access; also return stored admin role permissions for Settings UI.
    if (role === "super_admin") {
      const full: PermissionsResponse = {
        role,
        permissions: PAGE_KEYS.reduce((acc, key) => {
          acc[key] = true;
          return acc;
        }, {} as Record<string, boolean>),
      };
      const { data: adminPerms } = await supabase
        .from("admin_page_permissions")
        .select("page_key, allowed")
        .eq("role", "admin");
      const adminMap: Record<string, boolean> = {};
      for (const row of adminPerms ?? []) {
        if (row?.page_key) adminMap[row.page_key as string] = Boolean(row.allowed);
      }
      full.adminRolePermissions = adminMap;
      return NextResponse.json(full);
    }

    const { data: perms, error } = await supabase
      .from("admin_page_permissions")
      .select("page_key, allowed")
      .eq("role", "admin");

    if (error) {
      console.error("[page-permissions] select error:", error);
      return NextResponse.json(
        {
          role,
          permissions: {},
        } satisfies PermissionsResponse,
        { status: 200 }
      );
    }

    const map: Record<string, boolean> = {};
    
    // Start with defaults: super_admin_only pages are hidden, others are visible
    for (const pageKey of PAGE_KEYS) {
      map[pageKey] = !SUPER_ADMIN_ONLY_PAGES.includes(pageKey);
    }
    
    // Override with database permissions if they exist
    for (const row of perms ?? []) {
      if (!row || !row.page_key) continue;
      map[row.page_key as string] = Boolean(row.allowed);
    }

    return NextResponse.json({
      role,
      permissions: map,
    } satisfies PermissionsResponse);
  } catch (e) {
    console.error("[page-permissions] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
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
    const pageKey = body.pageKey as string | undefined;
    const allowed = body.allowed as boolean | undefined;

    if (!pageKey || typeof allowed !== "boolean" || !PAGE_KEYS.includes(pageKey)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { error } = await supabase
      .from("admin_page_permissions")
      .upsert(
        {
          role: "admin",
          page_key: pageKey,
          allowed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "role,page_key" }
      );

    if (error) {
      console.error("[page-permissions] upsert error:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[page-permissions] PUT error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

