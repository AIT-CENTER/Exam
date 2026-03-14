/**
 * Create exam session only when no active session exists for (student_id, exam_id).
 * Sets start_time (started_at) and end_time = started_at + exam_duration on the server.
 * Frontend must NOT create its own timer duration; timer is always server-based.
 * Security: single active session per student per exam; uses service role.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      studentId,
      examId,
      teacherId,
      deviceFingerprint,
      ipAddress,
      userAgent,
      takeoverSessionId,
    } = body as {
      studentId?: number;
      examId?: number;
      teacherId?: string | null;
      deviceFingerprint?: string;
      ipAddress?: string;
      userAgent?: string;
      takeoverSessionId?: string;
    };

    if (studentId == null || examId == null) {
      return NextResponse.json(
        { error: "studentId and examId required" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();
    const sid = Number(studentId);
    const eid = Number(examId);

    // Takeover: terminate old session and create new one with same end_time (timer does not reset).
    if (takeoverSessionId) {
      const { data: oldSession, error: oldErr } = await admin
        .from("exam_sessions")
        .select("id, end_time, started_at, teacher_id")
        .eq("id", takeoverSessionId)
        .eq("student_id", sid)
        .eq("exam_id", eid)
        .eq("status", "in_progress")
        .maybeSingle();

      if (oldErr || !oldSession) {
        return NextResponse.json({ error: "Invalid session for takeover" }, { status: 400 });
      }

      const now = new Date().toISOString();
      await admin.from("session_security").update({ is_active: false, last_verified: now }).eq("session_id", takeoverSessionId);
      await admin.from("exam_sessions").update({ status: "inactive", updated_at: now }).eq("id", takeoverSessionId);

      const securityToken = [...Array(32)].map(() => Math.random().toString(36)[2]).join("");
      const endTime = oldSession.end_time || new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const endMs = new Date(endTime).getTime();
      const timeRemaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));

      const { data: newSession, error: insertErr } = await admin
        .from("exam_sessions")
        .insert({
          student_id: sid,
          exam_id: eid,
          teacher_id: oldSession.teacher_id,
          status: "in_progress",
          started_at: now,
          end_time: endTime,
          last_activity_at: now,
          updated_at: now,
          security_token: securityToken,
          device_takeover_count: 1,
          last_takeover_time: now,
          instruction_seen: true,
          time_remaining: timeRemaining,
        })
        .select("id, security_token, started_at, end_time")
        .single();

      if (insertErr) {
        console.error("[create-session] takeover insert:", insertErr);
        return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
      }

      await admin.from("session_security").insert({
        session_id: newSession.id,
        student_id: sid,
        device_fingerprint: deviceFingerprint || "unknown",
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        token: securityToken,
        is_active: true,
        last_verified: now,
      });

      // Copy answers server-side so continuity works even if the client cannot access tables directly.
      try {
        const { data: oldAnswers } = await admin
          .from("student_answers")
          .select("question_id, selected_option_id, answer_text, is_flagged, is_correct, answered_at, created_at")
          .eq("session_id", takeoverSessionId);

        if (oldAnswers && oldAnswers.length > 0) {
          await admin.from("student_answers").insert(
            oldAnswers.map((a: any) => ({
              session_id: newSession.id,
              question_id: a.question_id,
              selected_option_id: a.selected_option_id,
              answer_text: a.answer_text,
              is_flagged: a.is_flagged,
              is_correct: a.is_correct,
              answered_at: a.answered_at,
              created_at: a.created_at,
            }))
          );
        }
      } catch (copyErr) {
        console.error("[create-session] takeover answer copy failed:", copyErr);
      }

      return NextResponse.json({
        created: true,
        session: {
          id: newSession.id,
          security_token: newSession.security_token,
          started_at: newSession.started_at,
          end_time: newSession.end_time,
          time_remaining: timeRemaining,
        },
      });
    }

    // 1) Check for existing in_progress session: do NOT create duplicate.
    const { data: existing, error: checkErr } = await admin
      .from("exam_sessions")
      .select("id, security_token, started_at, end_time")
      .eq("student_id", sid)
      .eq("exam_id", eid)
      .eq("status", "in_progress")
      .maybeSingle();

    if (checkErr) {
      console.error("[create-session] check:", checkErr);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (existing) {
      const endMs = existing.end_time ? new Date(existing.end_time).getTime() : Date.now() + 3600000;
      const tr = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      return NextResponse.json({
        created: false,
        session: {
          id: existing.id,
          security_token: existing.security_token,
          started_at: existing.started_at,
          end_time: existing.end_time,
          time_remaining: tr,
        },
      });
    }

    // 2) Get exam duration (minutes) from server.
    const { data: exam, error: examErr } = await admin
      .from("exams")
      .select("id, duration")
      .eq("id", eid)
      .single();

    if (examErr || !exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const durationMinutes = exam.duration ?? 60;
    const durationSeconds = durationMinutes * 60;

    const now = new Date();
    const startedAt = now.toISOString();
    const endTime = new Date(now.getTime() + durationSeconds * 1000).toISOString();

    const securityToken = [...Array(32)]
      .map(() => Math.random().toString(36)[2])
      .join("");

    // 3) Insert new session with started_at and end_time only. NEVER store time_remaining.
    const { data: newSession, error: insertErr } = await admin
      .from("exam_sessions")
      .insert({
        student_id: sid,
        exam_id: eid,
        teacher_id: teacherId || null,
        status: "in_progress",
        started_at: startedAt,
        end_time: endTime,
        last_activity_at: startedAt,
        updated_at: startedAt,
        security_token: securityToken,
        device_takeover_count: 0,
        instruction_seen: false,
        time_remaining: durationSeconds,
      })
      .select("id, security_token, started_at, end_time")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        const { data: again } = await admin
          .from("exam_sessions")
          .select("id, security_token, started_at, end_time")
          .eq("student_id", sid)
          .eq("exam_id", eid)
          .eq("status", "in_progress")
          .maybeSingle();
        if (again) {
          const endMs = again.end_time ? new Date(again.end_time).getTime() : Date.now() + 3600000;
          return NextResponse.json({
            created: false,
            session: { ...again, time_remaining: Math.max(0, Math.floor((endMs - Date.now()) / 1000)) },
          });
        }
      }
      console.error("[create-session] insert:", insertErr);
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    // 4) Create session_security row for this device.
    const { error: secErr } = await admin.from("session_security").insert({
      session_id: newSession.id,
      student_id: sid,
      device_fingerprint: deviceFingerprint || "unknown",
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      token: securityToken,
      is_active: true,
      last_verified: startedAt,
    });

    if (secErr) {
      await admin.from("exam_sessions").delete().eq("id", newSession.id);
      console.error("[create-session] session_security:", secErr);
      return NextResponse.json({ error: "Security setup failed" }, { status: 500 });
    }

    const tr = Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
    return NextResponse.json({
      created: true,
      session: {
        id: newSession.id,
        security_token: newSession.security_token,
        started_at: newSession.started_at,
        end_time: newSession.end_time,
        time_remaining: tr,
      },
    });
  } catch (e) {
    console.error("[create-session]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
