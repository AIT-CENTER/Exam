import { supabase } from './supabaseClient';

export interface TeacherData {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  gradeId: number | null;
  subjectId: number | null;
  section: string | null;
  gradeName?: string;
  subjectName?: string;
  sections?: string[];
}

export interface Student {
  id: number;
  name: string;
  fatherName: string;
  grandfatherName: string;
  gender: string;
  studentId: string;
  gradeId: number;
  section: string;
  email: string | null;
  stream: string | null;
}

export interface Exam {
  id: number;
  examCode: string;
  title: string;
  description: string | null;
  subjectId: number;
  gradeId: number;
  section: string;
  examDate: string;
  duration: number | null;
  totalMarks: number;
  fullscreenRequired: boolean;
  questionsShuffled: boolean;
  optionsShuffled: boolean;
  createdBy: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Result {
  id: number;
  examId: number;
  studentId: number;
  totalMarksObtained: number;
  grade: string | null;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
  student?: Student;
  exam?: Exam;
}

// Get teacher data by ID
export const getTeacherData = async (teacherId: string): Promise<TeacherData | null> => {
  try {
    const { data: teacher, error } = await supabase
      .from('teacher')
      .select(`
        *,
        grades (grade_name),
        subjects (subject_name)
      `)
      .eq('id', teacherId)
      .single();

    if (error || !teacher) {
      console.error('Error fetching teacher data:', error);
      return null;
    }

    return {
      id: teacher.id,
      username: teacher.username,
      fullName: teacher.full_name,
      email: teacher.email,
      phoneNumber: teacher.phone_number,
      gradeId: teacher.grade_id,
      subjectId: teacher.subject_id,
      section: teacher.section,
      gradeName: teacher.grades?.grade_name,
      subjectName: teacher.subjects?.subject_name,
      sections: teacher.section ? teacher.section.split(',') : []
    };
  } catch (error) {
    console.error('Error in getTeacherData:', error);
    return null;
  }
};

// Get teacher's students based on assigned grade and sections
export const getTeacherStudents = async (gradeId: number, sections: string[]): Promise<Student[]> => {
  try {
    const { data: students, error } = await supabase
      .from('students')
      .select('*')
      .eq('grade_id', gradeId)
      .in('section', sections)
      .order('name');

    if (error) {
      console.error('Error fetching students:', error);
      return [];
    }

    return (students || []).map(student => ({
      id: student.id,
      name: student.name,
      fatherName: student.father_name,
      grandfatherName: student.grandfather_name,
      gender: student.gender,
      studentId: student.student_id,
      gradeId: student.grade_id,
      section: student.section,
      email: student.email,
      stream: student.stream
    }));
  } catch (error) {
    console.error('Error in getTeacherStudents:', error);
    return [];
  }
};

// Get teacher's exams
export const getTeacherExams = async (gradeId: number, subjectId: number, sections: string[]): Promise<Exam[]> => {
  try {
    const { data: exams, error } = await supabase
      .from('exams')
      .select('*')
      .eq('grade_id', gradeId)
      .eq('subject_id', subjectId)
      .in('section', sections)
      .order('exam_date', { ascending: false });

    if (error) {
      console.error('Error fetching exams:', error);
      return [];
    }

    return (exams || []).map(exam => ({
      id: exam.id,
      examCode: exam.exam_code,
      title: exam.title,
      description: exam.description,
      subjectId: exam.subject_id,
      gradeId: exam.grade_id,
      section: exam.section,
      examDate: exam.exam_date,
      duration: exam.duration,
      totalMarks: exam.total_marks,
      fullscreenRequired: exam.fullscreen_required,
      questionsShuffled: exam.questions_shuffled,
      optionsShuffled: exam.options_shuffled,
      createdBy: exam.created_by,
      imageUrl: exam.image_url,
      createdAt: exam.created_at,
      updatedAt: exam.updated_at
    }));
  } catch (error) {
    console.error('Error in getTeacherExams:', error);
    return [];
  }
};

// Get exam results for teacher's students
export const getTeacherResults = async (gradeId: number, subjectId: number, sections: string[]): Promise<Result[]> => {
  try {
    const { data: results, error } = await supabase
      .from('results')
      .select(`
        *,
        students (*),
        exams (*)
      `)
      .in('students.section', sections)
      .eq('students.grade_id', gradeId)
      .eq('exams.subject_id', subjectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching results:', error);
      return [];
    }

    return (results || []).map(result => ({
      id: result.id,
      examId: result.exam_id,
      studentId: result.student_id,
      totalMarksObtained: result.total_marks_obtained,
      grade: result.grade,
      comments: result.comments,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      student: result.students ? {
        id: result.students.id,
        name: result.students.name,
        fatherName: result.students.father_name,
        grandfatherName: result.students.grandfather_name,
        gender: result.students.gender,
        studentId: result.students.student_id,
        gradeId: result.students.grade_id,
        section: result.students.section,
        email: result.students.email,
        stream: result.students.stream
      } : undefined,
      exam: result.exams ? {
        id: result.exams.id,
        examCode: result.exams.exam_code,
        title: result.exams.title,
        description: result.exams.description,
        subjectId: result.exams.subject_id,
        gradeId: result.exams.grade_id,
        section: result.exams.section,
        examDate: result.exams.exam_date,
        duration: result.exams.duration,
        totalMarks: result.exams.total_marks,
        fullscreenRequired: result.exams.fullscreen_required,
        questionsShuffled: result.exams.questions_shuffled,
        optionsShuffled: result.exams.options_shuffled,
        createdBy: result.exams.created_by,
        imageUrl: result.exams.image_url,
        createdAt: result.exams.created_at,
        updatedAt: result.exams.updated_at
      } : undefined
    }));
  } catch (error) {
    console.error('Error in getTeacherResults:', error);
    return [];
  }
};

// Create new exam
export const createExam = async (examData: {
  examCode: string;
  title: string;
  description?: string;
  subjectId: number;
  gradeId: number;
  section: string;
  examDate: string;
  duration?: number;
  totalMarks: number;
  fullscreenRequired?: boolean;
  questionsShuffled?: boolean;
  optionsShuffled?: boolean;
  createdBy?: string;
  imageUrl?: string;
}): Promise<Exam | null> => {
  try {
    const { data: exam, error } = await supabase
      .from('exams')
      .insert({
        exam_code: examData.examCode,
        title: examData.title,
        description: examData.description,
        subject_id: examData.subjectId,
        grade_id: examData.gradeId,
        section: examData.section,
        exam_date: examData.examDate,
        duration: examData.duration,
        total_marks: examData.totalMarks,
        fullscreen_required: examData.fullscreenRequired || false,
        questions_shuffled: examData.questionsShuffled || true,
        options_shuffled: examData.optionsShuffled || true,
        created_by: examData.createdBy,
        image_url: examData.imageUrl
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating exam:', error);
      return null;
    }

    return {
      id: exam.id,
      examCode: exam.exam_code,
      title: exam.title,
      description: exam.description,
      subjectId: exam.subject_id,
      gradeId: exam.grade_id,
      section: exam.section,
      examDate: exam.exam_date,
      duration: exam.duration,
      totalMarks: exam.total_marks,
      fullscreenRequired: exam.fullscreen_required,
      questionsShuffled: exam.questions_shuffled,
      optionsShuffled: exam.options_shuffled,
      createdBy: exam.created_by,
      imageUrl: exam.image_url,
      createdAt: exam.created_at,
      updatedAt: exam.updated_at
    };
  } catch (error) {
    console.error('Error in createExam:', error);
    return null;
  }
};

// Update teacher password
export const updateTeacherPassword = async (teacherId: string, newPassword: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('teacher')
      .update({ password: newPassword })
      .eq('id', teacherId);

    if (error) {
      console.error('Error updating password:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateTeacherPassword:', error);
    return false;
  }
};