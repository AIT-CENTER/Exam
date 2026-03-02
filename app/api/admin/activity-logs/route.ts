/**
 * Admin-only: list activity logs.
 * riskOnly=true: fetch from exam_risk_logs only (max 10), for risk event dashboard.
 * Otherwise: activity_logs (legacy, for full audit).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseClient";

const RISK_LOGS_MAX = 10;

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

    const { searchParams } = new URL(request.url);
    const riskOnly = searchParams.get("riskOnly") === "true";

    const adminClient = supabaseAdmin();

    if (riskOnly) {
      const { data: rawLogs, error } = await adminClient
        .from("exam_risk_logs")
        .select(`
          id,
          session_id,
          student_id,
          exam_id,
          event_type,
          event_value,
          timestamp,
          students (name),
          exams (title)
        `)
        .order("timestamp", { ascending: false })
        .limit(50);

      if (error) {
        console.error("[admin activity-logs] risk:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Deduplicate: only unique events (session_id + event_type + timestamp rounded to second)
      const seen = new Set<string>();
      const uniqueLogs: Array<{
        id: string;
        session_id: string;
        student_id: number;
        exam_id: number;
        event_type: string;
        event_value?: string | null;
        timestamp: string;
        student_name?: string;
        exam_name?: string;
      }> = [];
      for (const log of rawLogs ?? []) {
        const ts = log.timestamp ? new Date(log.timestamp).getTime() : 0;
        const key = `${log.session_id}-${log.event_type}-${Math.floor(ts / 1000)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        uniqueLogs.push({
          id: log.id,
          session_id: log.session_id,
          student_id: log.student_id,
          exam_id: log.exam_id,
          event_type: log.event_type,
          event_value: log.event_value ?? null,
          timestamp: log.timestamp,
          student_name: (log.students as { name?: string } | null)?.name,
          exam_name: (log.exams as { title?: string } | null)?.title,
        });
        if (uniqueLogs.length >= RISK_LOGS_MAX) break;
      }
      return NextResponse.json({ logs: uniqueLogs });
    }

    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
    const sessionId = searchParams.get("sessionId") || undefined;
    const examId = searchParams.get("examId") || undefined;

    let query = adminClient
      .from("activity_logs")
      .select("id, session_id, student_id, exam_id, event_type, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (sessionId) query = query.eq("session_id", sessionId);
    if (examId) query = query.eq("exam_id", examId);

    const { data, error } = await query;
    if (error) {
      console.error("[admin activity-logs]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ logs: data ?? [] });
  } catch (e) {
    console.error("[admin activity-logs]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
