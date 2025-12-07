"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";

import {
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  MoreHorizontal,
  Download,
  FileSpreadsheet,
  File as FileIcon,
  Edit,
  Trash2,
  AlertCircle,
  User,
  BookOpen,
  GraduationCap,
  UserCircle,
  Users as UsersIcon,
} from "lucide-react";

const STUDENTS_PER_PAGE = 10;

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [availableSections, setAvailableSections] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    father_name: "",
    grandfather_name: "",
    gender: "",
    grade_id: "",
    section: "",
    stream: "",
  });
  const [editErrors, setEditErrors] = useState({});
  const [editSubmitAttempted, setEditSubmitAttempted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gradeStats, setGradeStats] = useState<any>({});

  const streamOptions = ["Natural", "Social"];

  // Fetch students and grades from database
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchStudents();
      await fetchGrades();
      setLoading(false);
    };
    loadData();
  }, []);

  // Update available sections and stats when grade filter changes
  useEffect(() => {
    updateAvailableSections();
    updateGradeStats();
  }, [gradeFilter, students, grades]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching students:", error);
        toast.error(`Failed to load students: ${error.message}`);
        return;
      }

      setStudents(data || []);
    } catch (err) {
      console.error("Unexpected error fetching students:", err);
      toast.error("Unexpected error loading students. Please try again.");
    }
  };

  const fetchGrades = async () => {
    try {
      const { data, error } = await supabase
        .from("grades")
        .select("id, grade_name")
        .order("id");

      if (error) {
        console.error("Error fetching grades:", error);
        toast.error(`Failed to load grades: ${error.message}`);
        return;
      }

      setGrades(data || []);
    } catch (err) {
      console.error("Unexpected error fetching grades:", err);
      toast.error("Unexpected error loading grades. Please try again.");
    }
  };

  const getGradeName = (gradeId: number) => {
    const grade = grades.find(g => g.id === gradeId);
    return grade?.grade_name || "Unknown";
  };

  const getGradeNumber = (gradeId: number) => {
    const gradeName = getGradeName(gradeId);
    return gradeName.replace("Grade ", "");
  };

  const updateAvailableSections = () => {
    if (gradeFilter === "all") {
      // Get all unique sections from all students
      const allSections = [...new Set(students.map(s => s.section))].sort();
      setAvailableSections(allSections);
    } else {
      // Get grade ID from grade filter
      const selectedGrade = grades.find(g => {
        return g.grade_name === gradeFilter;
      });

      if (selectedGrade) {
        // Get sections for the selected grade
        const gradeSections = [...new Set(
          students
            .filter(s => s.grade_id === selectedGrade.id)
            .map(s => s.section)
        )].sort();
        setAvailableSections(gradeSections);
      } else {
        setAvailableSections([]);
      }
    }
  };

  const updateGradeStats = () => {
    if (gradeFilter === "all") {
      // Calculate stats for all grades
      const allGradeStats: any = {};
      grades.forEach(grade => {
        const gradeStudents = students.filter(s => s.grade_id === grade.id);
        const males = gradeStudents.filter(s => s.gender === "Male" || s.gender === "male").length;
        const females = gradeStudents.filter(s => s.gender === "Female" || s.gender === "female").length;
        const others = gradeStudents.filter(s => s.gender === "Other" || s.gender === "other").length;
        
        allGradeStats[grade.id] = {
          total: gradeStudents.length,
          males,
          females,
          others,
          gradeName: grade.grade_name
        };
      });
      setGradeStats(allGradeStats);
    } else {
      // Calculate stats for selected grade
      const selectedGrade = grades.find(g => g.grade_name === gradeFilter);
      if (selectedGrade) {
        const gradeStudents = students.filter(s => s.grade_id === selectedGrade.id);
        const males = gradeStudents.filter(s => s.gender === "Male" || s.gender === "male").length;
        const females = gradeStudents.filter(s => s.gender === "Female" || s.gender === "female").length;
        const others = gradeStudents.filter(s => s.gender === "Other" || s.gender === "other").length;
        
        setGradeStats({
          [selectedGrade.id]: {
            total: gradeStudents.length,
            males,
            females,
            others,
            gradeName: selectedGrade.grade_name
          }
        });
      }
    }
  };

  // Calculate stats based on current filter
  const stats = useMemo(() => {
    // Filter students based on current search, grade and section filters
    let filtered = students.filter(s => {
      const studentGrade = getGradeName(s.grade_id);
      
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${s.name} ${s.father_name} ${s.grandfather_name}`.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesGrade = gradeFilter === "all" || studentGrade === gradeFilter;
      
      const matchesSection = sectionFilter === "all" || s.section === sectionFilter;
      
      return matchesSearch && matchesGrade && matchesSection;
    });

    const total = filtered.length;
    const males = filtered.filter(s => s.gender === "Male" || s.gender === "male").length;
    const females = filtered.filter(s => s.gender === "Female" || s.gender === "female").length;
    const others = filtered.filter(s => s.gender === "Other" || s.gender === "other").length;

    // Get grade name for display
    let gradeDisplay = "All Grades";
    if (gradeFilter !== "all") {
      gradeDisplay = gradeFilter;
    }

    // Get section for display
    let sectionDisplay = "All Sections";
    if (sectionFilter !== "all") {
      sectionDisplay = `Section ${sectionFilter}`;
    }

    // If viewing a specific grade, show detailed grade stats
    if (gradeFilter !== "all") {
      const selectedGrade = grades.find(g => g.grade_name === gradeFilter);
      if (selectedGrade && gradeStats[selectedGrade.id]) {
        const stats = gradeStats[selectedGrade.id];
        return [
          { 
            title: "Total Students", 
            value: stats.total, 
            icon: UsersIcon,
            description: `${gradeDisplay} • ${sectionDisplay}`,
            color: "text-blue-600"
          },
          { 
            title: "Male Students", 
            value: stats.males, 
            icon: UserCircle,
            description: `${stats.males} Male Students`,
            color: "text-blue-500"
          },
          { 
            title: "Female Students", 
            value: stats.females, 
            icon: UserCircle,
            description: `${stats.females} Female Students`,
            color: "text-pink-500"
          },
          { 
            title: "Other Gender", 
            value: stats.others, 
            icon: User,
            description: `${stats.others} Other Students`,
            color: "text-purple-500"
          },
        ];
      }
    }

    // Default stats for all grades
    return [
      { 
        title: "Total Students", 
        value: total, 
        icon: UsersIcon,
        description: `${gradeDisplay} • ${sectionDisplay}`,
        color: "text-blue-600"
      },
      { 
        title: "Male Students", 
        value: males, 
        icon: UserCircle,
        description: `${males} Male Students`,
        color: "text-blue-500"
      },
      { 
        title: "Female Students", 
        value: females, 
        icon: UserCircle,
        description: `${females} Female Students`,
        color: "text-pink-500"
      },
      { 
        title: "Other Gender", 
        value: others, 
        icon: User,
        description: `${others} Other Students`,
        color: "text-purple-500"
      },
    ];
  }, [students, searchQuery, gradeFilter, sectionFilter, grades, gradeStats]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const studentGrade = getGradeName(s.grade_id);
      
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${s.name} ${s.father_name} ${s.grandfather_name}`.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesGrade = gradeFilter === "all" || studentGrade === gradeFilter;
      
      const matchesSection = sectionFilter === "all" || s.section === sectionFilter;
      
      return matchesSearch && matchesGrade && matchesSection;
    });
  }, [students, searchQuery, gradeFilter, sectionFilter, grades]);

  const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * STUDENTS_PER_PAGE,
    currentPage * STUDENTS_PER_PAGE
  );

  const openDelete = (student: any) => {
    setEditingStudent(student);
    setIsDeleteOpen(true);
  };

  const openEdit = (student: any) => {
    setEditingStudent(student);
    setEditFormData({
      name: student.name,
      father_name: student.father_name,
      grandfather_name: student.grandfather_name,
      gender: student.gender,
      grade_id: student.grade_id.toString(),
      section: student.section,
      stream: student.stream || "",
    });
    setEditErrors({});
    setEditSubmitAttempted(false);
    setIsEditOpen(true);
  };

  const confirmDelete = async () => {
    if (!editingStudent) return;

    try {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", editingStudent.id);

      if (error) {
        console.error("Delete error:", error);
        toast.error(`Failed to delete student: ${error.message}`);
      } else {
        setStudents(prev => prev.filter(s => s.id !== editingStudent.id));
        toast.success(`${editingStudent.name} deleted successfully`);
      }
    } catch (err) {
      console.error("Unexpected delete error:", err);
      toast.error("Unexpected error deleting student. Please try again.");
    } finally {
      setIsDeleteOpen(false);
      setEditingStudent(null);
    }
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
    if (editErrors[name as keyof typeof editErrors]) {
      setEditErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleEditGenderChange = (value: string) => {
    setEditFormData((prev) => ({ ...prev, gender: value }));
    if (editErrors["gender"]) {
      setEditErrors((prev) => ({ ...prev, gender: "" }));
    }
  };

  const handleEditGradeChange = (value: string) => {
    const selectedGrade = grades.find(g => g.id.toString() === value);
    const isGrade11or12 = selectedGrade && ["Grade 11", "Grade 12"].includes(selectedGrade.grade_name);
    
    setEditFormData((prev) => ({ 
      ...prev, 
      grade_id: value, 
      stream: isGrade11or12 ? prev.stream : "" 
    }));
    
    if (editErrors["grade_id"]) {
      setEditErrors((prev) => ({ ...prev, grade_id: "" }));
    }
  };

  const handleEditSectionChange = (value: string) => {
    setEditFormData((prev) => ({ ...prev, section: value }));
    if (editErrors["section"]) {
      setEditErrors((prev) => ({ ...prev, section: "" }));
    }
  };

  const handleEditStreamChange = (value: string) => {
    setEditFormData((prev) => ({ ...prev, stream: value }));
    if (editErrors["stream"]) {
      setEditErrors((prev) => ({ ...prev, stream: "" }));
    }
  };

  const validateEditForm = () => {
    const newErrors: any = {};

    if (!editFormData.name?.trim()) {
      newErrors.name = "Student name is required";
    }
    if (!editFormData.father_name?.trim()) {
      newErrors.father_name = "Father's name is required";
    }
    if (!editFormData.grandfather_name?.trim()) {
      newErrors.grandfather_name = "Grandfather's name is required";
    }
    if (!editFormData.gender) {
      newErrors.gender = "Gender is required";
    }
    if (!editFormData.grade_id) {
      newErrors.grade_id = "Grade is required";
    }
    if (!editFormData.section) {
      newErrors.section = "Section is required";
    }

    const selectedGrade = grades.find(g => g.id.toString() === editFormData.grade_id);
    const isGrade11or12 = selectedGrade && ["Grade 11", "Grade 12"].includes(selectedGrade.grade_name);
    if (isGrade11or12 && !editFormData.stream) {
      newErrors.stream = "Stream is required for Grade 11 and 12";
    }

    setEditErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSubmitAttempted(true);
    
    if (validateEditForm()) {
      try {
        const { error } = await supabase
          .from("students")
          .update({
            name: editFormData.name.trim(),
            father_name: editFormData.father_name.trim(),
            grandfather_name: editFormData.grandfather_name.trim(),
            gender: editFormData.gender,
            grade_id: parseInt(editFormData.grade_id),
            section: editFormData.section,
            stream: editFormData.stream || null,
          })
          .eq("id", editingStudent.id)
          .select();

        if (error) {
          console.error("Update error:", error);
          toast.error(`Failed to update student: ${error.message}`);
        } else {
          toast.success("Student updated successfully!");
          await fetchStudents();
          setIsEditOpen(false);
          setEditingStudent(null);
        }
      } catch (err) {
        console.error("Unexpected update error:", err);
        toast.error("Unexpected error updating student. Please try again.");
      }
    } else {
      toast.error("Please fix the errors below");
    }
  };

  useEffect(() => {
    if (editSubmitAttempted && Object.keys(editErrors).length > 0) {
      const timer = setTimeout(() => setEditSubmitAttempted(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [editSubmitAttempted, editErrors]);

  const isEditFieldError = (field: string) => editErrors[field as keyof typeof editErrors] && editSubmitAttempted;

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Students List', 14, 20);
    doc.setFontSize(12);
    doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 30);
    doc.text(`Total Records: ${filteredStudents.length}`, 14, 38);

    let y = 50;
    const header = ['#', 'Student ID', 'Name', 'Grade', 'Section', 'Gender'];
    doc.setFillColor(79, 70, 229);
    doc.rect(14, y, 190, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    header.forEach((h, i) => doc.text(h, 14 + (i * 32), y + 5));
    y += 8;

    filteredStudents.forEach((s, i) => {
      const gradeName = getGradeName(s.grade_id);
      
      const row = [
        (i + 1).toString(),
        s.student_id,
        s.name,
        gradeName + (s.stream ? ` ${s.stream}` : ''),
        s.section,
        s.gender,
      ];
      if (i % 2 === 0) doc.setFillColor(248, 250, 252);
      else doc.setFillColor(255, 255, 255);
      doc.rect(14, y, 190, 6, 'F');
      doc.setTextColor(0, 0, 0);
      row.forEach((cell, j) => doc.text(cell, 14 + (j * 32), y + 4));
      y += 6;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save('students_list.pdf');
    toast.success('Exported to PDF with modern table');
  };

  const exportToExcel = () => {
    const data = filteredStudents.map(s => {
      const gradeName = getGradeName(s.grade_id);
      
      return {
        '#': filteredStudents.indexOf(s) + 1,
        'Student ID': s.student_id,
        'Name': s.name,
        'Grade': gradeName + (s.stream ? ` ${s.stream}` : ''),
        'Section': s.section,
        'Gender': s.gender,
        'Registration Date': format(new Date(s.created_at), 'PPP'),
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({r: R, c: C});
        if (R === 0) {
          ws[cell_address].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4F46E5" } },
            alignment: { horizontal: "center", vertical: "center" },
          };
        } else if (R % 2 === 1) {
          ws[cell_address].s = { fill: { fgColor: { rgb: "F8FAFC" } } };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `students_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success('Exported to Excel with modern table styling');
  };

  const exportToWord = () => {
    const tableHeader = '<table border="1" style="border-collapse: collapse; width:100%;"><tr style="background-color: #4F46E5; color: white;"><th>#</th><th>Student ID</th><th>Name</th><th>Grade</th><th>Section</th><th>Gender</th></tr>';
    const tableBody = filteredStudents.map((s, i) => {
      const gradeName = getGradeName(s.grade_id);
      
      return `<tr style="${i % 2 === 0 ? 'background-color: #F8FAFC;' : ''}"><td>${i + 1}</td><td>${s.student_id}</td><td>${s.name}</td><td>${gradeName}${s.stream ? ` ${s.stream}` : ''}</td><td>${s.section}</td><td>${s.gender}</td></tr>`;
    }).join('');
    
    const tableFooter = '</table>';
    const content = `<html><body><h1>Students List</h1><p>Generated: ${format(new Date(), 'PPP')}</p><p>Total: ${filteredStudents.length}</p>${tableHeader}${tableBody}${tableFooter}</body></html>`;
    const blob = new Blob([content], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `students_${format(new Date(), "yyyy-MM-dd")}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to Word with modern HTML table');
  };

  // Loading State
  if (loading) {
    return (
      <div className="flex-1 space-y-8 p-8 bg-gray-50 min-h-screen">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
            <Skeleton className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
          </div>
          <Skeleton className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <Skeleton className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters Skeleton */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Skeleton className="h-10 w-full bg-gray-200 rounded animate-pulse" />
            </div>
            <Skeleton className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
            <Skeleton className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
            <Skeleton className="h-10 w-[120px] bg-gray-200 rounded animate-pulse" />
          </div>

          {/* Table Skeleton */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  {[...Array(7)].map((_, i) => (
                    <TableHead key={i}>
                      <Skeleton className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {[...Array(7)].map((_, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination Skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
              <Skeleton className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-8 p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Assigned Students</h1>
          <p className="text-muted-foreground mt-1">List of assigned students with detailed information</p>
        </div>
        <Button onClick={() => router.push("/dashboard/students/new")} className="gap-2">
          <Users className="h-4 w-4" />
          Assign Student
        </Button>
      </div>

      {/* Stats - Updated to show total, males, females and others based on current filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grade Information Card */}
      {gradeFilter !== "all" && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              Grade Information: {gradeFilter}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {grades.filter(g => g.grade_name === gradeFilter).map(grade => {
                const stats = gradeStats[grade.id] || { total: 0, males: 0, females: 0, others: 0 };
                return (
                  <React.Fragment key={grade.id}>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-lg font-bold text-blue-700">{stats.total}</div>
                      <div className="text-sm text-blue-600">Total Students</div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-lg font-bold text-blue-500">{stats.males}</div>
                      <div className="text-sm text-blue-600">Male Students</div>
                    </div>
                    <div className="p-4 bg-pink-50 rounded-lg border border-pink-200">
                      <div className="text-lg font-bold text-pink-500">{stats.females}</div>
                      <div className="text-sm text-pink-600">Female Students</div>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="text-lg font-bold text-purple-500">{stats.others}</div>
                      <div className="text-sm text-purple-600">Other Gender</div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by student ID, name, or full name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
              className="pl-10"
            />
          </div>

          <Select 
            value={gradeFilter} 
            onValueChange={(value) => {
              setGradeFilter(value);
              setSectionFilter("all"); // Reset section filter when grade changes
              setCurrentPage(1); // Reset to first page on filter change
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {grades.map((grade) => (
                <SelectItem key={grade.id} value={grade.grade_name}>
                  {grade.grade_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={sectionFilter} 
            onValueChange={(value) => {
              setSectionFilter(value);
              setCurrentPage(1); // Reset to first page on filter change
            }}
            disabled={gradeFilter === "all" ? false : availableSections.length === 0}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder={
                gradeFilter === "all" 
                  ? "All Sections" 
                  : availableSections.length === 0 
                    ? "No sections available" 
                    : "Select section"
              } />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {gradeFilter === "all" ? "All Sections" : `All Sections (${availableSections.length})`}
              </SelectItem>
              {availableSections.map((section) => (
                <SelectItem key={section} value={section}>
                  Section {section}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); exportToPDF(); }}><FileIcon className="mr-2 h-4 w-4" /> PDF</DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); exportToExcel(); }}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); exportToWord(); }}><FileIcon className="mr-2 h-4 w-4" /> Word</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Information about current filters */}
        <div className="text-sm text-muted-foreground">
          {gradeFilter === "all" && sectionFilter === "all" && "Showing all students from all grades and sections"}
          {gradeFilter !== "all" && sectionFilter === "all" && `Showing students from ${gradeFilter} (${availableSections.length} sections available)`}
          {gradeFilter !== "all" && sectionFilter !== "all" && `Showing students from ${gradeFilter}, Section ${sectionFilter}`}
          {gradeFilter === "all" && sectionFilter !== "all" && `Showing students from Section ${sectionFilter} across all grades`}
          {searchQuery && ` • Searching for: "${searchQuery}"`}
        </div>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Father's Name</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No students found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                paginatedStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.student_id}</TableCell>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.father_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getGradeNumber(student.grade_id)}
                        {student.stream ? ` ${student.stream}` : ""}
                      </Badge>
                    </TableCell>
                    <TableCell>{student.section}</TableCell>
                    <TableCell>
                      <Badge variant={
                        student.gender === "Male" || student.gender === "male" ? "default" :
                        student.gender === "Female" || student.gender === "female" ? "secondary" : "outline"
                      }>
                        {student.gender}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openEdit(student)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600" 
                            onClick={() => openDelete(student)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * STUDENTS_PER_PAGE + 1} to {Math.min(currentPage * STUDENTS_PER_PAGE, filteredStudents.length)} of {filteredStudents.length}
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} 
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} 
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{editingStudent?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Student Information</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="name">Student Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditInputChange}
                  required
                  className={isEditFieldError("name") ? "border-red-500 ring-1 ring-red-500 animate-pulse" : ""}
                />
                {editErrors.name && (
                  <p className="text-red-600 text-sm mt-1 flex items-center transition-opacity duration-300">
                    <AlertCircle className="h-4 w-4 mr-1" /> {editErrors.name}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="father_name">Father's Name *</Label>
                <Input
                  id="father_name"
                  name="father_name"
                  value={editFormData.father_name}
                  onChange={handleEditInputChange}
                  required
                  className={isEditFieldError("father_name") ? "border-red-500 ring-1 ring-red-500 animate-pulse" : ""}
                />
                {editErrors.father_name && (
                  <p className="text-red-600 text-sm mt-1 flex items-center transition-opacity duration-300">
                    <AlertCircle className="h-4 w-4 mr-1" /> {editErrors.father_name}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="grandfather_name">Grandfather's Name *</Label>
                <Input
                  id="grandfather_name"
                  name="grandfather_name"
                  value={editFormData.grandfather_name}
                  onChange={handleEditInputChange}
                  required
                  className={isEditFieldError("grandfather_name") ? "border-red-500 ring-1 ring-red-500 animate-pulse" : ""}
                />
                {editErrors.grandfather_name && (
                  <p className="text-red-600 text-sm mt-1 flex items-center transition-opacity duration-300">
                    <AlertCircle className="h-4 w-4 mr-1" /> {editErrors.grandfather_name}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="gender">Gender *</Label>
                <Select value={editFormData.gender} onValueChange={handleEditGenderChange}>
                  <SelectTrigger className={isEditFieldError("gender") ? "border-red-500 ring-1 ring-red-500 animate-pulse" : ""}>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {editErrors.gender && (
                  <p className="text-red-600 text-sm mt-1 flex items-center transition-opacity duration-300">
                    <AlertCircle className="h-4 w-4 mr-1" /> {editErrors.gender}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="grade_id">Grade *</Label>
                <Select value={editFormData.grade_id} onValueChange={handleEditGradeChange}>
                  <SelectTrigger className={isEditFieldError("grade_id") ? "border-red-500 ring-1 ring-red-500 animate-pulse" : ""}>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map((grade) => (
                      <SelectItem key={grade.id} value={grade.id.toString()}>
                        {grade.grade_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editErrors.grade_id && (
                  <p className="text-red-600 text-sm mt-1 flex items-center transition-opacity duration-300">
                    <AlertCircle className="h-4 w-4 mr-1" /> {editErrors.grade_id}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="section">Section *</Label>
                <Select value={editFormData.section} onValueChange={handleEditSectionChange}>
                  <SelectTrigger className={isEditFieldError("section") ? "border-red-500 ring-1 ring-red-500 animate-pulse" : ""}>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSections.map((section) => (
                      <SelectItem key={section} value={section}>
                        {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editErrors.section && (
                  <p className="text-red-600 text-sm mt-1 flex items-center transition-opacity duration-300">
                    <AlertCircle className="h-4 w-4 mr-1" /> {editErrors.section}
                  </p>
                )}
              </div>
              {["Grade 11", "Grade 12"].includes(getGradeName(parseInt(editFormData.grade_id))) && (
                <div>
                  <Label htmlFor="stream">Stream *</Label>
                  <Select value={editFormData.stream} onValueChange={handleEditStreamChange}>
                    <SelectTrigger className={isEditFieldError("stream") ? "border-red-500 ring-1 ring-red-500 animate-pulse" : ""}>
                      <SelectValue placeholder="Select stream" />
                    </SelectTrigger>
                    <SelectContent>
                      {streamOptions.map((stream) => (
                        <SelectItem key={stream} value={stream}>
                          {stream}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editErrors.stream && (
                    <p className="text-red-600 text-sm mt-1 flex items-center transition-opacity duration-300">
                      <AlertCircle className="h-4 w-4 mr-1" /> {editErrors.stream}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="gap-2">
                <Edit className="h-4 w-4" />
                Update Student
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}