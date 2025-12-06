"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, ClipboardList, TrendingUp } from "lucide-react"
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
  }
}

interface Exam {
  id: string
  exam_code: string
  title: string
  exam_date: string
  section: string
  total_marks: number
}

interface Result {
  id: string
  total_marks_obtained: number
  exam_id: number
}

const isHigherGrade = (gradeName: string | undefined): boolean => {
  if (!gradeName) return false
  const gradeNum = Number.parseInt(gradeName.replace(/\D/g, ""))
  return gradeNum >= 11
}

export default function TeacherDashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [teacherData, setTeacherData] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [results, setResults] = useState<Result[]>([])

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

      setTeacherData(teacher)

      // Load exams created by this teacher
      const { data: examsData, error: examsError } = await supabase
        .from("exams")
        .select("*")
        .eq("created_by", teacher.teacherId)

      if (examsError) {
        console.error("Exams error:", examsError)
        toast.error("Failed to load exams")
      }

      let studentsQuery = supabase
        .from("students")
        .select(`
          *,
          grades!students_grade_id_fkey (
            grade_name
          )
        `)
        .order("name")

      if (teacher.gradeId && teacher.sections && teacher.sections.length > 0) {
        studentsQuery = studentsQuery.eq("grade_id", teacher.gradeId).in("section", teacher.sections)
      }

      const { data: studentsData, error: studentsError } = await studentsQuery

      if (studentsError) {
        console.error("Students error:", studentsError)
        toast.error("Failed to load students")
      }

      let filteredStudents = studentsData || []

      if (!isHigherGrade(teacher.gradeName) && teacher.stream) {
        // For grades below 11, filter students by teacher's stream
        filteredStudents = filteredStudents.filter((student: Student) => student.stream === teacher.stream)
      }
      // For grades 11 and 12, show all students (no stream filtering)

      // Load results for exams created by this teacher
      let resultsQuery = supabase.from("results").select("*")

      if (examsData && examsData.length > 0) {
        const examIds = examsData.map((exam) => exam.id)
        resultsQuery = resultsQuery.in("exam_id", examIds)
      }

      const { data: resultsData, error: resultsError } = await resultsQuery

      if (resultsError) {
        console.error("Results error:", resultsError)
        toast.error("Failed to load results")
      }

      setStudents(filteredStudents)
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
  const stats = {
    myExams: exams.length,
    myStudents: students.length,
    overallSuccessRate:
      results.length > 0 && exams.length > 0
        ? Math.round(
            (results.reduce((sum, r) => sum + r.total_marks_obtained, 0) /
              (exams.reduce((sum, e) => sum + e.total_marks, 0) * results.length)) *
              100,
          )
        : 0,
  }

  const topStudents = students.slice(0, 5)

  const teacherStats = [
    {
      title: "My Exams",
      value: stats.myExams.toLocaleString(),
      change: teacherData?.subjectName ? `${teacherData.subjectName} exams` : "Exams assigned",
      icon: ClipboardList,
    },
    {
      title: "My Students",
      value: stats.myStudents.toLocaleString(),
      change: teacherData?.gradeName ? `Students in ${teacherData.gradeName}` : "Students under me",
      icon: Users,
    },
    {
      title: "Overall Success Rate",
      value: `${stats.overallSuccessRate}%`,
      change: "Class average",
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
            Welcome, {teacherData?.fullName || "Teacher"}!
          </h1>
          <p className="text-muted-foreground mt-1">
            {teacherData?.gradeName && teacherData?.subjectName
              ? `Teaching ${teacherData.subjectName} to ${teacherData.gradeName} - Sections: ${teacherData.sections?.join(", ")}${teacherData.stream && !isHigherGrade(teacherData.gradeName) ? ` (${teacherData.stream} Stream)` : ""}`
              : "A comprehensive summary of your students performance and exam activity."}
          </p>
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

      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl text-gray-900">My Students</CardTitle>
            <CardDescription className="text-muted-foreground">
              {teacherData?.sections
                ? `Students in sections: ${teacherData.sections.join(", ")}${teacherData.stream && !isHigherGrade(teacherData.gradeName) ? ` (${teacherData.stream} stream only)` : " (All streams)"}`
                : "Students assigned to your classes"}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => router.push("/teacher/students")}>
            View All ({students.length})
          </Button>
        </CardHeader>
        <CardContent>
          {topStudents.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              {teacherData?.gradeId
                ? "No students found in your assigned sections."
                : "You are not assigned to any classes yet."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="w-[50px] text-gray-700">#</TableHead>
                  <TableHead className="text-gray-700">Student ID</TableHead>
                  <TableHead className="text-gray-700">Full Name</TableHead>
                  <TableHead className="text-gray-700">Grade</TableHead>
                  <TableHead className="text-gray-700">Section</TableHead>
                  <TableHead className="text-gray-700">Gender</TableHead>
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
                    <TableCell className="text-muted-foreground">
                      <Badge variant="outline" className="text-blue-600 border-blue-200">
                        {student.grades?.grade_name || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-indigo-600 border-indigo-200">
                        {student.section}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Badge variant={student.gender === "male" ? "default" : "secondary"}>{student.gender}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {exams.length > 0 && (
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl text-gray-900">Recent Exams</CardTitle>
              <CardDescription className="text-muted-foreground">Latest exams created for your classes</CardDescription>
            </div>
            <Button variant="outline" onClick={() => router.push("/teacher/exams")}>
              View All ({exams.length})
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="text-gray-700">Exam Code</TableHead>
                  <TableHead className="text-gray-700">Title</TableHead>
                  <TableHead className="text-gray-700">Date</TableHead>
                  <TableHead className="text-gray-700">Section</TableHead>
                  <TableHead className="text-gray-700">Total Marks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.slice(0, 5).map((exam) => (
                  <TableRow key={exam.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium text-gray-900">{exam.exam_code}</TableCell>
                    <TableCell className="text-gray-900">{exam.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(exam.exam_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        {exam.section}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{exam.total_marks}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
