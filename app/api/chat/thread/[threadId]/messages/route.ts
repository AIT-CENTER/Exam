import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { verifyStudentSession } from "@/lib/studentSession";
import { requireTeacherUser } from "@/lib/requireTeacher";

async function authorizeThread(admin: ReturnType<typeof supabaseAdmin>, threadId: string) {
  const cookieStore = await cookies();
  const studentSession = verifyStudentSession(cookieStore.get("studentSession")?.value);

  let teacher: { teacherId: string } | null = null;
  if (!studentSession) {
    try {
      teacher = await requireTeacherUser();
    } catch {
      teacher = null;
    }
  }

  if (!studentSession && !teacher) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const { data: sys } = await admin
    .from("system_settings")
    .select("enable_student_teacher_chat")
    .eq("id", 1)
    .maybeSingle();
  if (!sys?.enable_student_teacher_chat) return { ok: false as const, status: 403, error: "Chat is disabled" };

  const { data: thread, error } = await admin
    .from("student_teacher_threads")
    .select("id, student_id, teacher_id, subject_id, closed")
    .eq("id", threadId)
    .maybeSingle();
  if (error || !thread) return { ok: false as const, status: 404, error: "Thread not found" };

  if (studentSession && Number(thread.student_id) !== studentSession.sid) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  if (teacher && String(thread.teacher_id) !== teacher.teacherId) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return {
    ok: true as const,
    thread,
    sender: studentSession ? ({ type: "student", id: String(studentSession.sid) } as const) : ({ type: "teacher", id: teacher!.teacherId } as const),
  };
}

export async function GET(request: NextRequest, { params }: { params: { threadId: string } }) {
  try {
    const admin = supabaseAdmin();
    const auth = await authorizeThread(admin, params.threadId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const after = searchParams.get("after"); // ISO timestamp

    let q = admin
      .from("student_teacher_messages")
      .select("id, thread_id, sender_type, sender_id, message, created_at")
      .eq("thread_id", params.threadId)
      .order("created_at", { ascending: true })
      .limit(300);

    if (after) q = q.gt("created_at", after);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data ?? [] }, { status: 200 });
  } catch (e) {
    console.error("[chat/thread/:id/messages] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { threadId: string } }) {
  try {
    const admin = supabaseAdmin();
    const auth = await authorizeThread(admin, params.threadId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const message = String(body.message || "").trim();
    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });
    if (message.length > 2000) return NextResponse.json({ error: "Message too long" }, { status: 400 });

    if (auth.thread.closed) {
      return NextResponse.json({ error: "Thread is closed" }, { status: 400 });
    }

    const { data: inserted, error } = await admin
      .from("student_teacher_messages")
      .insert({
        thread_id: params.threadId,
        sender_type: auth.sender.type,
        sender_id: auth.sender.id,
        message,
      })
      .select("id, thread_id, sender_type, sender_id, message, created_at")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin
      .from("student_teacher_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", params.threadId);

    return NextResponse.json({ message: inserted }, { status: 200 });
  } catch (e) {
    console.error("[chat/thread/:id/messages] POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

