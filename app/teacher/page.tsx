"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, ClipboardList, TrendingUp, BookOpen } from "lucide-react"
import { getTeacherDataFromCookie } from "@/utils/teacherCookie"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"

interface Student {
  id: string
  student_id: string
  name: string
  father_name: string
  grandfather_name: string
  section: string
  gender: string
  grade_id: number
  stream?: string
  grades?: {
    grade_name: string
    description?: string
  }
}

interface Exam {
  id: string
  exam_code: string
  title: string
  exam_date: string
  section: string
  total_marks: number
  exam_active: boolean
  created_by: string
  description?: string
  duration?: number
  show_results?: boolean
  subject_id?: number
  grade_id?: number
  subjects?: {
    subject_name: string
  }
  grades?: {
    grade_name: string
  }
  assignment_id?: number // For tracking if it's from assign_exams
}

interface Result {
  id: string
  total_marks_obtained: number
  exam_id: number
}

interface TeacherData {
  id: string
  username: string
  full_name: string
  email: string
  grade_id: number | null
  gradeName?: string
  department?: string | null
  sections?: string[]
  subject_id?: number | null
  subjectName?: string
  stream?: string
  fullName?: string
  teacherId?: string
}

interface AssignExam {
  id: number
  exam_id: number
  teacher_id: string
  student_id: number
  grade_id: number
  section: string
  assigned_at: string
  assigned_by: string
}

