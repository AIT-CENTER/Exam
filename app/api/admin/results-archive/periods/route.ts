import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminUser } from "@/lib/requireAdmin";

type TermKey = "semester_1" | "semester_2" | "full_year";

export async function GET() {
  try {
    await requireAdminUser();
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("academic_periods")
      .select("id, academic_year, term, label, start_date, end_date, is_current, created_at, updated_at")
      .order("academic_year", { ascending: false })
      .order("term", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ periods: data ?? [] });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[results-archive/periods] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminUser();
    const body = await request.json().catch(() => ({}));

    const academic_year = Number(body.academic_year);
    const term = body.term as TermKey | undefined;
    const label = typeof body.label === "string" ? body.label : null;
    const start_date = typeof body.start_date === "string" ? body.start_date : null;
    const end_date = typeof body.end_date === "string" ? body.end_date : null;
    const is_current = Boolean(body.is_current);

    if (!Number.isFinite(academic_year) || academic_year < 1990 || academic_year > 2100) {
      return NextResponse.json({ error: "Invalid academic_year" }, { status: 400 });
    }
    if (!term || !["semester_1", "semester_2", "full_year"].includes(term)) {
      return NextResponse.json({ error: "Invalid term" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    if (is_current) {
      // Only one current period at a time
      await admin.from("academic_periods").update({ is_current: false }).neq("id", 0);
    }

    const { data, error } = await admin
      .from("academic_periods")
      .upsert(
        {
          academic_year,
          term,
          label,
          start_date,
          end_date,
          is_current,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "academic_year,term" }
      )
      .select("id, academic_year, term, label, start_date, end_date, is_current")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ period: data }, { status: 200 });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[results-archive/periods] POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

