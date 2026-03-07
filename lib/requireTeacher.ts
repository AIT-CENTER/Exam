import { cookies } from "next/headers";

export async function requireTeacherUser(): Promise<{ teacherId: string; fullName?: string; subjectId?: number | null; gradeId?: number | null; section?: string | null; stream?: string | null }> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("teacherData")?.value || cookieStore.get("teacher_data")?.value;
  if (!raw) throw new Error("UNAUTHORIZED");
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded);
    const teacherId = parsed.teacherId || parsed.id;
    if (!teacherId) throw new Error("UNAUTHORIZED");
    return {
      teacherId: String(teacherId),
      fullName: parsed.fullName || parsed.full_name,
      subjectId: parsed.subjectId ?? parsed.subject_id ?? null,
      gradeId: parsed.gradeId ?? parsed.grade_id ?? null,
      section: parsed.section ?? null,
      stream: parsed.stream ?? null,
    };
  } catch {
    throw new Error("UNAUTHORIZED");
  }
}

