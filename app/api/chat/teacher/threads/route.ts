import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireTeacherUser } from "@/lib/requireTeacher";

export async function GET() {
  try {
    const teacher = await requireTeacherUser();
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
          student_id,
          closed,
          updated_at,
          students (student_id, name, father_name, grandfather_name),
          subjects (subject_name)
        `
      )
      .eq("teacher_id", teacher.teacherId)
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const formatted = (threads ?? []).map((t: any) => ({
      id: t.id,
      closed: Boolean(t.closed),
      updated_at: t.updated_at,
      subject: t.subjects?.subject_name ?? "Subject",
      student_number: t.students?.student_id ?? null,
      student_full_name: [t.students?.name, t.students?.father_name, t.students?.grandfather_name].filter(Boolean).join(" "),
    }));

    return NextResponse.json({ threads: formatted }, { status: 200 });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[chat/teacher/threads] GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

