"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  XCircle,
  Eye,
  EyeOff,
  Lock,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  Calendar,
  Target,
  Users,
  Award,
  ChevronRight,
} from "lucide-react";

export default function StudentLogin() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [examId, setExamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ studentId: "", examId: "" });

  // State for dialogs
  const [resumeSession, setResumeSession] = useState<any>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);

  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [showActiveSessionDialog, setShowActiveSessionDialog] = useState(false);

  const [studentIdFormat, setStudentIdFormat] = useState<{
    minLength: number;
    maxLength: number;
  }>({
    minLength: 1,
    maxLength: 20,
  });

  // State for visibility
  const [showStudentId, setShowStudentId] = useState(false);
  const [showExamId, setShowExamId] = useState(false);

  // Refs for inputs
  const studentInputRef = useRef<HTMLInputElement>(null);
  const examInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStudentIdFormat();
  }, []);

  useEffect(() => {
    if (studentInputRef.current) {
      studentInputRef.current.type = showStudentId ? "text" : "password";
    }
  }, [showStudentId]);

  useEffect(() => {
    if (examInputRef.current) {
      examInputRef.current.type = showExamId ? "text" : "password";
    }
  }, [showExamId]);

  const fetchStudentIdFormat = async () => {
    try {
      const { data: config } = await supabase
        .from("id_configurations")
        .select("prefix, digits, separator")
        .single();

      if (config) {
        const totalLength =
          config.prefix.length +
          config.digits +
          (config.separator === "none" ? 0 : config.separator.length);
        setStudentIdFormat({
          minLength: totalLength,
          maxLength: totalLength,
        });
      }
    } catch (error) {
      console.log("Using default student ID format");
    }
  };

  const validateForm = () => {
    const newErrors = { studentId: "", examId: "" };
    let isValid = true;

    if (!studentId.trim()) {
      newErrors.studentId = "Student ID is required";
      isValid = false;
    } else if (studentId.trim().length < studentIdFormat.minLength) {
      newErrors.studentId = `Student ID must be at least ${studentIdFormat.minLength} characters`;
      isValid = false;
    }

    if (!examId.trim()) {
      newErrors.examId = "Exam ID is required";
      isValid = false;
    } else if (!/^\d{6}$/.test(examId)) {
      newErrors.examId = "Must be exactly 6 digits";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleStudentIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.toUpperCase();
    value = value.slice(0, studentIdFormat.maxLength);
    setStudentId(value);
    if (errors.studentId) setErrors((prev) => ({ ...prev, studentId: "" }));
  };

  const handleExamIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/\D/g, "");
    value = value.slice(0, 6);
    setExamId(value);
    if (errors.examId) setErrors((prev) => ({ ...prev, examId: "" }));
  };

  const handleStudentIdFocus = () => {
    if (studentId && !showStudentId) {
      setShowStudentId(true);
    }
  };

  const handleExamIdFocus = () => {
    if (examId && !showExamId) {
      setShowExamId(true);
    }
  };

  const toggleStudentIdVisibility = () => {
    setShowStudentId((prev) => !prev);
  };

  const toggleExamIdVisibility = () => {
    setShowExamId((prev) => !prev);
  };

  const validateExamAccess = async (studentId: string, examCode: string) => {
    const fullStudentId = studentId.trim().toUpperCase();

    // Check student exists
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, student_id, name, grade_id, section")
      .eq("student_id", fullStudentId)
      .single();

    if (studentError || !student) {
      throw new Error("Student not found. Please check your Student ID.");
    }

    // Check exam exists
    const { data: exam, error: examError } = await supabase
      .from("exams")
      .select(
        "id, exam_code, title, grade_id, section, exam_active, duration, total_marks"
      )
      .eq("exam_code", examCode)
      .single();

    if (examError || !exam) {
      throw new Error("Exam not found. Please check your Exam ID.");
    }

    if (!exam.exam_active) {
      throw new Error("This exam is not currently active.");
    }

    if (exam.grade_id !== student.grade_id) {
      throw new Error("This exam is not available for your grade level.");
    }

    if (exam.section && exam.section.trim() !== "") {
      const examSections = exam.section
        .split(",")
        .map((s) => s.trim().toUpperCase());
      const studentSection = student.section?.trim().toUpperCase();
      if (!studentSection || !examSections.includes(studentSection)) {
        throw new Error("This exam is not available for your section.");
      }
    }

    // Check assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from("assign_exams")
      .select("id, teacher_id")
      .eq("exam_id", exam.id)
      .eq("student_id", student.id)
      .single();

    if (assignmentError || !assignment) {
      throw new Error("This exam is not assigned to you.");
    }

    // Check if already taken
    const { data: existingResult } = await supabase
      .from("results")
      .select("id")
      .eq("exam_id", exam.id)
      .eq("student_id", student.id)
      .single();

    if (existingResult) {
      throw new Error("You have already taken this exam.");
    }

    // Check for existing session for THIS exam
    const { data: existingSession } = await supabase
      .from("exam_sessions")
      .select("id, student_id, exam_id, status, time_remaining, started_at")
      .eq("student_id", student.id)
      .eq("exam_id", exam.id)
      .eq("status", "in_progress")
      .maybeSingle();

    // Check for other active exam sessions (different exams)
    const { data: otherSessions } = await supabase
      .from("exam_sessions")
      .select(
        `
        id,
        started_at,
        time_remaining,
        status,
        exams!inner (
          id,
          title,
          exam_code
        )
      `
      )
      .eq("student_id", student.id)
      .eq("status", "in_progress")
      .neq("exam_id", exam.id);

    return {
      student,
      exam,
      assignment,
      existingSession: existingSession || null,
      hasActiveSession: !!existingSession,
      otherActiveSessions: otherSessions || [],
      hasOtherActiveSessions: (otherSessions?.length || 0) > 0,
    };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const validationResult = await validateExamAccess(studentId, examId);

      if (validationResult.hasOtherActiveSessions) {
        setActiveSessions(validationResult.otherActiveSessions);
        setShowActiveSessionDialog(true);
        setLoading(false);
        return;
      }

      if (validationResult.hasActiveSession) {
        setResumeSession(validationResult);
        setShowResumeDialog(true);
        setLoading(false);
        return;
      }

      const sessionData = await createNewExamSession(validationResult);

      toast.success("Login successful! Starting exam...");
      redirectToExam(sessionData, validationResult);
    } catch (error: any) {
      console.error("Login error:", error);
      const errorMsg = error.message || "Login failed";
      toast.error(errorMsg);

      if (errorMsg.includes("Student") || errorMsg.includes("student")) {
        setErrors((prev) => ({ ...prev, studentId: errorMsg }));
      } else if (errorMsg.includes("Exam") || errorMsg.includes("exam")) {
        setErrors((prev) => ({ ...prev, examId: errorMsg }));
      }

      setLoading(false);
    }
  };

  const createNewExamSession = async (validationResult: any) => {
    const { student, exam, assignment } = validationResult;

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
      .single();

    if (sessionError) {
      if (sessionError.code === "23505") {
        throw new Error("You already have an active exam session.");
      }
      throw new Error("Failed to create exam session. Please try again.");
    }

    return session;
  };

  const handleResumeSession = async () => {
    if (!resumeSession) return;

    try {
      setLoading(true);
      toast.success("Resuming exam session...");
      redirectToExam(resumeSession.existingSession, resumeSession);
    } catch (error) {
      console.error("Error resuming session:", error);
      toast.error("Failed to resume session");
      setLoading(false);
    }
  };

  const redirectToExam = (session: any, validationResult: any) => {
    const { student, exam } = validationResult;

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
    };

    localStorage.setItem("examSession", JSON.stringify(examSession));

    const slug = exam.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    router.push(
      `/start/${slug}?student=${student.student_id}&exam=${exam.exam_code}&session=${session.id}`
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return (
      date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }) +
      " " +
      date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    );
  };

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
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Student</p>
                  <p className="font-medium">{resumeSession?.student.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <BookOpen className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Exam</p>
                  <p className="font-medium">{resumeSession?.exam.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Time Remaining</p>
                  <p className="font-medium">
                    {resumeSession &&
                      formatTime(resumeSession.existingSession.time_remaining)}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowResumeDialog(false);
                  setResumeSession(null);
                  setLoading(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResumeSession}
                className="bg-blue-600 hover:bg-blue-700"
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
      <Dialog
        open={showActiveSessionDialog}
        onOpenChange={setShowActiveSessionDialog}
      >
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
                  <p className="text-sm text-red-700 font-medium">
                    One Exam at a Time
                  </p>
                  <p className="text-sm text-red-600">
                    You must complete or end your current exam before starting a
                    new one.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Your Active Exams:</p>
              {activeSessions.map((session, idx) => (
                <div
                  key={session.id}
                  className="border rounded-lg p-3 bg-white"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {session.exams?.title || "Unknown Exam"}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span>Code: {session.exams?.exam_code || "N/A"}</span>
                        <span>
                          Started: {formatDateTime(session.started_at)}
                        </span>
                        <span>
                          Time: {formatTime(session.time_remaining)} left
                        </span>
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
                  setShowActiveSessionDialog(false);
                  setActiveSessions([]);
                  setLoading(false);
                }}
                className="flex-1"
              >
                Go Back
              </Button>
              <Button
                onClick={() => {
                  setShowActiveSessionDialog(false);
                  if (activeSessions.length > 0) {
                    const session = activeSessions[0];
                    const slug =
                      session.exams?.title
                        ?.toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/(^-|-$)+/g, "") || "exam";

                    router.push(`/start/${slug}?session=${session.id}`);
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

      {/* Main Login Page - Professional Split Screen */}
      <div className="min-h-screen flex">
        {/* Left Side – Brand / Info Section */}
        <div
          className="
    hidden lg:flex lg:w-1/2
    bg-gradient-to-br from-gray-50 via-slate-100 to-sky-200
    shadow-xl backdrop-blur-sm bg-white/90 shadow-lg rounded-2xl
    p-12 flex-col justify-between
    text-slate-700
  "
        >
          {/* Top Content */}
          <div>
            {/* Logo / Brand Area */}
            <div className="flex items-center gap-4 mb-10">
              <div className="relative">
                <div
                  className="w-16 h-16 p-3 rounded-2xl bg-white/60 backdrop-blur-md shadow-md ring-1 ring-black/5 flex items-center justify-center overflow-hidden"
                >
                  <img src="/icons/icon-192.png" alt="ExamFlow Logo" className="w-full h-full object-cover scale-125" />
                </div>

                {/* Soft Glow */}
                <div className="absolute -inset-1 rounded-2xl bg-blue-500/10 blur-xl -z-10" />
              </div>

              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                  ALPHA
                </h1>
                <p className="text-slate-600 text-sm mt-1">
                  Professional Assessment Platform
                </p>
              </div>
            </div>

            {/* Motivation Message */}
            <p className="text-slate-700 text-base leading-relaxed max-w-md">
              “Success comes from preparation, focus, and confidence. Approach
              your exam calmly — every question is an opportunity to show what
              you know.”
            </p>

            {/* Supporting Information */}
            <p className="mt-5 text-slate-600 text-sm leading-relaxed max-w-md">
              This secure online examination system is designed to ensure
              fairness, accuracy, and a smooth experience for every student.
              Your progress is saved automatically to keep your work safe.
            </p>
          </div>

          {/* Bottom Motivation / Footer */}
          <div className="text-slate-500 text-sm">
            <p>Stay calm. Stay focused. Do your best.</p>
            <p className="mt-1">© 2026 ALPHA COLLEGE. All rights reserved.</p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center gap-3 mb-10">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl text-white">
                <GraduationCap className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">ALPHA</h1>
                <p className="text-gray-500 text-sm">
                  Professional Assessment Platform
                </p>
              </div>
            </div>

            {/* Login Header */}
            <div className="mb-10">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                Welcome Back
              </h2>
              <p className="text-gray-600">
                Enter your credentials to access your examination
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-8">
              {/* Student ID Input */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="studentId"
                    className="text-sm font-medium text-gray-700"
                  >
                    Student ID
                  </Label>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Required
                  </span>
                </div>

                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <User className="h-5 w-5" />
                  </div>

                  <Input
                    ref={studentInputRef}
                    id="studentId"
                    value={studentId}
                    onChange={handleStudentIdChange}
                    onFocus={handleStudentIdFocus}
                    placeholder="XXXXXX"
                    type="password"
                    className={`
                      h-12 pl-10 pr-12 
                      text-base
                      border-2
                      ${
                        errors.studentId
                          ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                          : studentId
                          ? "border-green-300 focus:border-green-500 focus:ring-green-100"
                          : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                      }
                      focus:ring-2
                      transition-all duration-200
                    `}
                    maxLength={studentIdFormat.maxLength}
                    disabled={loading}
                  />

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {studentId && !errors.studentId && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    <button
                      type="button"
                      className="p-1 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
                      onClick={toggleStudentIdVisibility}
                      disabled={!studentId || loading}
                    >
                      {showStudentId ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="min-h-[20px]">
                  {errors.studentId ? (
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {errors.studentId}
                    </p>
                  ) : studentId ? (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                        Valid student ID
                      </p>
                      <span className="text-xs text-gray-500">
                        {studentId.length}/{studentIdFormat.maxLength}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Enter your official student identification
                    </p>
                  )}
                </div>
              </div>

              {/* Exam ID Input */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="examId"
                    className="text-sm font-medium text-gray-700"
                  >
                    Exam Code
                  </Label>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    6 digits
                  </span>
                </div>

                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <KeyRound className="h-5 w-5" />
                  </div>

                  <Input
                    ref={examInputRef}
                    id="examId"
                    value={examId}
                    onChange={handleExamIdChange}
                    onFocus={handleExamIdFocus}
                    placeholder="XXXXXX"
                    type="password"
                    className={`
                      h-12 pl-10 pr-12 
                      text-base tracking-widest
                      border-2
                      ${
                        errors.examId
                          ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                          : examId
                          ? "border-green-300 focus:border-green-500 focus:ring-green-100"
                          : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                      }
                      focus:ring-2
                      transition-all duration-200
                    `}
                    maxLength={6}
                    disabled={loading}
                  />

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {examId && examId.length === 6 && !errors.examId && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    <button
                      type="button"
                      className="p-1 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
                      onClick={toggleExamIdVisibility}
                      disabled={!examId || loading}
                    >
                      {showExamId ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="min-h-[20px]">
                  {errors.examId ? (
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {errors.examId}
                    </p>
                  ) : examId ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {examId.length === 6 ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600">
                              Valid exam code
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-amber-600">
                            {6 - examId.length} digit(s) remaining
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              i < examId.length
                                ? examId.length === 6
                                  ? "bg-green-500"
                                  : "bg-blue-500"
                                : "bg-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Enter the 6-digit exam code from your instructor
                    </p>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div>
                <Button
                  type="submit"
                  className={`
                    w-full 
                    h-12 
                    text-base
                    font-semibold
                    transition-all duration-300
                    ${
                      loading
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl"
                    }
                    relative overflow-hidden group
                  `}
                  disabled={
                    loading ||
                    !studentId ||
                    !examId ||
                    studentId.length < studentIdFormat.minLength ||
                    examId.length !== 6
                  }
                >
                  <span className="relative z-10 flex items-center justify-center">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        Start Exam Session
                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
