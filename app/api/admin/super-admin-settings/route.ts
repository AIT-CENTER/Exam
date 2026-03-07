import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/utils/supabase/server";

interface SuperAdminSettings {
  promotionEnabled: boolean;
}

/**
 * GET /api/admin/super-admin-settings
 * Retrieves super admin settings including feature flags
 * Requires Super Admin role
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[v0] super-admin-settings GET - Starting request");

    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("[v0] User check:", user ? `User ${user.id}` : "No user");

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { data: adminRow } = await supabase
      .from("admin")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    console.log("[v0] Admin check:", adminRow ? `Role: ${adminRow.role}` : "No admin record");

    if (!adminRow || adminRow.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only Super Admins can access this" },
        { status: 403 }
      );
    }

    // Fetch or create super admin settings
    const { data: settings, error: settingsError } = await supabase
      .from("super_admin_settings")
      .select("*")
      .maybeSingle();

    console.log("[v0] Settings fetch:", { hasSettings: !!settings, hasError: !!settingsError });

    if (settingsError && settingsError.code !== "PGRST116") {
      // PGRST116 means no rows returned
      console.error("[v0] Settings fetch error:", settingsError);
      throw new Error("Failed to fetch settings");
    }

    // Return default settings if none exist
    const defaultSettings: SuperAdminSettings = {
      promotionEnabled: false,
    };

    if (!settings) {
      console.log("[v0] No settings found, returning defaults");
      return NextResponse.json(defaultSettings);
    }

    return NextResponse.json({
      promotionEnabled: settings.promotion_enabled ?? false,
    });
  } catch (e) {
    console.error("[v0] Super admin settings GET error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/admin/super-admin-settings
 * Updates super admin settings
 * Requires Super Admin role
 */
export async function POST(request: NextRequest) {
  try {
    console.log("[v0] super-admin-settings POST - Starting request");

    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("[v0] User check:", user ? `User ${user.id}` : "No user");

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { data: adminRow } = await supabase
      .from("admin")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    console.log("[v0] Admin check:", adminRow ? `Role: ${adminRow.role}` : "No admin record");

    if (!adminRow || adminRow.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only Super Admins can modify settings" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { promotionEnabled } = body;

    console.log("[v0] Updating settings:", { promotionEnabled });

    // Upsert settings
    const { data: settings, error: upsertError } = await supabase
      .from("super_admin_settings")
      .upsert(
        {
          id: 1, // Single settings record
          promotion_enabled: promotionEnabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("[v0] Settings upsert error:", upsertError);
      throw new Error("Failed to update settings");
    }

    console.log("[v0] Settings updated successfully");

    return NextResponse.json({
      promotionEnabled: settings.promotion_enabled ?? false,
    });
  } catch (e) {
    console.error("[v0] Super admin settings POST error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
