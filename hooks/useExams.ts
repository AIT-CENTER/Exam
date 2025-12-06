"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import type { ExamWithDetails, Student, StudentResult } from "@/types/exam"
import { toast } from "sonner"

export function useExams() {
  const [exams, setExams] = useState<ExamWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchExams = async () => {
    try {
      setLoading(true)
      console.log("[v0] Fetching exams from database...")

      const { data: examsData, error: examsError } = await supabase
        .from("exams")
        .select(`
          *,
          departments (
            name
          )
        `)
        .order("created_at", { ascending: false })

      if (examsError) {
        console.error("[v0] Error fetching exams:", examsError)
        throw examsError
      }

      console.log("[v0] Fetched exams:", examsData)

      const examsWithDetails = await Promise.all(
        (examsData || []).map(async (exam) => {
          // Get assigned students count from exam_sessions
          const { count: assignedCount, error: sessionsError } = await supabase
            .from("exam_sessions")
            .select("*", { count: "exact", head: true })
            .eq("exam_id", exam.id)

          if (sessionsError) {
            console.error("[v0] Error fetching sessions:", sessionsError)
          }

          // Get passed/failed counts from exam_sessions using score and passing_score
          const { data: sessionsData, error: resultsError } = await supabase
            .from("exam_sessions")
            .select("score, status")
            .eq("exam_id", exam.id)
            .eq("status", "submitted")

          if (resultsError) {
            console.error("[v0] Error fetching session results:", resultsError)
          }

          // Calculate passed/failed based on passing_score
          const passedCount = sessionsData?.filter((s) => s.score && s.score >= (exam.passing_score || 50)).length || 0
          const failedCount = sessionsData?.filter((s) => s.score && s.score < (exam.passing_score || 50)).length || 0

          return {
            ...exam,
            department_name: exam.departments?.name || "Unknown",
            assigned_count: assignedCount || 0,
            passed_count: passedCount,
            failed_count: failedCount,
          }
        }),
      )

      setExams(examsWithDetails)
      setError(null)
    } catch (err) {
      console.error("[v0] Error in fetchExams:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch exams")
      toast.error("Failed to load exams")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExams()
  }, [])

  const deleteExam = async (examId: string) => {
    try {
      console.log("[v0] Deleting exam:", examId)

      // Cascade delete will handle exam_sessions and related records
      const { error } = await supabase.from("exams").delete().eq("id", examId)

      if (error) throw error

      setExams(exams.filter((e) => e.id !== examId))
      toast.success("Exam deleted successfully")
    } catch (err) {
      console.error("[v0] Error deleting exam:", err)
      toast.error("Failed to delete exam")
    }
  }

  const toggleExamStatus = async (examId: string, isActive: boolean) => {
    try {
      console.log("[v0] Toggling exam status:", examId, isActive)

      const { error } = await supabase.from("exams").update({ is_active: isActive }).eq("id", examId)

      if (error) throw error

      setExams(exams.map((e) => (e.id === examId ? { ...e, is_active: isActive } : e)))
      toast.success("Exam status updated")
    } catch (err) {
      console.error("[v0] Error toggling exam status:", err)
      toast.error("Failed to update exam status")
    }
  }

  return {
    exams,
    loading,
    error,
    refetch: fetchExams,
    deleteExam,
    toggleExamStatus,
  }
}

export function useExamStudents(examId: string | null) {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!examId) return

    const fetchStudents = async () => {
      try {
        setLoading(true)
        console.log("[v0] Fetching students for exam:", examId)

        const { data: sessionsData, error: sessionsError } = await supabase
          .from("exam_sessions")
          .select(`
            id,
            status,
            score,
            students (
              id,
              student_id,
              name,
              phone,
              age,
              gender
            ),
            exams (
              passing_score
            )
          `)
          .eq("exam_id", examId)

        if (sessionsError) throw sessionsError

        const formattedStudents = (sessionsData || []).map((session: any) => ({
          id: session.students?.id,
          student_id: session.students?.student_id,
          name: session.students?.name,
          phone: session.students?.phone,
          age: session.students?.age,
          gender: session.students?.gender,
          status: session.status,
          score: session.score || 0,
          passed: session.status === "submitted" && (session.score || 0) >= (session.exams?.passing_score || 50),
        }))

        setStudents(formattedStudents)
      } catch (err) {
        console.error("[v0] Error fetching students:", err)
        toast.error("Failed to load students")
      } finally {
        setLoading(false)
      }
    }

    fetchStudents()
  }, [examId])

  return { students, loading }
}

export function useExamResults(examId: string | null) {
  const [results, setResults] = useState<StudentResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!examId) return

    const fetchResults = async () => {
      try {
        setLoading(true)
        console.log("[v0] Fetching results for exam:", examId)

        // First get the exam's passing score
        const { data: examData, error: examError } = await supabase
          .from("exams")
          .select("passing_score")
          .eq("id", examId)
          .single()

        if (examError) throw examError

        const passingScore = examData?.passing_score || 50

        // Get results from exam_sessions with student details
        const { data: sessionsData, error: sessionsError } = await supabase
          .from("exam_sessions")
          .select(`
            student_id,
            score,
            students (
              student_id,
              name
            )
          `)
          .eq("exam_id", examId)
          .eq("status", "submitted")

        if (sessionsError) throw sessionsError

        const formattedResults: StudentResult[] = (sessionsData || []).map((s) => ({
          student_id: s.students?.student_id || "Unknown",
          name: s.students?.name || "Unknown",
          score: s.score || 0,
          status: (s.score || 0) >= passingScore ? "Passed" : "Failed",
        }))

        console.log("[v0] Formatted results:", formattedResults)
        setResults(formattedResults)
      } catch (err) {
        console.error("[v0] Error fetching results:", err)
        toast.error("Failed to load results")
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [examId])

  return { results, loading }
}

export function useAllStudents() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true)
        console.log("[v0] Fetching all students...")

        const { data: studentsData, error: studentsError } = await supabase
          .from("students")
          .select("*")
          .order("name", { ascending: true })

        if (studentsError) throw studentsError

        setStudents(studentsData || [])
      } catch (err) {
        console.error("[v0] Error fetching students:", err)
        toast.error("Failed to load students")
      } finally {
        setLoading(false)
      }
    }

    fetchStudents()
  }, [])

  return { students, loading, refetch: () => {} }
}
