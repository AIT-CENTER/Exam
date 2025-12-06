"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"

interface DashboardStats {
  totalStudents: number
  examsTaken: number
  totalExams: number
  totalDepartments: number
}

interface TopStudent {
  id: string
  name: string
  department: string
  avgScore: number
}

interface RecentExam {
  id: string
  examName: string
  department: string
  participants: number
  averageScore: number
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    examsTaken: 0,
    totalExams: 0,
    totalDepartments: 0,
  })
  const [topStudents, setTopStudents] = useState<TopStudent[]>([])
  const [recentExams, setRecentExams] = useState<RecentExam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      console.log("[v0] Fetching dashboard data...")

      // Fetch total students
      const { count: studentsCount, error: studentsError } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })

      if (studentsError) {
        console.error("[v0] Error fetching students count:", studentsError)
        throw studentsError
      }
      console.log("[v0] Students count:", studentsCount)

      const { count: sessionsCount, error: sessionsError } = await supabase
        .from("exam_sessions")
        .select("*", { count: "exact", head: true })
        .eq("status", "submitted")

      if (sessionsError) {
        console.error("[v0] Error fetching sessions count:", sessionsError)
        throw sessionsError
      }
      console.log("[v0] Completed sessions count:", sessionsCount)

      // Fetch total exams
      const { count: examsCount, error: examsError } = await supabase
        .from("exams")
        .select("*", { count: "exact", head: true })

      if (examsError) {
        console.error("[v0] Error fetching exams count:", examsError)
        throw examsError
      }
      console.log("[v0] Exams count:", examsCount)

      // Fetch total departments
      const { count: departmentsCount, error: departmentsError } = await supabase
        .from("departments")
        .select("*", { count: "exact", head: true })

      if (departmentsError) {
        console.error("[v0] Error fetching departments count:", departmentsError)
        throw departmentsError
      }
      console.log("[v0] Departments count:", departmentsCount)

      setStats({
        totalStudents: studentsCount || 0,
        examsTaken: sessionsCount || 0,
        totalExams: examsCount || 0,
        totalDepartments: departmentsCount || 0,
      })

      // Get department from exam instead
      const { data: topStudentsData, error: topStudentsError } = await supabase
        .from("exam_sessions")
        .select(
          `
          student_id,
          score,
          students!inner(id, name),
          exams!inner(id, name, departments!inner(name))
        `,
        )
        .eq("status", "submitted")
        .not("score", "is", null)

      if (topStudentsError) {
        console.error("[v0] Error fetching top students:", topStudentsError)
        throw topStudentsError
      }
      console.log("[v0] Top students data:", topStudentsData)

      // Calculate average scores per student
      const studentScores = new Map<string, { name: string; departments: Set<string>; scores: number[] }>()

      topStudentsData?.forEach((session: any) => {
        const studentId = session.student_id
        const studentName = session.students.name
        const departmentName = session.exams.departments.name
        const score = session.score

        if (!studentScores.has(studentId)) {
          studentScores.set(studentId, {
            name: studentName,
            departments: new Set(),
            scores: [],
          })
        }
        const studentData = studentScores.get(studentId)!
        studentData.departments.add(departmentName)
        studentData.scores.push(score)
      })

      const topStudentsArray = Array.from(studentScores.entries())
        .map(([id, data]) => ({
          id,
          name: data.name,
          department: Array.from(data.departments).join(", ") || "N/A",
          avgScore: Number((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1)),
        }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 4)

      setTopStudents(topStudentsArray)
      console.log("[v0] Top students processed:", topStudentsArray)

      const { data: recentExamsData, error: recentExamsError } = await supabase
        .from("exams")
        .select(
          `
          id,
          name,
          departments!inner(name),
          exam_sessions!inner(score, status)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(3)

      if (recentExamsError) {
        console.error("[v0] Error fetching recent exams:", recentExamsError)
        throw recentExamsError
      }
      console.log("[v0] Recent exams data:", recentExamsData)

      const recentExamsArray = recentExamsData?.map((exam: any) => {
        const completedSessions = exam.exam_sessions.filter((s: any) => s.status === "submitted" && s.score !== null)
        const avgScore =
          completedSessions.length > 0
            ? Number(
                (
                  completedSessions.reduce((sum: number, s: any) => sum + s.score, 0) / completedSessions.length
                ).toFixed(1),
              )
            : 0

        return {
          id: exam.id,
          examName: exam.name,
          department: exam.departments.name,
          participants: completedSessions.length,
          averageScore: avgScore,
        }
      })

      setRecentExams(recentExamsArray || [])
      console.log("[v0] Recent exams processed:", recentExamsArray)

      console.log("[v0] Dashboard data fetched successfully")
    } catch (err: any) {
      console.error("[v0] Error fetching dashboard data:", err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return { stats, topStudents, recentExams, loading, error, refetch: fetchDashboardData }
}
