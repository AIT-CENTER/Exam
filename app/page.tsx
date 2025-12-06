"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Loader2,
  ArrowRight,
  User,
  KeyRound,
  BookOpen,
  Clock,
  Shield,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  XCircle,
} from "lucide-react"

export default function StudentLogin() {
  const router = useRouter()
  const [studentId, setStudentId] = useState("")
  const [examId, setExamId] = useState("")
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({ studentId: "", examId: "" })
  
  // State for dialogs
  const [resumeSession, setResumeSession] = useState<any>(null)
  const [showResumeDialog, setShowResumeDialog] = useState(false)
  
  const [activeSessions, setActiveSessions] = useState<any[]>([])
  const [showActiveSessionDialog, setShowActiveSessionDialog] = useState(false)
  
  const [existingActiveSession, setExistingActiveSession] = useState<any>(null)
  const [showAlreadyInProgressModal, setShowAlreadyInProgressModal] = useState(false)
  
  const [studentIdFormat, setStudentIdFormat] = useState<{minLength: number, maxLength: number}>({
    minLength: 1,
    maxLength: 20
  })

  useEffect(() => {
    fetchStudentIdFormat()
  }, [])

  const fetchStudentIdFormat = async () => {
    try {
      const { data: config, error } = await supabase
        .from("id_configurations")
        .select("prefix, digits, separator")
        .single()

      if (error || !config) {
        console.log("Using default student ID format")
        return
      }

      const totalLength = config.prefix.length + config.digits + (config.separator === "none" ? 0 : config.separator.length)
      
      setStudentIdFormat({
        minLength: totalLength,
        maxLength: totalLength,
      })
    } catch (error) {
      console.error("Error fetching student ID format:", error)
    }
  }

  const validateForm = () => {
    const newErrors = { studentId: "", examId: "" }
    let isValid = true

    if (!studentId.trim()) {
      newErrors.studentId = "Student ID is required"
      isValid = false
    } else if (studentId.trim().length < studentIdFormat.minLength) {
      newErrors.studentId = `Student ID must be at least ${studentIdFormat.minLength} characters`
      isValid = false
    }

    if (!examId.trim()) {
      newErrors.examId = "Exam ID is required"
      isValid = false
    } else if (!/^\d{6}$/.test(examId)) {
      newErrors.examId = "Must be exactly 6 digits"
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  const handleStudentIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase()
    value = value.slice(0, studentIdFormat.maxLength)
    setStudentId(value)
    if (errors.studentId) setErrors(prev => ({ ...prev, studentId: "" }))
  }

  const handleExamIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6)
    setExamId(value)
    if (errors.examId) setErrors(prev => ({ ...prev, examId: "" }))
  }

  const validateExamAccess = async (studentId: string, examCode: string) => {
    const fullStudentId = studentId.trim().toUpperCase()

    // Check student exists
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, student_id, name, grade_id, section")
      .eq("student_id", fullStudentId)
      .single()

    if (studentError || !student) {
      throw new Error("Student not found. Please check your Student ID.")
    }

    // Check exam exists
    const { data: exam, error: examError } = await supabase
      .from("exams")
      .select("id, exam_code, title, grade_id, section, exam_active, duration, total_marks")
      .eq("exam_code", examCode)
      .single()

    if (examError || !exam) {
      throw new Error("Exam not found. Please check your Exam ID.")
    }

    if (!exam.exam_active) {
      throw new Error("This exam is not currently active.")
    }

    if (exam.grade_id !== student.grade_id) {
      throw new Error("This exam is not available for your grade level.")
    }

    if (exam.section && exam.section.trim() !== "") {
      const examSections = exam.section.split(",").map(s => s.trim().toUpperCase())
      const studentSection = student.section?.trim().toUpperCase()
      if (!studentSection || !examSections.includes(studentSection)) {
        throw new Error("This exam is not available for your section.")
      }
    }

    // Check assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from("assign_exams")
      .select("id, teacher_id")
      .eq("exam_id", exam.id)
      .eq("student_id", student.id)
      .single()

    if (assignmentError || !assignment) {
      throw new Error("This exam is not assigned to you.")
    }

    // Check if already taken
    const { data: existingResult } = await supabase
      .from("results")
      .select("id")
      .eq("exam_id", exam.id)
      .eq("student_id", student.id)
      .single()

    if (existingResult) {
      throw new Error("You have already taken this exam.")
    }

    // Check for existing session for THIS exam
    const { data: existingSession } = await supabase
      .from("exam_sessions")
      .select("id, student_id, exam_id, status, time_remaining, started_at")
      .eq("student_id", student.id)
      .eq("exam_id", exam.id)
      .eq("status", "in_progress")
      .maybeSingle()

    // Check for other active exam sessions (different exams)
    const { data: otherSessions } = await supabase
      .from("exam_sessions")
      .select(`
        id,
        started_at,
        time_remaining,
        status,
        exams!inner (
          id,
          title,
          exam_code
        )
      `)
      .eq("student_id", student.id)
      .eq("status", "in_progress")
      .neq("exam_id", exam.id)

    return {
      student,
      exam,
      assignment,
      existingSession: existingSession || null,
      hasActiveSession: !!existingSession,
      otherActiveSessions: otherSessions || [],
      hasOtherActiveSessions: (otherSessions?.length || 0) > 0,
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    try {
      const validationResult = await validateExamAccess(studentId, examId)

      // Check for other active sessions (different exams)
      if (validationResult.hasOtherActiveSessions) {
        setActiveSessions(validationResult.otherActiveSessions)
        setShowActiveSessionDialog(true)
        setLoading(false)
        return
      }

      // Check for active session for THIS exam
      if (validationResult.hasActiveSession) {
        setResumeSession(validationResult)
        setShowResumeDialog(true)
        setLoading(false)
        return
      }

      // Create new exam session
      const sessionData = await createNewExamSession(validationResult)
      
      toast.success("Login successful! Starting exam...")
      redirectToExam(sessionData, validationResult)
      
    } catch (error: any) {
      console.error("Login error:", error)
      const errorMsg = error.message || "Login failed"
      toast.error(errorMsg)
      
      if (errorMsg.includes("Student") || errorMsg.includes("student")) {
        setErrors(prev => ({ ...prev, studentId: errorMsg }))
      } else if (errorMsg.includes("Exam") || errorMsg.includes("exam")) {
        setErrors(prev => ({ ...prev, examId: errorMsg }))
      }
      
      setLoading(false)
    }
  }

  const createNewExamSession = async (validationResult: any) => {
    const { student, exam, assignment } = validationResult

    const { data: session, error: sessionError } = await supabase
      .from("exam_sessions")
      .insert({
        student_id: student.id,
        exam_id: exam.id,
        teacher_id: assignment.teacher_id,
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        time_remaining: exam.duration * 60,
        status: "in_progress",
      })
      .select()
      .single()

    if (sessionError) {
      if (sessionError.code === '23505') {
        throw new Error("You already have an active exam session.")
      }
      throw new Error("Failed to create exam session. Please try again.")
    }

    return session
  }

  const handleResumeSession = async () => {
    if (!resumeSession) return

    try {
      setLoading(true)
      toast.success("Resuming exam session...")
      redirectToExam(resumeSession.existingSession, resumeSession)
      
    } catch (error) {
      console.error("Error resuming session:", error)
      toast.error("Failed to resume session")
      setLoading(false)
    }
  }

  const redirectToExam = (session: any, validationResult: any) => {
    const { student, exam } = validationResult

    const examSession = {
      sessionId: session.id,
      studentId: student.id,
      studentNumber: student.student_id,
      studentName: student.name,
      studentSection: student.section,
      examId: exam.id,
      examCode: exam.exam_code,
      examTitle: exam.title,
      examTotalMarks: exam.total_marks,
      startTime: session.started_at,
      duration: exam.duration,
      timeRemaining: session.time_remaining || exam.duration * 60,
    }

    localStorage.setItem("examSession", JSON.stringify(examSession))

    const slug = exam.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
    
    router.push(`/start/${slug}?student=${student.student_id}&exam=${exam.exam_code}&session=${session.id}`)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    }) + ' ' + date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  // Simple ExamAlreadyInProgressModal
  function ExamAlreadyInProgressModal({ existingSession, onResume, onCancel }: { existingSession: any, onResume: () => void, onCancel: () => void }) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Exam Already in Progress</h2>
          <p className="text-gray-600 mb-6">
            You already have an active exam session. Would you like to resume your previous session?
          </p>
          <div className="space-y-3">
            <Button onClick={onResume} className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-3">
              Resume Previous Exam
            </Button>
            <Button onClick={onCancel} variant="outline" className="w-full text-lg py-3">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (showAlreadyInProgressModal) {
    return (
      <ExamAlreadyInProgressModal
        existingSession={existingActiveSession}
        onResume={() => {
          if (existingActiveSession) {
            const slug = existingActiveSession.exams?.title
              ?.toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)+/g, "") || "exam"
            
            router.push(`/start/${slug}?session=${existingActiveSession.id}`)
          }
        }}
        onCancel={() => {
          setShowAlreadyInProgressModal(false)
          router.push("/")
        }}
      />
    )
  }

  return (
    <>
      {/* Resume Exam Dialog */}
      <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Continue Exam?
            </DialogTitle>
            <DialogDescription>
              Found an existing exam session with time remaining.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Student</p>
                  <p className="font-medium">{resumeSession?.student.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <BookOpen className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Exam</p>
                  <p className="font-medium">{resumeSession?.exam.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time Remaining</p>
                  <p className="font-medium">
                    {resumeSession && formatTime(resumeSession.existingSession.time_remaining)}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowResumeDialog(false)
                  setResumeSession(null)
                  setLoading(false)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResumeSession}
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Continuing...
                  </>
                ) : (
                  "Continue Exam"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Exam Sessions Dialog */}
      <Dialog open={showActiveSessionDialog} onOpenChange={setShowActiveSessionDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Multiple Active Exams
            </DialogTitle>
            <DialogDescription>
              You cannot start a new exam while other exams are in progress.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm text-red-700 font-medium">One Exam at a Time</p>
                  <p className="text-sm text-red-600">
                    You must complete or end your current exam before starting a new one.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Your Active Exams:</p>
              {activeSessions.map((session, idx) => (
                <div key={session.id} className="border rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{session.exams?.title || "Unknown Exam"}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span>Code: {session.exams?.exam_code || "N/A"}</span>
                        <span>Started: {formatDateTime(session.started_at)}</span>
                        <span>Time: {formatTime(session.time_remaining)} left</span>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                      ACTIVE
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowActiveSessionDialog(false)
                  setActiveSessions([])
                  setLoading(false)
                }}
                className="flex-1"
              >
                Go Back
              </Button>
              <Button
                onClick={() => {
                  setShowActiveSessionDialog(false)
                  if (activeSessions.length > 0) {
                    const session = activeSessions[0]
                    const slug = session.exams?.title
                      ?.toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)+/g, "") || "exam"
                    
                    router.push(`/start/${slug}?session=${session.id}`)
                  }
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                Continue Active Exam
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Login Page */}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-100 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white mb-4 shadow-lg shadow-indigo-200">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Exam Portal</h1>
            <p className="text-gray-600">Enter your credentials to start the exam</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

            <div className="p-8">
              <form onSubmit={handleLogin} className="space-y-6">
                {/* Student ID */}
                <div className="space-y-2">
                  <Label htmlFor="studentId" className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      Student ID
                    </span>
                    <span className="text-xs text-gray-400">
                      {studentIdFormat.minLength === studentIdFormat.maxLength 
                        ? `${studentIdFormat.minLength} chars` 
                        : `${studentIdFormat.minLength}-${studentIdFormat.maxLength} chars`}
                    </span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="studentId"
                      value={studentId}
                      onChange={handleStudentIdChange}
                      placeholder="Enter student ID"
                      className={`h-12 pr-10 uppercase ${
                        errors.studentId
                          ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                          : studentId && !errors.studentId
                            ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100"
                            : "border-gray-200 focus:border-indigo-300 focus:ring-indigo-100"
                      }`}
                      maxLength={studentIdFormat.maxLength}
                    />
                    {studentId && !errors.studentId && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                    )}
                    {errors.studentId && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500" />
                    )}
                  </div>
                  {errors.studentId && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.studentId}
                    </p>
                  )}
                </div>

                {/* Exam ID */}
                <div className="space-y-2">
                  <Label htmlFor="examId" className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-gray-400" />
                      Exam Code
                    </span>
                    <span className="text-xs text-gray-400">6 digits</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="examId"
                      value={examId}
                      onChange={handleExamIdChange}
                      placeholder="Enter 6-digit exam code"
                      className={`h-12 pr-10 tracking-widest ${
                        errors.examId
                          ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                          : examId && !errors.examId
                            ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100"
                            : "border-gray-200 focus:border-indigo-300 focus:ring-indigo-100"
                      }`}
                      maxLength={6}
                    />
                    {examId && !errors.examId && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                    )}
                    {errors.examId && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500" />
                    )}
                  </div>
                  {errors.examId && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.examId}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      Start Exam
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>

          <div className="text-center mt-6 space-y-2">
            <p className="text-sm text-gray-500">Need help? Contact your teacher</p>
            <p className="text-sm text-gray-500">Developer By Alpha Institute Tech <a target="_blank" className="text-gray-900" href="">(AIT Tech Center)</a></p>
          </div>
        </div>
      </div>
    </>
  )
}
