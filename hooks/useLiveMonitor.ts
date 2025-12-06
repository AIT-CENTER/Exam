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
}

export function useLiveMonitor() {
  const [students, setStudents] = useState<LiveStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const subscriptionRef = useRef<any>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchLiveData = useCallback(async () => {
    try {
      console.log("[v2.5] Fetching live exam data...")

      const { data: sessions, error: sessionsError } = await supabase
        .from("exam_sessions")
        .select(
          `
          id,
          student_id,
          exam_id,
          status,
          started_at,
          extra_time_seconds,
          score,
          time_remaining_seconds,
          students (name, student_id),
          exams (name, duration_minutes)
        `
        )
        .in("status", ["in_progress", "submitted", "expired"])

      if (sessionsError) {
        const errorMessage = sessionsError?.message || JSON.stringify(sessionsError) || "Unknown error"
        console.error("[v2.5] Supabase error details:", {
          message: errorMessage,
          code: (sessionsError as any)?.code,
          details: (sessionsError as any)?.details,
        })
        throw new Error(`Sessions fetch error: ${errorMessage}`)
      }

      if (!sessions || sessions.length === 0) {
        console.log("[v2.5] No sessions found")
        setStudents([])
        setError(null)
        setLoading(false)
        return
      }

      console.log("[v2.5] Fetched sessions:", sessions.length)

      const now = Date.now()

      const liveStudents: LiveStudent[] = sessions.map((session: any) => {
        let status = session.status === "in_progress" ? "In Progress" : session.status === "submitted" ? "Submitted" : "Time Expired"

        const startedAt = session.started_at ? new Date(session.started_at).toISOString() : new Date(now).toISOString()
        const exam = session.exams || { name: "Unknown Exam", duration_minutes: 0 }
        const totalMs = ((exam.duration_minutes * 60) + (session.extra_time_seconds || 0)) * 1000
        const elapsedMs = now - new Date(startedAt).getTime()
        let remainingTime = Math.floor((totalMs - elapsedMs) / 1000)
        if (remainingTime < 0) remainingTime = 0

        return {
          sessionId: session.id,
          studentId: session.students?.student_id || "Unknown",
          name: session.students?.name || "Unknown",
          examId: session.exam_id,
          examName: exam.name,
          status,
          remainingTime,
          score: session.score || 0,
          startedAt,
          examDurationMinutes: exam.duration_minutes || 0,
          extraTimeSeconds: session.extra_time_seconds || 0,
          timeRemainingSeconds: session.time_remaining_seconds || 0,
        }
      })

      setStudents(liveStudents)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      console.error("[v2.5] Error fetching live data:", errorMessage)
      setError("Failed to load exam data")
      setStudents([])
      toast.error("Failed to load exam data")
    } finally {
      setLoading(false)
    }
  }, [supabase, toast])

  useEffect(() => {
    fetchLiveData()

    const channel = supabase
      .channel("exam_sessions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "exam_sessions",
        },
        (payload) => {
          console.log("[v2.5] Real-time update received:", payload)
          fetchLiveData()
        }
      )
      .subscribe((status) => {
        console.log("[v2.5] Subscription status:", status)
      })

    subscriptionRef.current = channel

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
    }
  }, [fetchLiveData, supabase])

  const addTimeToStudent = useCallback(
    async (sessionId: string, minutes: number) => {
      try {
        console.log("[v2.5] Adding time to student:", sessionId, minutes)
        const seconds = minutes * 60

        const { data: session, error: sessionError } = await supabase
          .from("exam_sessions")
          .select("extra_time_seconds, status")
          .eq("id", sessionId)
          .single()

        if (sessionError) throw new Error(`Fetch session error: ${sessionError.message}`)
        if (session.status !== "in_progress") throw new Error("Cannot add time to a completed exam")

        const newExtraTime = (session.extra_time_seconds || 0) + seconds

        const { error: updateError } = await supabase
          .from("exam_sessions")
          .update({ extra_time_seconds: newExtraTime })
          .eq("id", sessionId)

        if (updateError) throw new Error(`Update session error: ${updateError.message}`)

        console.log("[v2.5] Time added successfully:", { sessionId, extraTime: newExtraTime })
        await fetchLiveData()
        return true
      } catch (err) {
        console.error("[v2.5] Error adding time:", err)
        throw err
      }
    },
    [fetchLiveData, supabase]
  )

  const addTimeToAll = useCallback(
    async (minutes: number) => {
      try {
        console.log("[v2.5] Adding time to all students:", minutes)
        const seconds = minutes * 60

        const { data: sessions, error: sessionsError } = await supabase
          .from("exam_sessions")
          .select("id, extra_time_seconds, status")
          .eq("status", "in_progress")

        if (sessionsError) throw new Error(`Fetch sessions error: ${sessionsError.message}`)

        if (!sessions || sessions.length === 0) {
          throw new Error("No active sessions found")
        }

        const updates = sessions.map((session) => ({
          id: session.id,
          extra_time_seconds: (session.extra_time_seconds || 0) + seconds,
          status: session.status,
        }))

        const { error: updateError } = await supabase
          .from("exam_sessions")
          .upsert(updates, { onConflict: "id" })

        if (updateError) throw new Error(`Update sessions error: ${updateError.message}`)

        console.log("[v2.5] Time added to all successfully:", updates.length)
        await fetchLiveData()
        return true
      } catch (err) {
        console.error("[v2.5] Error adding time to all:", err)
        throw err
      }
    },
    [fetchLiveData, supabase]
  )

  const forceSubmitExam = useCallback(
    async (sessionId: string) => {
      try {
        console.log("[v2.5] Force submitting exam:", sessionId)

        const { data: session, error: sessionError } = await supabase
          .from("exam_sessions")
          .select("exam_id, status, started_at, extra_time_seconds, time_remaining_seconds")
          .eq("id", sessionId)
          .single()

        if (sessionError) throw new Error(`Fetch session error: ${sessionError.message}`)
        if (session.status !== "in_progress") throw new Error("Cannot submit a completed exam")

        const { data: answers, error: answersError } = await supabase
          .from("student_answers")
          .select(`
            selected_option_id,
            question_id,
            options!student_answers_selected_option_id_fkey (is_correct)
          `)
          .eq("session_id", sessionId)

        if (answersError) throw new Error(`Fetch answers error: ${answersError.message}`)

        const { count: questionCount, error: questionCountError } = await supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("exam_id", session.exam_id)

        if (questionCountError) throw new Error(`Fetch question count error: ${questionCountError.message}`)

        const totalQuestions = questionCount || 0
        const correctCount = answers?.filter((a: any) => a.selected_option_id && a.options?.is_correct).length || 0
        const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0

        // Calculate remaining time at submission
        const now = Date.now()
        const startedAt = new Date(session.started_at).getTime()
        const totalMs = ((session.exam_duration_minutes * 60) + (session.extra_time_seconds || 0)) * 1000
        const elapsedMs = now - startedAt
        const timeRemainingSeconds = Math.floor((totalMs - elapsedMs) / 1000)

        const { error: updateError } = await supabase
          .from("exam_sessions")
          .update({
            status: "submitted",
            score,
            submitted_at: new Date().toISOString(),
            time_remaining_seconds: timeRemainingSeconds >= 0 ? timeRemainingSeconds : 0,
          })
          .eq("id", sessionId)

        if (updateError) throw new Error(`Update session error: ${updateError.message}`)

        console.log("[v2.5] Exam force submitted successfully:", { sessionId, score })
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
    loading,
    error,
    addTimeToStudent,
    addTimeToAll,
    forceSubmitExam,
    fetchLiveData,
  }
}