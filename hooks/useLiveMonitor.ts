"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { useToast } from "@/hooks/use-toast"

export interface LiveStudent {
  sessionId: string
  studentId: string
  name: string
  examId: string
  examName: string
  status: string
  remainingTime: number
  score: number
  startedAt: string
  examDurationMinutes: number
  extraTimeSeconds: number
  timeRemainingSeconds: number
  riskScore: number
  riskCount: number
  maxRiskBeforeSubmit: number
  lastActivityAt: string | null
  /** Derived: true if riskCount > 0 or riskScore > 0 or disconnect */
  isFlagged: boolean
}

export interface RiskLogEntry {
  id: string
  session_id: string
  student_id: number
  exam_id: number
  event_type: string
  timestamp: string
}

export function useLiveMonitor(teacherId?: string | null) {
  const [students, setStudents] = useState<LiveStudent[]>([])
  const [riskLogs, setRiskLogs] = useState<RiskLogEntry[]>([])
  const [maxTimeExtensionMinutes, setMaxTimeExtensionMinutes] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchLiveData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (teacherId) params.set("teacherId", teacherId)
      const res = await fetch(`/api/teacher/fetch-live-monitor?${params}`)
      if (!res.ok) throw new Error("Fetch failed")
      const { sessions, riskLogs: logs, maxTimeExtensionMinutes: maxMin } = await res.json()

      setStudents(sessions ?? [])
      setRiskLogs(logs ?? [])
      setMaxTimeExtensionMinutes(maxMin != null ? Math.max(1, Number(maxMin)) : 30)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      console.error("[useLiveMonitor] Error:", errorMessage)
      setError("Failed to load exam data")
      setStudents([])
      setRiskLogs([])
      toast.error("Failed to load exam data")
    } finally {
      setLoading(false)
    }
  }, [toast, teacherId])

  useEffect(() => {
    fetchLiveData()
    const interval = setInterval(fetchLiveData, 5000)
    return () => clearInterval(interval)
  }, [fetchLiveData, teacherId])

  const addTimeToStudent = useCallback(
    async (sessionId: string, minutes: number) => {
      const res = await fetch("/api/teacher/add-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, minutes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Add time failed")
      await fetchLiveData()
      return { addedMinutes: data.addedMinutes, totalExtraMinutes: data.totalExtraMinutes }
    },
    [fetchLiveData]
  )

  const removeStudentFromMonitor = useCallback(
    async (sessionId: string) => {
      try {
        const res = await fetch("/api/teacher/remove-student", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Remove failed")
        await fetchLiveData()
        return true
      } catch (err) {
        console.error("[useLiveMonitor] Error removing student:", err)
        throw err
      }
    },
    [fetchLiveData]
  )

  const removeRiskFromStudent = useCallback(
    async (sessionId: string) => {
      try {
        const res = await fetch("/api/teacher/remove-risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Remove risk failed")
        await fetchLiveData()
        return true
      } catch (err) {
        console.error("[useLiveMonitor] Error removing risk:", err)
        throw err
      }
    },
    [fetchLiveData]
  )

  const addTimeToAll = useCallback(
    async (minutes: number) => {
      try {
        const activeSessions = students.filter((s) => s.status === "Active" || s.status === "Disconnected")
        for (const s of activeSessions) {
          try {
            await fetch("/api/teacher/add-time", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: s.sessionId, minutes }),
            })
          } catch { /* skip failed */ }
        }
        await fetchLiveData()
        return true
      } catch (err) {
        console.error("[useLiveMonitor] Error adding time to all:", err)
        throw err
      }
    },
    [fetchLiveData, students]
  )

  const forceSubmitExam = useCallback(
    async (sessionId: string) => {
      try {
        console.log("[v2.5] Force submitting exam:", sessionId)

        const { data: session, error: sessionError } = await supabase
          .from("exam_sessions")
          .select("exam_id, student_id, teacher_id, status, started_at, extra_time_seconds")
          .eq("id", sessionId)
          .single()

        if (sessionError) throw new Error(`Fetch session error: ${sessionError.message}`)
        if (session.status !== "in_progress") throw new Error("Cannot submit a completed exam")

        const { data: answers, error: answersError } = await supabase
          .from("student_answers")
          .select("question_id, selected_option_id, answer_text")
          .eq("session_id", sessionId)

        if (answersError) throw new Error(`Fetch answers error: ${answersError.message}`)

        const { data: questions, error: qError } = await supabase
          .from("questions")
          .select("id, marks, correct_option_id, question_type")
          .eq("exam_id", session.exam_id)

        if (qError) throw new Error(`Fetch questions error: ${qError.message}`)

        const qMap = new Map((questions || []).map((q) => [q.id, q]))
        let totalMarks = 0
        ;(answers || []).forEach((a: any) => {
          const q = qMap.get(a.question_id)
          if (!q) return
          const correct = q.correct_option_id != null && a.selected_option_id === q.correct_option_id
          if (correct) totalMarks += q.marks || 1
        })

        const { error: updateError } = await supabase
          .from("exam_sessions")
          .update({
            status: "submitted",
            score: totalMarks,
            submitted_at: new Date().toISOString(),
          })
          .eq("id", sessionId)

        if (updateError) throw new Error(`Update session error: ${updateError.message}`)

        await supabase.from("session_security").update({ is_active: false }).eq("session_id", sessionId)

        await supabase.from("results").upsert(
          {
            exam_id: session.exam_id,
            student_id: session.student_id,
            teacher_id: session.teacher_id,
            total_marks_obtained: totalMarks,
            comments: "Force-submitted by teacher.",
            submission_time: new Date().toISOString(),
          },
          { onConflict: "exam_id,student_id" }
        )

        console.log("[v2.5] Exam force submitted successfully:", { sessionId, totalMarks })
        await fetchLiveData()
        return true
      } catch (err) {
        console.error("[v2.5] Error force submitting exam:", err)
        throw err
      }
    },
    [fetchLiveData, supabase]
  )

  return {
    students,
    riskLogs,
    maxTimeExtensionMinutes,
    loading,
    error,
    addTimeToStudent,
    addTimeToAll,
    removeRiskFromStudent,
    removeStudentFromMonitor,
    forceSubmitExam,
    fetchLiveData,
  }
}