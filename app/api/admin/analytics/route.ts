/**
 * Admin-only: exam analytics for dashboard charts.
 * Provides real-time friendly aggregates (client polls every few seconds).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseClient";

type RangeKey = "week" | "month" | "year";

function clampRange(value: string | null): RangeKey {
  if (value === "week" || value === "month" || value === "year") return value;
  return "month";
}

function startDateFor(range: RangeKey, now: Date) {
  const d = new Date(now);
  if (range === "week") d.setDate(d.getDate() - 6);
  if (range === "month") d.setDate(d.getDate() - 29);
  if (range === "year") d.setFullYear(d.getFullYear() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function bucketKey(range: RangeKey, date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (range === "week" || range === "month") {
    // Daily buckets
    return d.toISOString().slice(0, 10);
  }
  // Monthly buckets for year
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function bucketLabel(range: RangeKey, key: string) {
  if (range === "year") return key; // YYYY-MM
  // key is YYYY-MM-DD
  return key.slice(5); // MM-DD (short, readable)
}

export async function GET(request: NextRequest) {
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: adminRow } = await supabase
      .from("admin")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (!adminRow) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const role = (adminRow.role as "super_admin" | "admin" | null) ?? "super_admin";

    // Only super admins or admins with analytics permission may access.
    if (role === "admin") {
      const { data: permRow, error: permError } = await supabase
        .from("admin_page_permissions")
        .select("allowed")
        .eq("role", "admin")
        .eq("page_key", "analytics")
        .maybeSingle();

      if (permError) {
        console.error("[admin analytics] permission error:", permError);
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const allowed = permRow?.allowed ?? false;
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const range = clampRange(searchParams.get("range"));

    const now = new Date();
    const from = startDateFor(range, now);
    const to = now;
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    const adminClient = supabaseAdmin();

    const [{ data: results, error: resultsError }, { data: riskLogs, error: riskLogsError }, { data: sessions, error: sessionsError }] =
      await Promise.all([
        adminClient
          .from("results")
          .select("exam_id, student_id, total_marks_obtained, submission_time, exams (title, total_marks)")
          .gte("submission_time", fromIso)
          .lte("submission_time", toIso),
        adminClient
          .from("exam_risk_logs")
          .select("event_type, timestamp")
          .gte("timestamp", fromIso)
          .lte("timestamp", toIso),
        adminClient
          .from("exam_sessions")
          .select("id, status, started_at, submitted_at, risk_count")
          .gte("started_at", fromIso)
          .lte("started_at", toIso),
      ]);

    if (resultsError) {
      console.error("[admin analytics] results:", resultsError);
      return NextResponse.json({ error: resultsError.message }, { status: 500 });
    }
    if (riskLogsError) {
      console.error("[admin analytics] risk logs:", riskLogsError);
      return NextResponse.json({ error: riskLogsError.message }, { status: 500 });
    }
    if (sessionsError) {
      console.error("[admin analytics] sessions:", sessionsError);
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    const rows = results ?? [];
    const logs = riskLogs ?? [];
    const sess = sessions ?? [];

    // Success threshold: 50% (no explicit pass mark in schema)
    const PASS_PCT = 50;

    let success = 0;
    let fail = 0;
    let totalPctSum = 0;
    let pctCount = 0;

    const buckets = new Map<string, {
      submissions: number;
      success: number;
      fail: number;
      pctSum: number;
      pctCount: number;
      riskEvents: number;
      riskCountSum: number;
      riskCountCount: number;
    }>();

    const ensureBucket = (key: string) => {
      if (!buckets.has(key)) {
        buckets.set(key, {
          submissions: 0,
          success: 0,
          fail: 0,
          pctSum: 0,
          pctCount: 0,
          riskEvents: 0,
          riskCountSum: 0,
          riskCountCount: 0,
        });
      }
      return buckets.get(key)!;
    };

    for (const r of rows as any[]) {
      const submittedAt = r.submission_time ? new Date(r.submission_time) : null;
      if (!submittedAt) continue;
      const totalMarks = r.exams?.total_marks ?? null;
      const obtained = typeof r.total_marks_obtained === "number" ? r.total_marks_obtained : 0;
      const pct = totalMarks ? (obtained / totalMarks) * 100 : null;

      const key = bucketKey(range, submittedAt);
      const b = ensureBucket(key);
      b.submissions += 1;

      if (pct != null && Number.isFinite(pct)) {
        b.pctSum += pct;
        b.pctCount += 1;
        totalPctSum += pct;
        pctCount += 1;
        if (pct >= PASS_PCT) {
          success += 1;
          b.success += 1;
        } else {
          fail += 1;
          b.fail += 1;
        }
      }
    }

    // Risk logs per bucket + type breakdown
    const riskByType: Record<string, number> = {};
    for (const l of logs as any[]) {
      const ts = l.timestamp ? new Date(l.timestamp) : null;
      if (!ts) continue;
      const key = bucketKey(range, ts);
      const b = ensureBucket(key);
      b.riskEvents += 1;
      const t = String(l.event_type || "unknown");
      riskByType[t] = (riskByType[t] ?? 0) + 1;
    }

    // Session risk_count average per bucket
    for (const s of sess as any[]) {
      const startedAt = s.started_at ? new Date(s.started_at) : null;
      if (!startedAt) continue;
      const key = bucketKey(range, startedAt);
      const b = ensureBucket(key);
      const rc = typeof s.risk_count === "number" ? s.risk_count : 0;
      b.riskCountSum += rc;
      b.riskCountCount += 1;
    }

    const series = Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, b]) => {
        const submissions = b.submissions;
        const avgScorePct = b.pctCount ? Math.round((b.pctSum / b.pctCount) * 10) / 10 : 0;
        const successRatePct = submissions ? Math.round((b.success / submissions) * 1000) / 10 : 0;
        const avgRiskCount = b.riskCountCount ? Math.round((b.riskCountSum / b.riskCountCount) * 10) / 10 : 0;
        return {
          key,
          label: bucketLabel(range, key),
          submissions,
          successRatePct,
          avgScorePct,
          riskEvents: b.riskEvents,
          avgRiskCount,
        };
      });

    const totalSubmissions = success + fail;
    const successRate = totalSubmissions ? Math.round((success / totalSubmissions) * 1000) / 10 : 0;
    const failureRate = totalSubmissions ? Math.round((fail / totalSubmissions) * 1000) / 10 : 0;
    const avgScorePctAll = pctCount ? Math.round((totalPctSum / pctCount) * 10) / 10 : 0;

    return NextResponse.json({
      range,
      from: fromIso,
      to: toIso,
      passThresholdPct: PASS_PCT,
      summary: {
        totalSubmissions,
        successCount: success,
        failureCount: fail,
        successRatePct: successRate,
        failureRatePct: failureRate,
        avgScorePct: avgScorePctAll,
      },
      series,
      riskByType: Object.entries(riskByType)
        .map(([event_type, count]) => ({ event_type, count }))
        .sort((a, b) => b.count - a.count),
    });
  } catch (e) {
    console.error("[admin analytics]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

