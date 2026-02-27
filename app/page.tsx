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
  ChevronRight,
} from "lucide-react";

// Fingerprint utility
const getBrowserFingerprint = async (): Promise<string> => {
  try {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
      !!navigator.cookieEnabled,
      !!navigator.doNotTrack,
      navigator.hardwareConcurrency || "unknown",
      navigator.platform,
    ];

    const fingerprintString = components.join("|");

    let hash = 0;
    for (let i = 0; i < fingerprintString.length; i++) {
      const char = fingerprintString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    return `device_${Math.abs(hash).toString(16).substring(0, 16)}`;
  } catch (error) {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

const getIPAddress = async (): Promise<string> => {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch {
    return "unknown";
  }
};

// Enhanced Session Validator
class SessionValidator {
  static async checkActiveSession(
    studentId: string,
    examId: string,
    currentDeviceFingerprint: string
  ) {
    try {
      const { data: activeSessions, error } = await supabase
        .from("exam_sessions")
        .select(
          `
          id,
          time_remaining,
          started_at,
          updated_at,
          security_token,
          status,
          session_security!inner (
            device_fingerprint,
            is_active,
            last_verified
          )
        `
        )
        .eq("student_id", studentId)
        .eq("exam_id", examId)
        .eq("status", "in_progress")
        .eq("session_security.is_active", true);

      if (error || !activeSessions || activeSessions.length === 0) {
        return {
          hasActiveSession: false,
          isSameDevice: false,
          canLogin: true,
          timeRemaining: 0,
        };
      }

      const activeSession = activeSessions[0];
      const now = Date.now();
      const lastUpdate = new Date(activeSession.updated_at).getTime();
      const secondsSinceUpdate = (now - lastUpdate) / 1000;

      const isSameDevice =
        activeSession.session_security.device_fingerprint ===
        currentDeviceFingerprint;

      if (isSameDevice) {
        return {
          hasActiveSession: true,
          isSameDevice: true,
          canLogin: true,
          sessionId: activeSession.id,
          securityToken: activeSession.security_token,
          timeRemaining: activeSession.time_remaining,
          session: activeSession,
          secondsSinceUpdate,
        };
      }

      if (secondsSinceUpdate < 10) {
        return {
          hasActiveSession: true,
          isSameDevice: false,
          canLogin: false,
          reason: `active_within_10s`,
          secondsSinceUpdate,
          waitSeconds: Math.ceil(10 - secondsSinceUpdate),
          session: activeSession,
        };
      }

      return {
        hasActiveSession: true,
        isSameDevice: false,
        canLogin: true,
        requiresTakeover: true,
        sessionId: activeSession.id,
        securityToken: activeSession.security_token,
        timeRemaining: activeSession.time_remaining,
        session: activeSession,
        secondsSinceUpdate,
      };
    } catch (error) {
      console.error("Session validation error:", error);
      return {
        hasActiveSession: false,
        isSameDevice: false,
        canLogin: true,
        error: "Validation failed",
      };
    }
  }

  static async terminateOldSession(sessionId: string, securityToken: string) {
    try {
      await supabase
        .from("session_security")
        .update({
          is_active: false,
          last_verified: new Date().toISOString(),
        })
        .eq("session_id", sessionId);

      await supabase
        .from("exam_sessions")
        .update({
          status: "inactive",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      return true;
    } catch (error) {
      console.error("Failed to terminate old session:", error);
      return false;
    }
  }
}

export default function StudentLogin() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [examId, setExamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ studentId: "", examId: "" });

  const [deviceFingerprint, setDeviceFingerprint] = useState<string>("");
  const [ipAddress, setIpAddress] = useState<string>("");
  const [securityInitialized, setSecurityInitialized] = useState(false);

  const [resumeSession, setResumeSession] = useState<any>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [deviceConflict, setDeviceConflict] = useState<any>(null);
  const [showDeviceConflictDialog, setShowDeviceConflictDialog] = useState(false);
  const [showActiveSessionBlockDialog, setShowActiveSessionBlockDialog] = useState(false);
  const [activeSessionBlockInfo, setActiveSessionBlockInfo] = useState<any>(null);
  const [showIPWarningDialog, setShowIPWarningDialog] = useState(false);
  const [suspiciousIP, setSuspiciousIP] = useState("");

  const [studentIdFormat, setStudentIdFormat] = useState<{
    minLength: number;
    maxLength: number;
  }>({
    minLength: 1,
    maxLength: 20,
  });

  const [showStudentId, setShowStudentId] = useState(false);
  const [showExamId, setShowExamId] = useState(false);

  const studentInputRef = useRef<HTMLInputElement>(null);
  const examInputRef = useRef<HTMLInputElement>(null);

  const [countdown, setCountdown] = useState(10);
  const [idsVerified, setIdsVerified] = useState(false);
  const [verifyingIds, setVerifyingIds] = useState(false);
  const [idCheckError, setIdCheckError] = useState("");

  useEffect(() => {
    fetchStudentIdFormat();
    initializeSecurity();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (showActiveSessionBlockDialog && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (interval) clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showActiveSessionBlockDialog, countdown]);

  // Verify that Student ID and Exam ID map to real records before showing Start button
  useEffect(() => {
    setIdsVerified(false);
    setIdCheckError("");

    const trimmedStudent = studentId.trim();
    const trimmedExam = examId.trim();

    // Only attempt remote validation when local format is satisfied
    const hasMinimumStudent =
      trimmedStudent.length >= studentIdFormat.minLength;
    const hasValidExam = /^\d{6}$/.test(trimmedExam);

    if (!hasMinimumStudent || !hasValidExam) {
      setVerifyingIds(false);
      return;
    }

    let cancelled = false;
    setVerifyingIds(true);

    const timer = setTimeout(async () => {
      try {
        await validateExamAccess(trimmedStudent, trimmedExam);
        if (!cancelled) {
          setIdsVerified(true);
          setIdCheckError("");
        }
      } catch (error: any) {
        if (!cancelled) {
          setIdsVerified(false);
          setIdCheckError(error.message || "Invalid Student ID or Exam ID.");
        }
      } finally {
        if (!cancelled) setVerifyingIds(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [studentId, examId, studentIdFormat.minLength]);

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

  const initializeSecurity = async () => {
    try {
      const [fingerprint, ip] = await Promise.all([
        getBrowserFingerprint(),
        getIPAddress(),
      ]);
      setDeviceFingerprint(fingerprint);
      setIpAddress(ip);
      setSecurityInitialized(true);

      localStorage.setItem("device_fingerprint", fingerprint);
      localStorage.setItem("ip_address", ip);

      checkSuspiciousActivity(ip);
    } catch (error) {
      console.error("Failed to initialize security:", error);
      setSecurityInitialized(true);
    }
  };

  const checkSuspiciousActivity = async (ip: string) => {
    try {
      const { data: ipSessions } = await supabase
        .from("exam_sessions")
        .select("id, status, students!inner(student_id, name)")
        .eq("status", "in_progress")
        .like("session_security->>ip_address", `%${ip}%`)
        .limit(5);

      if (ipSessions && ipSessions.length >= 3) {
        setSuspiciousIP(ip);
        setShowIPWarningDialog(true);
      }
    } catch (error) {
      console.error("IP check error:", error);
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

  // Visibility toggles - Amma yeroo click godhan qofa dalaga
  const toggleStudentIdVisibility = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowStudentId((prev) => !prev);
  };

  const toggleExamIdVisibility = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowExamId((prev) => !prev);
  };

  // Security: Prevent Copy/Paste to avoid accidental leaks or cheating attempts
  const handlePreventCopyPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
  };

  const validateExamAccess = async (studentId: string, examCode: string) => {
    const fullStudentId = studentId.trim().toUpperCase();

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, student_id, name, grade_id, section")
      .eq("student_id", fullStudentId)
      .single();

    if (studentError || !student) {
      throw new Error("Student not found. Please check your Student ID.");
    }

    const { data: exam, error: examError } = await supabase
      .from("exams")
      .select("id, exam_code, title, grade_id, section, exam_active, duration, total_marks")
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
      const examSections = exam.section.split(",").map((s) => s.trim().toUpperCase());
      const studentSection = student.section?.trim().toUpperCase();
      if (!studentSection || !examSections.includes(studentSection)) {
        throw new Error("This exam is not available for your section.");
      }
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from("assign_exams")
      .select("id, teacher_id")
      .eq("exam_id", exam.id)
      .eq("student_id", student.id)
      .single();

    if (assignmentError || !assignment) {
      throw new Error("This exam is not assigned to you.");
    }

    const { data: existingResult } = await supabase
      .from("results")
      .select("id")
      .eq("exam_id", exam.id)
      .eq("student_id", student.id)
      .single();

    if (existingResult) {
      throw new Error("You have already taken this exam.");
    }

    return {
      student,
      exam,
      assignment,
      duration: exam.duration * 60,
    };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!idsVerified) {
      toast.error("Please enter a valid Student ID and Exam Code assigned to you.");
      return;
    }

    if (!securityInitialized || !deviceFingerprint) {
      toast.error("Security system initializing. Please wait...");
      return;
    }

    setLoading(true);
    try {
      const validationResult = await validateExamAccess(studentId, examId);

      const sessionCheck = await SessionValidator.checkActiveSession(
        validationResult.student.id,
        validationResult.exam.id,
        deviceFingerprint
      );

      if (sessionCheck.hasActiveSession && !sessionCheck.canLogin && sessionCheck.reason === "active_within_10s") {
        setActiveSessionBlockInfo({
          waitSeconds: sessionCheck.waitSeconds,
          session: sessionCheck.session,
          student: validationResult.student,
          exam: validationResult.exam,
        });
        setCountdown(sessionCheck.waitSeconds);
        setShowActiveSessionBlockDialog(true);
        setLoading(false);
        return;
      }

      if (sessionCheck.hasActiveSession && sessionCheck.isSameDevice) {
        setResumeSession({
          student: validationResult.student,
          exam: validationResult.exam,
          assignment: validationResult.assignment,
          existingSession: sessionCheck.session,
          timeRemaining: sessionCheck.timeRemaining,
        });
        setShowResumeDialog(true);
        setLoading(false);
        return;
      }

      if (sessionCheck.hasActiveSession && sessionCheck.requiresTakeover) {
        setDeviceConflict({
          session: sessionCheck.session,
          student: validationResult.student,
          exam: validationResult.exam,
          assignment: validationResult.assignment,
          oldSessionId: sessionCheck.sessionId,
          oldSecurityToken: sessionCheck.securityToken,
          timeRemaining: sessionCheck.timeRemaining,
        });
        setShowDeviceConflictDialog(true);
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
      setLoading(false);
    }
  };

  const createNewExamSession = async (validationResult: any) => {
    const { student, exam, assignment, duration } = validationResult;

    const securityToken = [...Array(32)].map(() => Math.random().toString(36)[2]).join("");

    const { data: session, error: sessionError } = await supabase
      .from("exam_sessions")
      .insert({
        student_id: student.id,
        exam_id: exam.id,
        teacher_id: assignment.teacher_id,
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        time_remaining: duration,
        status: "in_progress",
        security_token: securityToken,
        device_takeover_count: 0,
      })
      .select()
      .single();

    if (sessionError) {
      if (sessionError.code === "23505") {
        throw new Error("You already have an active exam session.");
      }
      throw new Error("Failed to create exam session. Please try again.");
    }

    const { error: securityError } = await supabase
      .from("session_security")
      .insert({
        session_id: session.id,
        student_id: student.id,
        device_fingerprint: deviceFingerprint,
        ip_address: ipAddress,
        user_agent: navigator.userAgent,
        token: securityToken,
        is_active: true,
        last_verified: new Date().toISOString(),
      });

    if (securityError) {
      await supabase.from("exam_sessions").delete().eq("id", session.id);
      throw new Error("Security setup failed. Please try again.");
    }

    return { ...session, security_token: securityToken };
  };

  const handleResumeSession = async () => {
    if (!resumeSession) return;

    try {
      setLoading(true);

      const { error: updateError } = await supabase
        .from("exam_sessions")
        .update({
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", resumeSession.existingSession.id);

      if (updateError) throw updateError;

      toast.success("Resuming exam session...");
      redirectToResumeSession(resumeSession);
    } catch (error) {
      console.error("Error resuming session:", error);
      toast.error("Failed to resume session");
      setLoading(false);
    }
  };

  const handleForceTakeover = async () => {
    if (!deviceConflict) return;

    setLoading(true);
    try {
      const terminated = await SessionValidator.terminateOldSession(
        deviceConflict.oldSessionId,
        deviceConflict.oldSecurityToken
      );

      if (!terminated) throw new Error("Failed to terminate old session");

      const securityToken = [...Array(32)].map(() => Math.random().toString(36)[2]).join("");

      const { data: session, error: sessionError } = await supabase
        .from("exam_sessions")
        .insert({
          student_id: deviceConflict.student.id,
          exam_id: deviceConflict.exam.id,
          teacher_id: deviceConflict.assignment.teacher_id,
          started_at: deviceConflict.session.started_at,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          time_remaining: deviceConflict.timeRemaining,
          status: "in_progress",
          security_token: securityToken,
          device_takeover_count: 1,
          last_takeover_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      const { error: securityError } = await supabase
        .from("session_security")
        .insert({
          session_id: session.id,
          student_id: deviceConflict.student.id,
          device_fingerprint: deviceFingerprint,
          ip_address: ipAddress,
          user_agent: navigator.userAgent,
          token: securityToken,
          is_active: true,
          last_verified: new Date().toISOString(),
        });

      if (securityError) {
        await supabase.from("exam_sessions").delete().eq("id", session.id);
        throw securityError;
      }

      const { data: oldAnswers } = await supabase
        .from("student_answers")
        .select("*")
        .eq("session_id", deviceConflict.oldSessionId);

      if (oldAnswers && oldAnswers.length > 0) {
        const newAnswers = oldAnswers.map((answer) => ({
          session_id: session.id,
          question_id: answer.question_id,
          selected_option_id: answer.selected_option_id,
          answer_text: answer.answer_text,
          is_flagged: answer.is_flagged,
          is_correct: answer.is_correct,
          answered_at: answer.answered_at,
        }));

        await supabase.from("student_answers").insert(newAnswers);
      }

      toast.warning("Session taken over. Continuing exam from previous time...");
      setShowDeviceConflictDialog(false);

      const examSession = {
        sessionId: session.id,
        securityToken: securityToken,
        studentId: deviceConflict.student.id,
        studentNumber: deviceConflict.student.student_id,
        studentName: deviceConflict.student.name,
        examId: deviceConflict.exam.id,
        examCode: deviceConflict.exam.exam_code,
        examTitle: deviceConflict.exam.title,
        timeRemaining: deviceConflict.timeRemaining,
        deviceFingerprint: deviceFingerprint,
        isTakeover: true,
      };

      localStorage.setItem("examSession", JSON.stringify(examSession));

      const slug = deviceConflict.exam.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

      router.push(`/start/${slug}?student=${deviceConflict.student.student_id}&exam=${deviceConflict.exam.exam_code}&session=${session.id}&token=${securityToken}`);
    } catch (error: any) {
      toast.error(error.message || "Takeover failed. Please try again.");
      setLoading(false);
    }
  };

  const redirectToExam = (session: any, validationResult: any) => {
    const { student, exam, duration } = validationResult;

    const examSession = {
      sessionId: session.id,
      securityToken: session.security_token,
      studentId: student.id,
      studentNumber: student.student_id,
      studentName: student.name,
      examId: exam.id,
      examCode: exam.exam_code,
      examTitle: exam.title,
      timeRemaining: duration,
      deviceFingerprint: deviceFingerprint,
      ipAddress: ipAddress,
      isTakeover: false,
    };

    localStorage.setItem("examSession", JSON.stringify(examSession));

    const slug = exam.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

    router.push(`/start/${slug}?student=${student.student_id}&exam=${exam.exam_code}&session=${session.id}&token=${session.security_token}`);
  };

  const redirectToResumeSession = (resumeData: any) => {
    const { student, exam, existingSession } = resumeData;

    const examSession = {
      sessionId: existingSession.id,
      securityToken: existingSession.security_token,
      studentId: student.id,
      studentNumber: student.student_id,
      studentName: student.name,
      examId: exam.id,
      examCode: exam.exam_code,
      examTitle: exam.title,
      timeRemaining: existingSession.time_remaining,
      deviceFingerprint: deviceFingerprint,
      ipAddress: ipAddress,
      isTakeover: false,
    };

    localStorage.setItem("examSession", JSON.stringify(examSession));

    const slug = exam.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

    router.push(`/start/${slug}?student=${student.student_id}&exam=${exam.exam_code}&session=${existingSession.id}&token=${existingSession.security_token}`);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleRetryAfterBlock = async () => {
    setShowActiveSessionBlockDialog(false);
    setLoading(true);

    try {
      const validationResult = await validateExamAccess(studentId, examId);
      const sessionCheck = await SessionValidator.checkActiveSession(
        validationResult.student.id,
        validationResult.exam.id,
        deviceFingerprint
      );

      if (sessionCheck.hasActiveSession && !sessionCheck.canLogin) {
        setActiveSessionBlockInfo({
          waitSeconds: sessionCheck.waitSeconds,
          session: sessionCheck.session,
          student: validationResult.student,
          exam: validationResult.exam,
        });
        setCountdown(sessionCheck.waitSeconds);
        setShowActiveSessionBlockDialog(true);
        setLoading(false);
        return;
      }

      if (sessionCheck.hasActiveSession && sessionCheck.requiresTakeover) {
        setDeviceConflict({
          session: sessionCheck.session,
          student: validationResult.student,
          exam: validationResult.exam,
          assignment: validationResult.assignment,
          oldSessionId: sessionCheck.sessionId,
          oldSecurityToken: sessionCheck.securityToken,
          timeRemaining: sessionCheck.timeRemaining,
        });
        setShowDeviceConflictDialog(true);
      } else {
        const sessionData = await createNewExamSession(validationResult);
        toast.success("Login successful! Starting exam...");
        redirectToExam(sessionData, validationResult);
      }
    } catch (error: any) {
      toast.error(error.message || "Login failed");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#F7F7F4] text-slate-900"
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
    >
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

      {/* Active Session Block Dialog */}
      <Dialog open={showActiveSessionBlockDialog} onOpenChange={setShowActiveSessionBlockDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Active Session Detected
            </DialogTitle>
            <DialogDescription>
              Your account is currently active on another device.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm text-red-700 font-medium mb-1">
                    ⚠️ 10-Second Device Lock
                  </p>
                  <p className="text-sm text-red-600">
                    Another device is actively taking this exam. For security,
                    you must wait before logging in from this device.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r from-red-100 to-rose-100 mb-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{countdown}</div>
                  <div className="text-xs text-red-500">seconds</div>
                </div>
              </div>
              <p className="text-gray-600 mb-4">
                Please wait {countdown} second{countdown !== 1 ? "s" : ""} before trying again.
              </p>

              {countdown === 0 ? (
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                  <p className="text-green-700 font-medium">✓ You can now proceed</p>
                  <p className="text-sm text-green-600 mt-1">
                    The other device session is now available for takeover.
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                  <p className="text-amber-700">
                    <span className="font-medium">Note:</span> This prevents exam sharing and ensures fair assessment.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowActiveSessionBlockDialog(false);
                  setLoading(false);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRetryAfterBlock}
                disabled={countdown > 0}
                className={`flex-1 ${
                  countdown > 0
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {countdown > 0 ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wait {countdown}s
                  </>
                ) : (
                  "Try Again Now"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Device Conflict Dialog */}
      <Dialog open={showDeviceConflictDialog} onOpenChange={setShowDeviceConflictDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <ChevronRight className="h-5 w-5" />
              Session Takeover Required
            </DialogTitle>
            <DialogDescription>
              Continue exam from another device?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-700 font-medium mb-1">
                    Device Switch Detected
                  </p>
                  <p className="text-sm text-amber-600">
                    Your exam session was started on another device. You can
                    take over the session on this device.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-blue-800">Time Continuation</p>
                    <p className="text-sm text-blue-600">
                      Your exam time will continue from where it left off
                    </p>
                  </div>
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div className="mt-2 text-center">
                  <div className="text-2xl font-bold text-blue-700">
                    {deviceConflict?.timeRemaining && formatTime(deviceConflict.timeRemaining)}
                  </div>
                  <p className="text-xs text-blue-600">Time remaining</p>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeviceConflictDialog(false);
                  setDeviceConflict(null);
                  setLoading(false);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleForceTakeover}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Taking Over...
                  </>
                ) : (
                  "Take Over Session"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* IP Warning Dialog */}
      <Dialog open={showIPWarningDialog} onOpenChange={setShowIPWarningDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Shield className="h-5 w-5" />
              Multiple Sessions Detected
            </DialogTitle>
            <DialogDescription>
              Multiple exam sessions detected from your network.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-700 font-medium mb-1">
                    Network Sharing Warning
                  </p>
                  <p className="text-sm text-amber-600">
                    Your IP address ({suspiciousIP}) has multiple active exam
                    sessions. This may indicate account sharing, which is not allowed.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <p className="mb-2">Please ensure:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>You are using your own account only</li>
                <li>You are not sharing your login credentials</li>
                <li>You are taking the exam from your personal device</li>
              </ul>
            </div>

            <DialogFooter>
              <Button
                onClick={() => setShowIPWarningDialog(false)}
                className="bg-amber-600 hover:bg-amber-700"
              >
                I Understand
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Login Page - Professional Split Screen */}
      <div className="min-h-screen flex bg-transparent">
        {/* Left Side – Enhanced Professional UI */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-50 flex-col justify-between p-12 text-slate-700 border-r border-slate-200">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-100/50 blur-3xl" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-50/50 blur-3xl" />
          </div>

          {/* Top Content */}
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-12">
              <div className="relative">
                <div className="w-16 h-16 p-3 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden">
                  <img src="/icons/icon-192.png" alt="ExamFlow Logo" className="w-full h-full object-cover scale-125" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  ALPHA
                </h1>
                <p className="text-slate-500 font-medium text-sm mt-0.5 tracking-wide uppercase">
                  Assessment Platform
                </p>
              </div>
            </div>

            <div className="max-w-md space-y-6">
              <h2 className="text-2xl font-semibold text-slate-800 leading-snug">
                Empowering your academic journey through secure evaluations.
              </h2>
              <p className="text-slate-600 text-base leading-relaxed">
                “Success comes from preparation, focus, and confidence. Approach
                your exam calmly — every question is an opportunity to show what
                you know.”
              </p>
              
              <div className="pt-6 mt-6 border-t border-slate-200/60">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <p>Secure, monitored, and automated grading system.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Motivation / Footer */}
          <div className="relative z-10 text-slate-500 text-sm font-medium">
            <p>Stay calm. Stay focused. Do your best.</p>
            <p className="mt-2 text-slate-400">© {new Date().getFullYear()} ALPHA COLLEGE. All rights reserved.</p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center gap-3 mb-10">
              <div className="w-14 h-14 p-2.5 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden">
                  <img src="/icons/icon-192.png" alt="ExamFlow Logo" className="w-full h-full object-cover scale-125" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">ALPHA</h1>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">
                  Assessment Platform
                </p>
              </div>
            </div>

            {/* Login Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome Back
              </h2>
              <p className="text-gray-500">
                Enter your credentials to access your examination
              </p>
            </div>

            {/* Login Form with Enhanced Security attributes */}
            <form onSubmit={handleLogin} className="space-y-6" autoComplete="off">
              {/* Fake fields to prevent browser auto-fill tricks */}
              <input type="text" name="fakeusernameremembered" className="hidden" />
              <input type="password" name="fakepasswordremembered" className="hidden" />

              {/* Student ID Input */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="studentId" className="text-sm font-semibold text-slate-700">
                    Student ID
                  </Label>
                </div>

                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="h-5 w-5" />
                  </div>

                  <Input
                    ref={studentInputRef}
                    id="studentId"
                    name="student_identifier_secure"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    onCopy={handlePreventCopyPaste}
                    onPaste={handlePreventCopyPaste}
                    onCut={handlePreventCopyPaste}
                    value={studentId}
                    onChange={handleStudentIdChange}
                    placeholder="Enter your ID"
                    type={showStudentId ? "text" : "password"}
                    className={`
                      h-12 pl-11 pr-12 
                      text-base font-medium
                      ${
                        errors.studentId
                          ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                          : verifyingIds && studentId && examId
                          ? "border-slate-400 animate-pulse focus:border-slate-800 focus:ring-slate-200"
                          : idCheckError && studentId
                          ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                          : idsVerified && studentId
                          ? "border-green-300 focus:border-green-500 focus:ring-green-100"
                          : "border-slate-200 focus:border-slate-800 focus:ring-slate-100"
                      }
                      focus:ring-2 shadow-sm
                      transition-all duration-200
                    `}
                    maxLength={studentIdFormat.maxLength}
                    disabled={loading}
                  />

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {studentId && !errors.studentId && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    <button
                      type="button"
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                      onClick={toggleStudentIdVisibility}
                      disabled={!studentId || loading}
                      tabIndex={-1}
                    >
                      {showStudentId ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="min-h-[20px]">
                  {errors.studentId && (
                    <p className="text-sm text-red-600 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {errors.studentId}
                    </p>
                  )}
                </div>
              </div>

              {/* Exam ID Input */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="examId" className="text-sm font-semibold text-slate-700">
                    Exam Code
                  </Label>
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    6 digits
                  </span>
                </div>

                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <KeyRound className="h-5 w-5" />
                  </div>

                  <Input
                    ref={examInputRef}
                    id="examId"
                    name="exam_code_secure"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    onCopy={handlePreventCopyPaste}
                    onPaste={handlePreventCopyPaste}
                    onCut={handlePreventCopyPaste}
                    value={examId}
                    onChange={handleExamIdChange}
                    placeholder="••••••"
                    type={showExamId ? "text" : "password"}
                    className={`
                      h-12 pl-11 pr-12 
                      text-lg tracking-[0.2em] font-medium
                      ${
                        errors.examId
                          ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                          : verifyingIds && studentId && examId
                          ? "border-slate-400 animate-pulse focus:border-slate-800 focus:ring-slate-200"
                          : idCheckError && examId
                          ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                          : idsVerified && examId.length === 6
                          ? "border-green-300 focus:border-green-500 focus:ring-green-100"
                          : "border-slate-200 focus:border-slate-800 focus:ring-slate-100"
                      }
                      focus:ring-2 shadow-sm
                      transition-all duration-200
                    `}
                    maxLength={6}
                    disabled={loading}
                  />

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {examId && examId.length === 6 && !errors.examId && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    <button
                      type="button"
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                      onClick={toggleExamIdVisibility}
                      disabled={!examId || loading}
                      tabIndex={-1}
                    >
                      {showExamId ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="min-h-[20px]">
                  {errors.examId && (
                    <p className="text-sm text-red-600 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {errors.examId}
                    </p>
                  )}
                </div>
              </div>

              {/* Submit Button - Only when IDs are fully valid */}
              <div className="pt-4 space-y-2">
                {idsVerified && (
                  <Button
                    type="submit"
                    className={`
                      w-full h-12 text-base font-semibold text-white
                      transition-all duration-300 rounded-lg
                      ${
                        loading || !securityInitialized
                          ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                          : "bg-slate-900 hover:bg-slate-800 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                      }
                    `}
                    disabled={loading || !securityInitialized}
                  >
                    <span className="flex items-center justify-center">
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Authenticating...
                        </>
                      ) : !securityInitialized ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Initializing Security...
                        </>
                      ) : (
                        <>
                          Start Exam Session
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </span>
                  </Button>
                )}

                {!idsVerified && (studentId || examId) && (
                  <p className="text-xs text-slate-500 text-center">
                    {verifyingIds
                      ? "Checking your Student ID and Exam Code..."
                      : idCheckError
                      ? idCheckError
                      : "Enter a valid Student ID and 6‑digit Exam Code assigned to you to continue."}
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}