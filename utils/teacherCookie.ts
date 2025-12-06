// utils/teacherCookie.ts
import { supabase } from "../lib/supabaseClient";

export interface TeacherData {
  teacherId: string;
  username: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  gradeId: number | null;
  subjectId: number | null;
  section: string | null;
  stream: string | null
  gradeName?: string;
  subjectName?: string;
  sections?: string[];
  expires?: string;
}

interface Student {
  id: string;
  studentId: string;
  name: string;
  fatherName: string;
  grandfatherName: string;
  stream: string | null
  gender: string;
  gradeId: number;
  section: string;
  email?: string;
}

// Read cookie and ensure teacherId exists
export const getTeacherDataFromCookie = async (): Promise<TeacherData | null> => {
  if (typeof window === "undefined") return null;

  try {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith("teacherData="));

    if (!raw) {
      return null;
    }

    const value = raw.split("=")[1];
    const decoded = decodeURIComponent(value);
    let data: TeacherData = JSON.parse(decoded);

    // Check expiration
    if (data.expires && new Date(data.expires) < new Date()) {
      clearTeacherDataCookie();
      return null;
    }

    // Fetch teacherId from database if missing
    if (!data.teacherId || data.teacherId.trim() === "") {
      const conditions = [
        data.email ? `email.eq.${data.email}` : null,
        data.username ? `username.eq.${data.username}` : null,
      ].filter(Boolean);

      if (conditions.length > 0) {
        const { data: teacher, error } = await supabase
          .from("teacher")
          .select("id")
          .or(conditions.join(","))
          .single();

        if (!error && teacher?.id) {
          data.teacherId = teacher.id;
          setTeacherDataCookie(data); // update cookie
        }
      }
    }

    // Final check if teacherId exists
    if (!data.teacherId || data.teacherId.trim() === "") {
      return null;
    }

    return data;
  } catch (err) {
    return null;
  }
};

export const getTeacherStudents = async (gradeId: number, sections: string[]): Promise<Student[]> => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('id, student_id, name, father_name, grandfather_name, gender, grade_id, section, email')
      .eq('grade_id', gradeId)
      .in('section', sections)
      .order('name');

    if (error) {
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const mappedStudents = data.map(student => ({
      id: student.id,
      studentId: student.student_id,
      name: student.name,
      fatherName: student.father_name,
      grandfatherName: student.grandfather_name,
      gender: student.gender,
      gradeId: student.grade_id,
      section: student.section,
      email: student.email
    }));

    return mappedStudents;

  } catch (error) {
    return [];
  }
};

// Write/update cookie
export const setTeacherDataCookie = (teacherData: TeacherData): void => {
  if (typeof window === 'undefined') return;

  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 7);

  const cookieData = {
    ...teacherData,
    expires: expirationDate.toUTCString()
  };

  const cookieValue = encodeURIComponent(JSON.stringify(cookieData));

  document.cookie = `teacherData=${cookieValue}; expires=${expirationDate.toUTCString()}; path=/; SameSite=Lax`;
};

// Clear cookie
export const clearTeacherDataCookie = (): void => {
  if (typeof window === 'undefined') return;
  document.cookie = "teacherData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
};