export default function TeacherDashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [teacherData, setTeacherData] = useState<TeacherData | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [assignedExams, setAssignedExams] = useState<Exam[]>([])
  const [teacherAssignments, setTeacherAssignments] = useState<AssignExam[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setIsLoading(true)

      const teacher = await getTeacherDataFromCookie()

      if (!teacher) {
        router.push("/teacher/login")
        return
      }

      console.log("Teacher data from cookie:", teacher)
      setTeacherData(teacher)

      const teacherId = teacher.id || teacher.teacherId
      console.log("Teacher ID:", teacherId)

      // 1. Load exams created by this teacher
      const { data: examsData, error: examsError } = await supabase
        .from("exams")
        .select(`
          *,
          subjects (subject_name),
          grades (grade_name)
        `)
        .eq("created_by", teacherId)
        .order("created_at", { ascending: false })

      if (examsError) {
        console.error("Exams error:", examsError)
        toast.error("Failed to load exams")
      } else {
        console.log("Exams created by teacher:", examsData?.length || 0, "exams")
      }

      // 2. Load exams assigned to this teacher through assign_exams table
      // First get all assignment records
      const { data: assignExamsData, error: assignExamsError } = await supabase
        .from("assign_exams")
        .select(`
          id,
          exam_id,
          teacher_id,
          student_id,
          grade_id,
          section,
          assigned_at,
          assigned_by
        `)
        .eq("teacher_id", teacherId)

      if (assignExamsError) {
        console.error("Assign exams error:", assignExamsError)
        toast.error("Failed to load assigned exams")
      } else {
        console.log("Assign exams records:", assignExamsData?.length || 0, "records")
        setTeacherAssignments(assignExamsData || [])
        
        // Get unique exam IDs from assignments
        const uniqueExamIds = Array.from(new Set(
          (assignExamsData || []).map(assignment => assignment.exam_id)
        ))
        
        console.log("Unique exam IDs from assignments:", uniqueExamIds)
        
        if (uniqueExamIds.length > 0) {
          // Load the actual exam data for these IDs
          const { data: assignedExamsData, error: assignedExamsError } = await supabase
            .from("exams")
            .select(`
              *,
              subjects (subject_name),
              grades (grade_name)
            `)
            .in("id", uniqueExamIds)
            .order("created_at", { ascending: false })

          if (assignedExamsError) {
            console.error("Assigned exams details error:", assignedExamsError)
            toast.error("Failed to load assigned exam details")
          } else {
            console.log("Assigned exams loaded:", assignedExamsData?.length || 0, "exams")
            // Mark these exams as assigned (not created by this teacher)
            const assignedExamsWithFlag = (assignedExamsData || []).map(exam => ({
              ...exam,
              assignment_id: assignExamsData?.find(a => a.exam_id === exam.id)?.id
            }))
            setAssignedExams(assignedExamsWithFlag)
          }
        } else {
          setAssignedExams([])
        }
      }

      // 3. Load ALL students that this teacher is responsible for
      const assignedStudentIds = teacherAssignments.map(assignment => assignment.student_id)
      
      let studentsQuery = supabase
        .from("students")
        .select(`
          *,
          grades!students_grade_id_fkey (
            grade_name,
            description
          )
        `)

      // If teacher has grade_id, include students from that grade
      if (teacher.gradeId) {
        studentsQuery = studentsQuery.eq("grade_id", teacher.gradeId)
        
        // If teacher has specific sections, filter by those sections too
        if (teacher.sections && teacher.sections.length > 0) {
          studentsQuery = studentsQuery.in("section", teacher.sections)
        }
      }

      const { data: studentsData, error: studentsError } = await studentsQuery

      if (studentsError) {
        console.error("Students error:", studentsError)
        toast.error("Failed to load students")
      }

      // Combine all students
      const allStudentIds = new Set<string>()
      const allStudents: Student[] = []

      // Add students from teacher's grade/sections
      if (studentsData) {
        studentsData.forEach(student => {
          allStudentIds.add(student.id)
          allStudents.push(student)
        })
      }

      // Also load students specifically assigned through assign_exams
      if (assignedStudentIds.length > 0) {
        const { data: assignedStudentsData, error: assignedStudentsError } = await supabase
          .from("students")
          .select(`
            *,
            grades!students_grade_id_fkey (
              grade_name,
              description
            )
          `)
          .in("id", assignedStudentIds)

        if (!assignedStudentsError && assignedStudentsData) {
          assignedStudentsData.forEach(student => {
            if (!allStudentIds.has(student.id)) {
              allStudentIds.add(student.id)
              allStudents.push(student)
            }
          })
        }
      }

      console.log("Total unique students:", allStudents.length)

      // 4. Load results for all exams
      let resultsQuery = supabase.from("results").select("*")

      // Get all unique exam IDs without duplicates
      const createdExamIds = (examsData || []).map(exam => exam.id)
      const assignedExamIds = assignedExams.map(exam => exam.id)
      const allExamIds = [...createdExamIds, ...assignedExamIds]
      const uniqueExamIdsForResults = Array.from(new Set(allExamIds))

      if (uniqueExamIdsForResults.length > 0) {
        resultsQuery = resultsQuery.in("exam_id", uniqueExamIdsForResults)
        console.log("Loading results for unique exam IDs:", uniqueExamIdsForResults)
      }

      const { data: resultsData, error: resultsError } = await resultsQuery

      if (resultsError) {
        console.error("Results error:", resultsError)
        toast.error("Failed to load results")
      }

      setStudents(allStudents)
      setExams(examsData || [])
      setResults(resultsData || [])
    } catch (error) {
      console.error("Dashboard error:", error)
      toast.error("Failed to load dashboard data")
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate statistics
  const activeExams = exams.filter(exam => exam.exam_active)
  const assignedActiveExams = assignedExams.filter(exam => exam.exam_active)
  
  // Combine all exams for display - REMOVE DUPLICATES
  const createdExamIdsSet = new Set(exams.map(exam => exam.id))
  const assignedExamsFiltered = assignedExams.filter(exam => !createdExamIdsSet.has(exam.id))
  const allExams = [...exams, ...assignedExamsFiltered]
  const allActiveExams = [...activeExams, ...assignedActiveExams]

  // Get unique grades from students
  const uniqueGrades = [...new Set(students.map(student => student.grades?.grade_name).filter(Boolean))]

  const stats = {
    myExams: allExams.length,
    activeExams: allActiveExams.length,
    myStudents: students.length,
    uniqueGrades: uniqueGrades.length,
    overallSuccessRate:
      results.length > 0 && allExams.length > 0
        ? Math.round(
            (results.reduce((sum, r) => sum + r.total_marks_obtained, 0) /
              (allExams.reduce((sum, e) => sum + e.total_marks, 0) * results.length)) *
              100,
          )
        : 0,
  }

  const topStudents = students.slice(0, 5)

  const teacherStats = [
    {
      title: "My Exams",
      value: stats.myExams.toLocaleString(),
      change: `${stats.activeExams} active exams`,
      icon: ClipboardList,
    },
    {
      title: "My Students",
      value: stats.myStudents.toLocaleString(),
      change: `Across ${stats.uniqueGrades} grade${stats.uniqueGrades !== 1 ? 's' : ''}`,
      icon: Users,
    },
    {
      title: "Success Rate",
      value: `${stats.overallSuccessRate}%`,
      change: "Overall average",
      icon: TrendingUp,
    },
  ]

  if (isLoading) {
    return (
      <div className="flex-1 space-y-8 p-4 lg:p-8 bg-gradient-to-b from-gray-50 to-white min-h-screen">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <Skeleton className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <Skeleton className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                <Skeleton className="h-3 w-24 bg-gray-200 rounded animate-pulse mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
              <Skeleton className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
            </div>
            <Skeleton className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {[...Array(6)].map((_, i) => (
                    <TableHead key={i}>
                      <Skeleton className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {[...Array(6)].map((_, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-8 p-4 lg:p-8 bg-gradient-to-b from-gray-50 to-white min-h-screen">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome, {teacherData?.full_name || teacherData?.fullName || "Teacher"}!
          </h1>
          <p className="text-muted-foreground mt-1">
            {teacherData?.subjectName
              ? `Teaching ${teacherData.subjectName}`
              : "Teacher Dashboard"}
            {teacherData?.gradeName && ` • Assigned to ${teacherData.gradeName}`}
            {teacherData?.sections && teacherData.sections.length > 0 && 
              ` • Sections: ${teacherData.sections.join(", ")}`}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-blue-600 border-blue-200">
            {students.length} Students
          </Badge>
          <Badge variant="outline" className="text-green-600 border-green-200">
            {allExams.length} Exams
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teacherStats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">{stat.title}</CardTitle>
              <stat.icon className="h-5 w-5 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Students Section */}
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl text-gray-900">My Students</CardTitle>
            <CardDescription className="text-muted-foreground">
              {students.length > 0 
                ? `Showing ${students.length} students from ${stats.uniqueGrades} grade${stats.uniqueGrades !== 1 ? 's' : ''}`
                : "No students assigned yet"}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {uniqueGrades.length > 0 && (
              <Badge variant="secondary" className="text-sm">
                Grades: {uniqueGrades.join(", ")}
              </Badge>
            )}
            <Button variant="outline" onClick={() => router.push("/teacher/students")}>
              View All ({students.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <div className="mb-4">
                <Users className="h-12 w-12 text-gray-400 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Students Assigned</h3>
              <p className="text-muted-foreground mb-4">
                You don't have any students assigned to you yet.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {uniqueGrades.map((grade, index) => (
                  <Badge key={index} variant="outline" className="text-blue-600 border-blue-200">
                    <BookOpen className="h-3 w-3 mr-1" />
                    {grade}
                  </Badge>
                ))}
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-b">
                    <TableHead className="w-[50px] text-gray-700">#</TableHead>
                    <TableHead className="text-gray-700">Student ID</TableHead>
                    <TableHead className="text-gray-700">Full Name</TableHead>
                    <TableHead className="text-gray-700">Grade</TableHead>
                    <TableHead className="text-gray-700">Section</TableHead>
                    <TableHead className="text-gray-700">Gender</TableHead>
                    <TableHead className="text-gray-700">Stream</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topStudents.map((student, idx) => (
                    <TableRow key={student.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="font-medium text-gray-900">{idx + 1}</TableCell>
                      <TableCell className="font-medium text-gray-900">{student.student_id}</TableCell>
                      <TableCell className="text-gray-900">
                        {student.name} {student.father_name} {student.grandfather_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                          {student.grades?.grade_name || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-indigo-600 border-indigo-200">
                          {student.section}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={student.gender === "male" ? "default" : "secondary"}>
                          {student.gender}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {student.stream ? (
                          <Badge variant="outline" className={
                            student.stream === 'Natural' 
                              ? "text-green-600 border-green-200" 
                              : "text-purple-600 border-purple-200"
                          }>
                            {student.stream}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Exams Section */}
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl text-gray-900">
              {allExams.length > 0 ? "My Exams" : "Exams"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {allExams.length > 0 
                ? `${exams.length} created • ${assignedExamsFiltered.length} assigned • ${allActiveExams.length} active`
                : "No exams available yet"}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => router.push("/teacher/exams")}>
            {allExams.length > 0 ? `View All (${allExams.length})` : "Create Exam"}
          </Button>
        </CardHeader>
        <CardContent>
          {allExams.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <div className="mb-4">
                <ClipboardList className="h-12 w-12 text-gray-400 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Exams Available</h3>
              <p className="text-muted-foreground mb-4">
                You haven't created or been assigned any exams yet.
              </p>
              <Button onClick={() => router.push("/teacher/exams/new")}>
                Create Your First Exam
              </Button>
            </div>
          ) : (
            <div>
              <div className="mb-4 text-sm text-gray-600">
                Showing {allExams.length} unique exams (no duplicates)
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-b">
                    <TableHead className="text-gray-700">Status</TableHead>
                    <TableHead className="text-gray-700">Exam Code</TableHead>
                    <TableHead className="text-gray-700">Title</TableHead>
                    <TableHead className="text-gray-700">Subject</TableHead>
                    <TableHead className="text-gray-700">Grade</TableHead>
                    <TableHead className="text-gray-700">Section</TableHead>
                    <TableHead className="text-gray-700">Marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allExams.slice(0, 5).map((exam) => {
                    // Check if this exam was created by the current teacher
                    const isCreatedByMe = exams.some(e => e.id === exam.id)
                    
                    return (
                      <TableRow key={`${exam.id}-${isCreatedByMe ? 'created' : 'assigned'}`} 
                               className="hover:bg-gray-50 transition-colors">
                        <TableCell>
                          <Badge 
                            variant={exam.exam_active ? "default" : "outline"} 
                            className={
                              exam.exam_active 
                                ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200" 
                                : "bg-gray-100 text-gray-800"
                            }
                          >
                            {exam.exam_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-gray-900">{exam.exam_code}</TableCell>
                        <TableCell className="text-gray-900 truncate max-w-[180px]">{exam.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-orange-600 border-orange-200 truncate">
                            {(exam as any).subjects?.subject_name || exam.subject_id || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-blue-600 border-blue-200">
                            {(exam as any).grades?.grade_name || exam.grade_id || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-green-600 border-green-200">
                            {exam.section}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{exam.total_marks}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader>
          <CardTitle className="text-xl text-gray-900">Teaching Summary</CardTitle>
          <CardDescription className="text-muted-foreground">
            Overview of your teaching responsibilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-blue-500 mr-2" />
                <h3 className="font-medium text-gray-900">Total Students</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">{students.length}</p>
              <p className="text-sm text-muted-foreground">
                Across {stats.uniqueGrades} grade{stats.uniqueGrades !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="flex items-center">
                <ClipboardList className="h-5 w-5 text-green-500 mr-2" />
                <h3 className="font-medium text-gray-900">Total Exams</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">{allExams.length}</p>
              <p className="text-sm text-muted-foreground">
                {allActiveExams.length} active • {allExams.length - allActiveExams.length} inactive
              </p>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="flex items-center">
                <TrendingUp className="h-5 w-5 text-purple-500 mr-2" />
                <h3 className="font-medium text-gray-900">Success Rate</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">{stats.overallSuccessRate}%</p>
              <p className="text-sm text-muted-foreground">
                Based on {results.length} exam results
              </p>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="flex items-center">
                <BookOpen className="h-5 w-5 text-orange-500 mr-2" />
                <h3 className="font-medium text-gray-900">Primary Subject</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {teacherData?.subjectName || "N/A"}
              </p>
              <p className="text-sm text-muted-foreground">
                {teacherData?.gradeName ? `Grade ${teacherData.gradeName}` : "All Grades"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}