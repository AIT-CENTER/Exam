"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, GraduationCap, Search, ChevronLeft, ChevronRight, Award, MoreHorizontal, UserPlus, PlusCircle, Check, Edit, Trash2, FileText, FileSpreadsheet, FileArchive, Download, AlertCircle, Clock, CheckCircle, XCircle, Users, FileQuestion, Target, Calendar } from 'lucide-react';
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";
import { getTeacherDataFromCookie } from "@/utils/teacherCookie";

const STUDENTS_PER_MODAL_PAGE = 5;

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export default function ExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState(["A", "B", "C", "D"]);
  const [teacherId, setTeacherId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [teacherData, setTeacherData] = useState(null);

  const [isAssignStudentOpen, setIsAssignStudentOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState(null);

  const [currentExam, setCurrentExam] = useState(null);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectAllStudents, setSelectAllStudents] = useState(false);

  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSections, setSelectedSections] = useState([]);
  const [selectAllSections, setSelectAllSections] = useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      setIsLoading(true);

      const teacher = await getTeacherDataFromCookie();

      if (!teacher || !teacher.teacherId) {
        toast.error("Please login as teacher");
        setIsAuthenticated(false);
        setIsLoading(false);
        router.push("/teacher/login");
        return;
      }

      // Fetch teacher data from database using teacherId from cookie
      const { data: teacherDbData, error: teacherError } = await supabase
        .from("teacher")
        .select("id, username, full_name, email, phone_number, grade_id, subject_id, section")
        .eq("id", teacher.teacherId)
        .single();

      if (teacherError || !teacherDbData) {
        toast.error("Invalid teacher session");
        setIsAuthenticated(false);
        setIsLoading(false);
        router.push("/teacher/login");
        return;
      }

      setTeacherId(teacher.teacherId);
      setTeacherData(teacher);
      setIsAuthenticated(true);

      // Fetch data using teacher ID from cookie
      await fetchExams(teacher.teacherId);
      await fetchStudents(teacher);
      await fetchGrades();

    } catch (error) {
      toast.error("Authentication failed");
      setIsAuthenticated(false);
      router.push("/teacher/login");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExams = async (teacherId) => {
    try {
      // Fetch exams created by this teacher using teacherId from cookie
      const { data: examsData, error: examsError } = await supabase
        .from("exams")
        .select("id, title, description, exam_code, exam_date, duration, total_marks, exam_active, questions_shuffled, options_shuffled, created_by, subject_id, grade_id, section, created_at, updated_at")
        .eq("created_by", teacherId)
        .order("created_at", { ascending: false });

      if (examsError) {
        toast.error("Failed to load exams: " + examsError.message);
        return;
      }

      if (!examsData || examsData.length === 0) {
        setExams([]);
        return;
      }

      const subjectIds = [...new Set(examsData.map((e) => e.subject_id))].filter(Boolean);
      const { data: subjectsData } = await supabase
        .from("subjects")
        .select("id, subject_name")
        .in("id", subjectIds);

      const gradeIds = [...new Set(examsData.map((e) => e.grade_id))].filter(Boolean);
      const { data: gradesData } = await supabase
        .from("grades")
        .select("id, grade_name")
        .in("id", gradeIds);

      const examIds = examsData.map((exam) => exam.id);
      const { data: assignedData } = await supabase
        .from("assign_exams")
        .select("exam_id, student_id")
        .in("exam_id", examIds);

      const { data: questionsData } = await supabase
        .from("questions")
        .select("exam_id, marks")
        .in("exam_id", examIds);

      const subjectsMap = subjectsData?.reduce((map, s) => {
        map[s.id] = s.subject_name;
        return map;
      }, {}) || {};

      const gradesMap = gradesData?.reduce((map, g) => {
        map[g.id] = g.grade_name;
        return map;
      }, {}) || {};

      const assignedCountsMap = {};
      const questionsCountMap = {};
      const totalMarksMap = {};

      if (assignedData) {
        assignedData.forEach((item) => {
          assignedCountsMap[item.exam_id] = (assignedCountsMap[item.exam_id] || 0) + 1;
        });
      }

      if (questionsData) {
        questionsData.forEach((item) => {
          questionsCountMap[item.exam_id] = (questionsCountMap[item.exam_id] || 0) + 1;
          totalMarksMap[item.exam_id] = (totalMarksMap[item.exam_id] || 0) + (item.marks || 0);
        });
      }

      const examsWithDetails = examsData.map((exam) => {
        const now = new Date();
        const examDate = new Date(exam.exam_date);
        const isUpcoming = examDate > now;
        
        const assignedCount = assignedCountsMap[exam.id] || 0;
        const questionsCount = questionsCountMap[exam.id] || 0;
        const calculatedTotalMarks = totalMarksMap[exam.id] || 0;

        let status = "draft";
        if (assignedCount > 0) {
          status = isUpcoming ? "upcoming" : "completed";
        }

        return {
          ...exam,
          name: exam.title,
          department_name: subjectsMap[exam.subject_id] || "Unknown Subject",
          exam_id: exam.exam_code,
          start_time: exam.exam_date,
          end_time: new Date(
            new Date(exam.exam_date).getTime() + (exam.duration || 0) * 60000
          ).toISOString(),
          is_active: exam.exam_active,
          assigned_count: assignedCount,
          questions_count: questionsCount,
          calculated_total_marks: calculatedTotalMarks,
          status: status,
        };
      });

      setExams(examsWithDetails);
    } catch (error) {
      toast.error("Unexpected error loading exams: " + error.message);
    }
  };

  const fetchStudents = async (teacher) => {
    try {
      let query = supabase
        .from("students")
        .select("*")
        .order("name");

      // Filter students based on teacher's assigned grade and sections from cookie
      if (teacher.gradeId && teacher.sections && teacher.sections.length > 0) {
        query = query
          .eq("grade_id", teacher.gradeId)
          .in("section", teacher.sections);
      }

      const { data, error } = await query;

      if (error) {
        return;
      }

      setStudents(data || []);
    } catch (error) {
      // Silent error handling
    }
  };

  const fetchGrades = async () => {
    try {
      const { data, error } = await supabase
        .from("grades")
        .select("id, grade_name")
        .order("grade_name");

      if (error) {
        return;
      }

      setGrades(data || []);
    } catch (error) {
      // Silent error handling
    }
  };

  const fetchAvailableStudents = async (examId, gradeId, sections) => {
    try {
      const { data: assignedStudents } = await supabase
        .from("assign_exams")
        .select("student_id")
        .eq("exam_id", examId);

      const assignedStudentIds = assignedStudents?.map(s => s.student_id) || [];

      let query = supabase
        .from("students")
        .select("id, student_id, name, father_name, grandfather_name, gender, grade_id, section, email")
        .eq("grade_id", gradeId)
        .in("section", sections);

      if (assignedStudentIds.length > 0) {
        query = query.not("id", "in", `(${assignedStudentIds.join(",")})`);
      }

      const { data: matchingStudents, error: queryError } = await query;

      if (queryError) {
        toast.error("Failed to fetch available students: " + queryError.message);
        return;
      }

      setAvailableStudents(matchingStudents || []);
      setSelectedStudents([]);
      setSelectAllStudents(false);
    } catch (error) {
      toast.error("Error fetching available students: " + error.message);
    }
  };

  const handleCreateExam = async () => {
    try {
      const teacher = await getTeacherDataFromCookie();
      if (teacher && teacher.teacherId) {
        router.push(`/teacher/exams/create`);
      } else {
        toast.error("Please login as teacher");
        router.push("/teacher/login");
      }
    } catch (err) {
      toast.error("Error accessing teacher data. Please login again.");
      router.push("/teacher/login");
    }
  };

  const stats = useMemo(() => {
    const upcoming = exams.filter((e) => e.status === "upcoming").length;
    const completed = exams.filter((e) => e.status === "completed").length;
    const draft = exams.filter((e) => e.status === "draft").length;

    return [
      { title: "Total Exams", value: exams.length.toString(), icon: BookOpen },
      { title: "Upcoming Exams", value: upcoming.toString(), icon: Clock },
      { title: "Draft Exams", value: draft.toString(), icon: FileQuestion },
      { title: "Completed Exams", value: completed.toString(), icon: CheckCircle },
    ];
  }, [exams]);

  const handleOpenAssignModal = async (exam) => {
    setCurrentExam(exam);

    if (teacherData && teacherData.gradeId) {
      setSelectedGrade(teacherData.gradeId.toString());
      
      if (teacherData.sections && teacherData.sections.length > 0) {
        const teacherSections = teacherData.sections.map(s => 
          s.includes('-') ? s.split('-')[0] : s
        );
        setSelectedSections(teacherSections);
        setSelectAllSections(teacherSections.length === sections.length);
        
        await fetchAvailableStudents(exam.id, teacherData.gradeId, teacherSections);
      }
    } else {
      setSelectedGrade("");
      setSelectedSections([]);
      setSelectAllSections(false);
    }

    setIsAssignStudentOpen(true);
  };

  const handleToggleExamStatus = async (examId, checked) => {
    try {
      const { error } = await supabase
        .from("exams")
        .update({ exam_active: checked })
        .eq("id", examId);

      if (error) {
        toast.error("Failed to update exam status: " + error.message);
        return;
      }

      setExams((prev) =>
        prev.map((e) => (e.id === examId ? { ...e, exam_active: checked } : e))
      );
      toast.success(`Exam ${checked ? "activated" : "deactivated"} successfully`);
    } catch (error) {
      toast.error("Error updating exam status: " + error.message);
    }
  };

  const handleDeleteExamConfirm = async () => {
    if (examToDelete) {
      try {
        await supabase.from("assign_exams").delete().eq("exam_id", examToDelete.id);
        await supabase.from("questions").delete().eq("exam_id", examToDelete.id);
        const { error: examError } = await supabase.from("exams").delete().eq("id", examToDelete.id);

        if (examError) {
          toast.error("Failed to delete exam: " + examError.message);
          return;
        }

        setExams((prev) => prev.filter((e) => e.id !== examToDelete.id));
        toast.success(`Exam deleted successfully!`);
      } catch (error) {
        toast.error("Error deleting exam: " + error.message);
      } finally {
        setIsDeleteModalOpen(false);
        setExamToDelete(null);
      }
    }
  };

  const handleDeleteExam = (exam) => {
    setExamToDelete(exam);
    setIsDeleteModalOpen(true);
  };

  const handleSectionChange = async (section, checked) => {
    const newSections = checked 
      ? [...selectedSections, section]
      : selectedSections.filter((s) => s !== section);
    
    setSelectedSections(newSections);
    
    if (currentExam && selectedGrade && newSections.length > 0) {
      await fetchAvailableStudents(currentExam.id, parseInt(selectedGrade), newSections);
    }
  };

  const handleSelectAllSections = async (checked) => {
    const newSections = checked ? sections : [];
    setSelectAllSections(checked);
    setSelectedSections(newSections);
    
    if (currentExam && selectedGrade && newSections.length > 0) {
      await fetchAvailableStudents(currentExam.id, parseInt(selectedGrade), newSections);
    }
  };

  const handleStudentChange = (studentId, checked) => {
    setSelectedStudents(prev =>
      checked ? [...prev, studentId] : prev.filter(id => id !== studentId)
    );
  };

  const handleSelectAllStudents = (checked) => {
    setSelectAllStudents(checked);
    setSelectedStudents(checked ? availableStudents.map(s => s.id) : []);
  };

  const handleAssignStudents = async () => {
    if (!currentExam || selectedStudents.length === 0) {
      toast.error("Please select at least one student");
      return;
    }

    try {
      const inserts = selectedStudents.map((studentId) => {
        const student = availableStudents.find(s => s.id === studentId);
        const studentSection = student?.section || selectedSections[0];
        
        return {
          exam_id: currentExam.id,
          teacher_id: teacherId,
          student_id: studentId,
          grade_id: parseInt(selectedGrade),
          section: studentSection,
          assigned_by: teacherId,
        };
      });

      const { error: insertError } = await supabase
        .from("assign_exams")
        .insert(inserts);

      if (insertError) {
        if (insertError.code === '23505') {
          toast.error("Some students are already assigned to this exam");
        } else {
          toast.error("Failed to assign students: " + insertError.message);
        }
        return;
      }

      setExams((prev) =>
        prev.map((e) =>
          e.id === currentExam.id
            ? {
                ...e,
                assigned_count: (e.assigned_count || 0) + selectedStudents.length,
                status: "upcoming",
              }
            : e
        )
      );

      toast.success(`${selectedStudents.length} students assigned successfully!`);
      setIsAssignStudentOpen(false);
      setSelectedStudents([]);
      setAvailableStudents([]);
    } catch (error) {
      toast.error("Error assigning students: " + error.message);
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] w-full bg-transparent">
        <style>{`
          .spinner-svg {
            animation: spinner-rotate 2s linear infinite;
          }
          .spinner-circle {
            stroke-dasharray: 1, 200;
            stroke-dashoffset: 0;
            animation: spinner-stretch 1.5s ease-in-out infinite;
            stroke-linecap: round;
          }
          @keyframes spinner-rotate {
            100% {
              transform: rotate(360deg);
            }
          }
          @keyframes spinner-stretch {
            0% {
              stroke-dasharray: 1, 200;
              stroke-dashoffset: 0;
            }
            50% {
              stroke-dasharray: 90, 200;
              stroke-dashoffset: -35px;
            }
            100% {
              stroke-dasharray: 90, 200;
              stroke-dashoffset: -124px;
            }
          }
        `}</style>
        
        <svg
          className="h-10 w-10 text-zinc-800 dark:text-zinc-200 spinner-svg"
          viewBox="25 25 50 50"
        >
          <circle
            className="spinner-circle"
            cx="50"
            cy="50"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
        </svg>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <BookOpen className="mx-auto h-16 w-16 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Authentication Required
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Please login as teacher to access this page.
          </p>
          <Button className="mt-4" onClick={() => router.push("/teacher/login")}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-8 bg-transparent p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Exams
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and assign students to exams in bulk.
          </p>
        </div>
        <Button className="gap-2" onClick={handleCreateExam}>
          <PlusCircle className="h-4 w-4" />
          Create Exam
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-lg transition-shadow duration-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-5 w-5 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {exams.map((exam) => {
          const getStatusBadge = () => {
            switch (exam.status) {
              case "completed":
                return (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle className="h-3 w-3" /> Completed
                  </Badge>
                );
              case "upcoming":
                return (
                  <Badge variant="default" className="gap-1">
                    <Clock className="h-3 w-3" /> Upcoming
                  </Badge>
                );
              case "draft":
                return <Badge variant="outline">Draft</Badge>;
              default:
                return <Badge variant="outline">Unknown</Badge>;
            }
          };

          return (
            <Card key={exam.id} className="flex flex-col hover:shadow-lg transition-all duration-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-xl text-foreground line-clamp-1">
                        {exam.title}
                      </CardTitle>
                      {getStatusBadge()}
                    </div>
                    <CardDescription className="text-muted-foreground">
                      {exam.department_name}
                    </CardDescription>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(exam.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        <span>{exam.exam_code}</span>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => handleOpenAssignModal(exam)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Assign Students
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/teacher/exams/edit/${exam.id}`)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Exam
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteExam(exam)} className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className="flex-grow space-y-4 pb-3">

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Target className="h-5 w-5 text-muted-foreground opacity-70" />
                    <span>{exam.calculated_total_marks || 0} Point</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileQuestion className="h-4 w-4 text-muted-foreground opacity-70" />
                    <span>Ques: {exam.questions_count || 0}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 text-muted-foreground opacity-70" />
                    <span>{exam.duration || 0} min</span>
                  </div>

                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2 border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Exam Date:</span>
                    <span className="font-medium text-foreground">
                      {formatDate(exam.exam_date)}
                    </span>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/20 py-3 px-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="text-sm text-muted-foreground">
                  {exam.assigned_count} students assigned
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Active</span>
                  <Switch
                    checked={exam.exam_active}
                    onCheckedChange={(checked) =>
                      handleToggleExamStatus(exam.id, checked)
                    }
                  />
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {exams.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            No exams found
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Get started by creating your first exam.
          </p>
          <Button className="mt-4" onClick={handleCreateExam}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Exam
          </Button>
        </div>
      )}

      <AssignStudentDialog
        isOpen={isAssignStudentOpen}
        onOpenChange={setIsAssignStudentOpen}
        currentExam={currentExam}
        selectedGrade={selectedGrade}
        selectedSections={selectedSections}
        selectAllSections={selectAllSections}
        handleSelectAllSections={handleSelectAllSections}
        handleSectionChange={handleSectionChange}
        handleAssignStudents={handleAssignStudents}
        grades={grades}
        sections={sections}
        teacherData={teacherData}
        availableStudents={availableStudents}
        selectedStudents={selectedStudents}
        selectAllStudents={selectAllStudents}
        handleStudentChange={handleStudentChange}
        handleSelectAllStudents={handleSelectAllStudents}
      />

      <DeleteConfirmDialog
        isOpen={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        exam={examToDelete}
        onConfirm={handleDeleteExamConfirm}
      />
    </div>
  );
}


function DeleteConfirmDialog({ isOpen, onOpenChange, exam, onConfirm }) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[500px]`}>
        <DialogHeader>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the exam "{exam?.title}"? This
            action cannot be undone and will also remove all associated student
            assignments.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete Exam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignStudentDialog({
  isOpen,
  onOpenChange,
  currentExam,
  selectedGrade,
  selectedSections,
  selectAllSections,
  handleSelectAllSections,
  handleSectionChange,
  handleAssignStudents,
  grades,
  sections,
  teacherData,
  availableStudents,
  selectedStudents,
  selectAllStudents,
  handleStudentChange,
  handleSelectAllStudents,
}) {
  const hasClassAssignment =
    teacherData &&
    teacherData.gradeId &&
    teacherData.sections &&
    teacherData.sections.length > 0;
  const teacherGrade = grades.find(
    (g) => g.id.toString() === teacherData?.gradeId?.toString()
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[600px] max-h-[600px] flex flex-col`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Assign Students to "{currentExam?.title}"</DialogTitle>
          <DialogDescription>
            {hasClassAssignment ? (
              `Select sections and students to assign in bulk.`
            ) : (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded">
                <AlertCircle className="h-4 w-4" />
                <span>You are not assigned to any classes.</span>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="grade">Grade</Label>
              <div className="p-2 border rounded-md bg-gray-50">
                <p className="text-sm font-medium">
                  {teacherGrade ? teacherGrade.grade_name : "Not assigned"}
                </p>
              </div>
            </div>

            {hasClassAssignment && (
              <div className="grid gap-2">
                <Label>Sections</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    checked={selectAllSections}
                    onCheckedChange={handleSelectAllSections}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium leading-none">
                    Select All
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {sections.map((section) => (
                    <div key={section} className="flex items-center space-x-2">
                      <Checkbox
                        id={`section-${section}`}
                        checked={selectedSections.includes(section)}
                        onCheckedChange={(checked) =>
                          handleSectionChange(section, checked)
                        }
                      />
                      <label htmlFor={`section-${section}`} className="text-sm font-medium leading-none">
                        Section {section}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableStudents.length > 0 && (
              <div className="grid gap-2">
                <Label>Available Students ({availableStudents.length})</Label>
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  <div className="flex items-center space-x-2 p-3 border-b bg-gray-50">
                    <Checkbox
                      id="select-all-students"
                      checked={selectAllStudents}
                      onCheckedChange={handleSelectAllStudents}
                    />
                    <label htmlFor="select-all-students" className="text-sm font-medium leading-none">
                      Select All
                    </label>
                  </div>
                  <div className="divide-y">
                    {availableStudents.map((student) => (
                      <div key={student.id} className="flex items-center space-x-2 p-3">
                        <Checkbox
                          id={`student-${student.id}`}
                          checked={selectedStudents.includes(student.id)}
                          onCheckedChange={(checked) =>
                            handleStudentChange(student.id, checked)
                          }
                        />
                        <label htmlFor={`student-${student.id}`} className="text-sm flex-1">
                          <div className="font-medium">{student.name}</div>
                          <div className="text-muted-foreground text-xs">
                            ID: {student.student_id} | Section: {student.section}
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedSections.length > 0 && availableStudents.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <Users className="mx-auto h-8 w-8 mb-2" />
                <p>No available students found.</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssignStudents}
            disabled={!hasClassAssignment || selectedStudents.length === 0}
          >
            Assign {selectedStudents.length} Student{selectedStudents.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}