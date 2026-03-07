import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

// In-memory cache for settings (single source of truth for feature flags)
let featureFlags = {
  promotionEnabled: false,
  lastUpdated: new Date().toISOString(),
};

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

    console.log("[v0] Returning settings:", featureFlags);

    return NextResponse.json({
      promotionEnabled: featureFlags.promotionEnabled,
      lastUpdated: featureFlags.lastUpdated,
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

    if (typeof promotionEnabled !== "boolean") {
      return NextResponse.json(
        { error: "promotionEnabled must be a boolean" },
        { status: 400 }
      );
    }

    console.log("[v0] Updating settings:", { promotionEnabled });

    // Update in-memory cache
    featureFlags = {
      promotionEnabled,
      lastUpdated: new Date().toISOString(),
    };

    console.log("[v0] Settings updated successfully:", featureFlags);

    return NextResponse.json({
      promotionEnabled: featureFlags.promotionEnabled,
      lastUpdated: featureFlags.lastUpdated,
      message: "Promotion feature " + (promotionEnabled ? "enabled" : "disabled"),
    });
  } catch (e) {
    console.error("[v0] Super admin settings POST error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
