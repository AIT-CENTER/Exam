import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { verifyStudentSession } from "@/lib/studentSession";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("studentSession")?.value;
    const session = verifyStudentSession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();
    const { data: sys } = await admin
      .from("system_settings")
      .select("enable_student_teacher_chat")
      .eq("id", 1)
      .maybeSingle();
    if (!sys?.enable_student_teacher_chat) return NextResponse.json({ error: "Chat is disabled" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const teacher_id = String(body.teacher_id || "").trim();
    const subject_id = Number(body.subject_id);
    if (!teacher_id) return NextResponse.json({ error: "teacher_id is required" }, { status: 400 });
    if (!Number.isFinite(subject_id) || subject_id <= 0) return NextResponse.json({ error: "subject_id is required" }, { status: 400 });

    const { data: thread, error } = await admin
      .from("student_teacher_threads")
      .upsert(
        {
          student_id: session.sid,
          teacher_id,
          subject_id,
          closed: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,teacher_id,subject_id" }
      )
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ thread_id: thread?.id }, { status: 200 });
  } catch (e) {
    console.error("[chat/thread] POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

