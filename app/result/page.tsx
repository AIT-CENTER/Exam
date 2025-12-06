"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  Award,
  TrendingUp,
  User,
  BookOpen,
  GraduationCap,
  Target,
  Crown,
  Medal,
  Trophy,
  LoaderIcon,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

interface StudentResult {
  id: number;
  student_id: string;
  student_name: string;
  father_name: string;
  grandfather_name: string;
  grade_id: number;
  grade_name: string;
  section: string;
  gender: string;
  total_exams: number;
  total_marks_obtained: number;
  total_possible_marks: number;
  overall_average: number;
  subject_results: {
    subject_id: number;
    subject_name: string;
    total_marks_obtained: number;
    total_possible_marks: number;
    average: number;
    exam_count: number;
  }[];
  rank?: number;
}

interface Settings {
  maximum_average: number;
  view_result: boolean;
}

export default function StudentResultPage() {
  const [studentId, setStudentId] = useState("");
  const [studentResult, setStudentResult] = useState<StudentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [allStudents, setAllStudents] = useState<StudentResult[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showForm, setShowForm] = useState(true);

  useEffect(() => {
    fetchAllStudentsData();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .single();

      if (error) {
        console.error("Settings error:", error);
        setSettings({
          maximum_average: 50,
          view_result: true
        });
        return;
      }

      setSettings(data);
    } catch (error) {
      console.error("Error fetching settings:", error);
      setSettings({
        maximum_average: 50,
        view_result: true
      });
    }
  };

  const fetchAllStudentsData = async () => {
    try {
      setDataLoading(true);
      
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(`
          id,
          student_id,
          name,
          father_name,
          grandfather_name,
          grade_id,
          section,
          gender,
          grades!students_grade_id_fkey(grade_name)
        `)
        .order("name");

      if (studentsError) {
        console.error("Students query error:", studentsError);
        throw studentsError;
      }

      const { data: resultsData, error: resultsError } = await supabase
        .from("results")
        .select(`
          id,
          exam_id,
          student_id,
          total_marks_obtained,
          grade,
          exams!results_exam_id_fkey(
            total_marks,
            subject_id,
            subjects!exams_subject_id_fkey(subject_name)
          )
        `);

      if (resultsError) {
        console.error("Results query error:", resultsError);
        throw resultsError;
      }

      const studentResultsMap = new Map();

      studentsData?.forEach(student => {
        studentResultsMap.set(student.id, {
          id: student.id,
          student_id: student.student_id,
          student_name: student.name,
          father_name: student.father_name,
          grandfather_name: student.grandfather_name,
          grade_id: student.grade_id,
          grade_name: student.grades?.grade_name || "Unknown",
          section: student.section,
          gender: student.gender,
          total_exams: 0,
          total_marks_obtained: 0,
          total_possible_marks: 0,
          overall_average: 0,
          subject_results: []
        });
      });

      resultsData?.forEach(result => {
        const student = studentResultsMap.get(result.student_id);
        if (student) {
          const subjectId = result.exams?.subject_id;
          const subjectName = result.exams?.subjects?.subject_name || "Unknown";
          const marksObtained = result.total_marks_obtained;
          const totalMarks = result.exams?.total_marks || 0;

          student.total_exams += 1;
          student.total_marks_obtained += marksObtained;
          student.total_possible_marks += totalMarks;

          let subjectResult = student.subject_results.find((sr: any) => sr.subject_id === subjectId);
          if (!subjectResult) {
            subjectResult = {
              subject_id: subjectId,
              subject_name: subjectName,
              total_marks_obtained: 0,
              total_possible_marks: 0,
              average: 0,
              exam_count: 0
            };
            student.subject_results.push(subjectResult);
          }

          subjectResult.total_marks_obtained += marksObtained;
          subjectResult.total_possible_marks += totalMarks;
          subjectResult.exam_count += 1;
        }
      });

      const processedResults: StudentResult[] = Array.from(studentResultsMap.values()).map(student => {
        student.subject_results.forEach((subject: any) => {
          if (subject.exam_count > 0) {
            subject.average = Math.round(subject.total_marks_obtained / subject.exam_count);
          }
        });

        if (student.subject_results.length > 0) {
          const totalSubjectAverage = student.subject_results.reduce((sum, subject) => sum + subject.average, 0);
          student.overall_average = Math.round(totalSubjectAverage / student.subject_results.length);
        }

        return student;
      });

      const rankedResults = calculateRanks(processedResults);
      setAllStudents(rankedResults);

    } catch (error) {
      console.error("Error fetching students data:", error);
      toast.error("Failed to load students data");
    } finally {
      setDataLoading(false);
    }
  };

  const calculateRanks = (students: StudentResult[]): StudentResult[] => {
    const groupedStudents: { [key: string]: StudentResult[] } = {};
    
    students.forEach(student => {
      const key = `${student.grade_id}-${student.section}`;
      if (!groupedStudents[key]) {
        groupedStudents[key] = [];
      }
      groupedStudents[key].push(student);
    });

    Object.keys(groupedStudents).forEach(key => {
      groupedStudents[key].sort((a, b) => b.overall_average - a.overall_average);
      
      groupedStudents[key].forEach((student, index) => {
        student.rank = index + 1;
      });
    });

    return Object.values(groupedStudents).flat();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentId.trim()) {
      toast.error("Please enter student ID");
      return;
    }

    if (dataLoading) {
      toast.error("Data is still loading, please wait...");
      return;
    }

    // Check if results viewing is enabled
    if (settings && !settings.view_result) {
      toast.error("Results viewing is currently disabled. Please contact your teacher.");
      return;
    }

    setLoading(true);

    try {
      const student = allStudents.find(s => 
        s.student_id.toLowerCase() === studentId.toLowerCase().trim()
      );

      if (student) {
        // Hide form with animation
        setShowForm(false);
        
        // Wait for animation to complete before showing results
        setTimeout(() => {
          setStudentResult(student);
          setLoading(false);
        }, 500);
      } else {
        toast.error("Student not found");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error searching student:", error);
      toast.error("Failed to search student");
      setLoading(false);
    }
  };

  const handleBackToSearch = () => {
    setStudentResult(null);
    setStudentId("");
    setShowForm(true);
  };

  const getTotalPoints = (student: StudentResult): number => {
    return student.subject_results.reduce((total, subject) => total + subject.average, 0);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Crown className="h-6 w-6 text-orange-500" />;
      default:
        return null;
    }
  };

  // Get unique subjects for table headers
  const uniqueSubjects = useMemo(() => {
    if (!studentResult) return [];
    const subjects = new Set<string>();
    studentResult.subject_results.forEach(subject => {
      subjects.add(subject.subject_name);
    });
    return Array.from(subjects).sort();
  }, [studentResult]);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 items-center justify-center p-4">
      <div className="w-full max-w-7xl">
        {/* Search Form */}
        <AnimatePresence mode="wait">
          {showForm && (
            <motion.div
              initial={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ duration: 0.5 }}
              className="flex justify-center"
            >
              <Card className="w-full max-w-md border-none shadow-2xl bg-white">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl font-bold text-center text-gray-800">
                    View Your Results
                  </CardTitle>
                  <CardDescription className="text-center">
                    {dataLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Spinner className="size-4" />
                        Loading data...
                      </div>
                    ) : (
                      "Enter your Student ID to access your results"
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSearch} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="studentId" className="text-gray-700">
                        Student ID
                      </Label>
                      <Input
                        id="studentId"
                        type="text"
                        placeholder="Enter your Student ID"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="border-gray-300 focus:border-blue-500"
                        disabled={loading || dataLoading}
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 transition-all"
                      disabled={loading || dataLoading}
                    >
                      {loading ? (
                        <span className="flex items-center justify-center">
                          <Spinner className="mr-2" />
                          Searching...
                        </span>
                      ) : dataLoading ? (
                        <span className="flex items-center justify-center">
                          <Spinner className="mr-2" />
                          Loading...
                        </span>
                      ) : (
                        "View Results"
                      )}
                    </Button>
                  </form>
                  {settings && !settings.view_result && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700 text-center">
                        Results viewing is currently disabled. Please contact your teacher.
                      </p>
                    </div>
                  )}
                  <p className="text-center text-sm text-muted-foreground mt-6">
                    Need help?{" "}
                    <button className="text-blue-600 hover:text-blue-800 font-medium">
                      Contact your teacher
                    </button>
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Skeleton */}
        <AnimatePresence>
          {loading && !studentResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-6xl mx-auto"
            >
              <Card className="shadow-xl border-0 bg-white">
                <CardHeader className="border-b">
                  <Skeleton className="h-8 w-64 mx-auto" />
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                    {[...Array(4)].map((_, i) => (
                      <Card key={i} className="p-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-6 w-16" />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-48" />
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-6 w-16" />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Student Results */}
        <AnimatePresence>
          {studentResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full"
            >
              <Card className="shadow-2xl border-0 bg-white overflow-hidden">
                {/* Back Button */}
                <div className="absolute top-4 left-4 z-10">
                  <Button
                    variant="outline"
                    onClick={handleBackToSearch}
                    className="bg-white border-gray-200 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Search
                  </Button>
                </div>

                {/* Student Header */}
                <CardHeader className="text-center relative pb-6 pt-12 bg-gradient-to-r from-blue-500 to-purple-600">
                  <div className="absolute top-4 right-4">
                    <Badge variant="secondary" className="text-sm px-3 py-1 bg-white/20 text-white border-white/30">
                      ID: {studentResult.student_id}
                    </Badge>
                  </div>
                  
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-sm border border-white/30"
                  >
                    {getRankIcon(studentResult.rank || 0)}
                  </motion.div>
                  
                  <CardTitle className="text-2xl font-bold text-white mt-4">
                    {studentResult.student_name}
                  </CardTitle>
                  <CardDescription className="text-blue-100">
                    {studentResult.father_name} • {studentResult.grandfather_name}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card className="p-4 text-center border border-gray-200 bg-white">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <GraduationCap className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-gray-700 text-sm">Grade & Section</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900">
                        {studentResult.grade_name} - {studentResult.section}
                      </div>
                    </Card>

                    <Card className="p-4 text-center border border-gray-200 bg-white">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Target className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-gray-700 text-sm">Class Rank</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900 flex items-center justify-center gap-1">
                        {getRankIcon(studentResult.rank || 0)}
                        #{studentResult.rank}
                      </div>
                    </Card>

                    <Card className="p-4 text-center border border-gray-200 bg-white">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <TrendingUp className="h-5 w-5 text-purple-600" />
                        <span className="font-semibold text-gray-700 text-sm">Total Points</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900">
                        {getTotalPoints(studentResult)}
                      </div>
                    </Card>

                    <Card className="p-4 text-center border border-gray-200 bg-white">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Award className="h-5 w-5 text-orange-600" />
                        <span className="font-semibold text-gray-700 text-sm">Average Score</span>
                      </div>
                      <div className="text-xl font-bold text-gray-900">
                        {studentResult.overall_average}
                      </div>
                    </Card>
                  </div>

                  {/* Subject Results Table */}
                  <Card className="border border-gray-200 bg-white">
                    <CardHeader className="pb-4 border-b">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <BookOpen className="h-5 w-5 text-blue-600" />
                        Subject-wise Performance
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Detailed breakdown of performance across all subjects
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="font-semibold text-gray-700 text-sm border-r">Student</TableHead>
                              {uniqueSubjects.map((subject) => (
                                <TableHead key={subject} className="font-semibold text-gray-700 text-sm text-center border-r">
                                  {subject}
                                </TableHead>
                              ))}
                              <TableHead className="font-semibold text-gray-700 text-sm text-center">Total</TableHead>
                              <TableHead className="font-semibold text-gray-700 text-sm text-center">Average</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow className="hover:bg-gray-50">
                              <TableCell className="font-medium text-sm border-r py-3">
                                <div className="space-y-1">
                                  <div className="text-gray-900">{studentResult.student_name}</div>
                                  <div className="text-xs text-gray-500">ID: {studentResult.student_id}</div>
                                </div>
                              </TableCell>
                              {uniqueSubjects.map((subjectName) => {
                                const subjectResult = studentResult.subject_results.find(sr => sr.subject_name === subjectName);
                                const points = subjectResult ? subjectResult.average : 0;
                                return (
                                  <TableCell key={subjectName} className="text-center text-sm border-r py-3">
                                    <div className={`font-bold ${
                                      points >= 80 ? 'text-green-600' :
                                      points >= 60 ? 'text-yellow-600' :
                                      points >= 50 ? 'text-orange-600' : 'text-red-600'
                                    }`}>
                                      {points}
                                    </div>
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center text-sm font-bold text-gray-900 py-3">
                                {getTotalPoints(studentResult)}
                              </TableCell>
                              <TableCell className="text-center text-sm font-bold text-gray-900 py-3">
                                {studentResult.overall_average}
                              </TableCell>
                            </TableRow>
                            
                            {/* Summary Row */}
                            <TableRow className="bg-gray-50 border-t-2 border-gray-300">
                              <TableCell className="font-semibold text-sm border-r py-2 text-gray-700">
                                Summary
                              </TableCell>
                              {uniqueSubjects.map((subjectName) => {
                                const subjectResult = studentResult.subject_results.find(sr => sr.subject_name === subjectName);
                                const points = subjectResult ? subjectResult.average : 0;
                                const performance = points >= 80 ? 'Excellent' :
                                                  points >= 60 ? 'Good' :
                                                  points >= 50 ? 'Average' : 'Needs Improvement';
                                return (
                                  <TableCell key={subjectName} className="text-center text-xs border-r py-2">
                                    <div className={`px-2 py-1 rounded ${
                                      points >= 80 ? 'bg-green-100 text-green-800' :
                                      points >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                      points >= 50 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {performance}
                                    </div>
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center text-xs font-semibold text-gray-700 py-2">
                                Total Points
                              </TableCell>
                              <TableCell className="text-center text-xs font-semibold text-gray-700 py-2">
                                Overall Avg
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Additional Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <Card className="border border-gray-200 bg-white">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <Award className="h-4 w-4 text-blue-600" />
                          Performance Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Exams Taken:</span>
                          <span className="font-medium text-gray-900">{studentResult.total_exams}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Marks Obtained:</span>
                          <span className="font-medium text-gray-900">{studentResult.total_marks_obtained}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Possible Marks:</span>
                          <span className="font-medium text-gray-900">{studentResult.total_possible_marks}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Number of Subjects:</span>
                          <span className="font-medium text-gray-900">{studentResult.subject_results.length}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-gray-200 bg-white">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-blue-600" />
                          Student Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Student ID:</span>
                          <span className="font-medium text-gray-900">{studentResult.student_id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Gender:</span>
                          <span className="font-medium text-gray-900 capitalize">{studentResult.gender}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Grade:</span>
                          <span className="font-medium text-gray-900">{studentResult.grade_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Section:</span>
                          <span className="font-medium text-gray-900">{studentResult.section}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}