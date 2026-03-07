import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { verifyStudentSession } from "@/lib/studentSession";

export async function GET() {
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

    const { data: threads, error } = await admin
      .from("student_teacher_threads")
      .select(
        `
          id,
          subject_id,
          teacher_id,
          closed,
          updated_at,
          teacher (full_name),
          subjects (subject_name)
        `
      )
      .eq("student_id", session.sid)
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ threads: threads ?? [] }, { status: 200 });
  } catch (e) {
    console.error("[chat/student/threads] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

