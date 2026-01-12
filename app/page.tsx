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
      // Get active session for this student and exam
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

      // Check if same device
      const isSameDevice =
        activeSession.session_security.device_fingerprint ===
        currentDeviceFingerprint;

      if (isSameDevice) {
        // Same device - always allow
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

      // Different device - check if active within last 10 seconds
      if (secondsSinceUpdate < 10) {
        // Device is actively taking exam - BLOCK
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

      // Different device, but session is stale (>10 seconds)
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
      // Mark session security as inactive
      await supabase
        .from("session_security")
        .update({
          is_active: false,
          last_verified: new Date().toISOString(),
        })
        .eq("session_id", sessionId);

      // Mark exam session as inactive (but preserve time)
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

  // Security states
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>("");
  const [ipAddress, setIpAddress] = useState<string>("");
  const [securityInitialized, setSecurityInitialized] = useState(false);

  // State for dialogs
  const [resumeSession, setResumeSession] = useState<any>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [deviceConflict, setDeviceConflict] = useState<any>(null);
  const [showDeviceConflictDialog, setShowDeviceConflictDialog] =
    useState(false);
  const [showActiveSessionBlockDialog, setShowActiveSessionBlockDialog] =
    useState(false);
  const [activeSessionBlockInfo, setActiveSessionBlockInfo] =
    useState<any>(null);
  const [showIPWarningDialog, setShowIPWarningDialog] = useState(false);
  const [suspiciousIP, setSuspiciousIP] = useState("");

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

  // Timer for active session block countdown
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    fetchStudentIdFormat();
    initializeSecurity();
  }, []);

  // INPUT TYPE UPDATE - FOCUS GODHAAYIIN SHOW TA'UU QABA
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

  // Countdown timer for active session block
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

      // Store in localStorage for session recovery
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
      // Check for multiple active sessions from same IP
      const { data: ipSessions, error } = await supabase
        .from("exam_sessions")
        .select(
          `
          id,
          status,
          students!inner (
            student_id,
            name
          )
        `
        )
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

  // FOCUS GODHAAYIIN VALUE AGARSIISU - INPUT UNIQUE
  const handleStudentIdFocus = () => {
    // Yeroo focus godhaniif, value jiraate show ta'uu qaba
    if (studentId) {
      setShowStudentId(true);
    }
  };

  const handleExamIdFocus = () => {
    // Yeroo focus godhaniif, value jiraate show ta'uu qaba
    if (examId) {
      setShowExamId(true);
    }
  };

  // EYE ICON CLICK GODHAAYIIN TOGGLE GODHA - INPUT UNIQUE
  const toggleStudentIdVisibility = (e: React.MouseEvent) => {
    e.preventDefault(); // Form submit hin godhu
    e.stopPropagation(); // Event propagation hin godhu
    setShowStudentId((prev) => !prev);
  };

  const toggleExamIdVisibility = (e: React.MouseEvent) => {
    e.preventDefault(); // Form submit hin godhu
    e.stopPropagation(); // Event propagation hin godhu
    setShowExamId((prev) => !prev);
  };

  // BLUR GODHAAYIIN HIDE TA'UU QABA (value hin jiraate)
  const handleStudentIdBlur = () => {
    // Value hin jiraate yoo ta'e hide godha
    if (!studentId) {
      setShowStudentId(false);
    }
  };

  const handleExamIdBlur = () => {
    // Value hin jiraate yoo ta'e hide godha
    if (!examId) {
      setShowExamId(false);
    }
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

    if (!securityInitialized || !deviceFingerprint) {
      toast.error("Security system initializing. Please wait...");
      return;
    }

    setLoading(true);
    try {
      // First validate exam access
      const validationResult = await validateExamAccess(studentId, examId);

      // Check for active sessions with ENHANCED validation
      const sessionCheck = await SessionValidator.checkActiveSession(
        validationResult.student.id,
        validationResult.exam.id,
        deviceFingerprint
      );

      // Case 1: Active session on another device within 10 seconds - BLOCK
      if (
        sessionCheck.hasActiveSession &&
        !sessionCheck.canLogin &&
        sessionCheck.reason === "active_within_10s"
      ) {
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

      // Case 2: Same device - resume immediately
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

      // Case 3: Stale session on another device (>10 seconds) - takeover required
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

      // Case 4: No active session - create new
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

    // Generate security token
    const securityToken = [...Array(32)]
      .map(() => Math.random().toString(36)[2])
      .join("");

    // Create exam session
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

    // Create session security record
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
      // Rollback session creation
      await supabase.from("exam_sessions").delete().eq("id", session.id);
      throw new Error("Security setup failed. Please try again.");
    }

    return { ...session, security_token: securityToken };
  };

  const handleResumeSession = async () => {
    if (!resumeSession) return;

    try {
      setLoading(true);

      // Update session activity
      const { error: updateError } = await supabase
        .from("exam_sessions")
        .update({
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", resumeSession.existingSession.id);

      if (updateError) {
        throw updateError;
      }

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
      // 1. Terminate the old session first
      const terminated = await SessionValidator.terminateOldSession(
        deviceConflict.oldSessionId,
        deviceConflict.oldSecurityToken
      );

      if (!terminated) {
        throw new Error("Failed to terminate old session");
      }

      // 2. Create new session with EXISTING time
      const securityToken = [...Array(32)]
        .map(() => Math.random().toString(36)[2])
        .join("");

      const { data: session, error: sessionError } = await supabase
        .from("exam_sessions")
        .insert({
          student_id: deviceConflict.student.id,
          exam_id: deviceConflict.exam.id,
          teacher_id: deviceConflict.assignment.teacher_id,
          started_at: deviceConflict.session.started_at, // Keep original start time
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          time_remaining: deviceConflict.timeRemaining, // CONTINUE time from old session
          status: "in_progress",
          security_token: securityToken,
          device_takeover_count: 1,
          last_takeover_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // 3. Create security record for new device
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

      // 4. Copy existing answers from old session if any
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

      toast.warning(
        "Session taken over. Continuing exam from previous time..."
      );
      setShowDeviceConflictDialog(false);

      // Redirect to exam with continued time
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

      const slug = deviceConflict.exam.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

      router.push(
        `/start/${slug}?student=${deviceConflict.student.student_id}&exam=${deviceConflict.exam.exam_code}&session=${session.id}&token=${securityToken}`
      );
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

    const slug = exam.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    router.push(
      `/start/${slug}?student=${student.student_id}&exam=${exam.exam_code}&session=${session.id}&token=${session.security_token}`
    );
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

    const slug = exam.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    router.push(
      `/start/${slug}?student=${student.student_id}&exam=${exam.exam_code}&session=${existingSession.id}&token=${existingSession.security_token}`
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

  const formatLastActivity = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = (now.getTime() - date.getTime()) / 1000;

    if (diffInSeconds < 10) {
      return "Just now";
    } else if (diffInSeconds < 60) {
      return `${Math.floor(diffInSeconds)} seconds ago`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    } else {
      return formatDateTime(dateString);
    }
  };

  const handleRetryAfterBlock = async () => {
    setShowActiveSessionBlockDialog(false);
    setLoading(true);

    try {
      // Re-check after countdown
      const validationResult = await validateExamAccess(studentId, examId);
      const sessionCheck = await SessionValidator.checkActiveSession(
        validationResult.student.id,
        validationResult.exam.id,
        deviceFingerprint
      );

      if (sessionCheck.hasActiveSession && !sessionCheck.canLogin) {
        // Still active, update countdown
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

      // Now can proceed
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

      {/* Active Session Block Dialog (10-second lock) */}
      <Dialog
        open={showActiveSessionBlockDialog}
        onOpenChange={setShowActiveSessionBlockDialog}
      >
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
                  <div className="text-3xl font-bold text-red-600">
                    {countdown}
                  </div>
                  <div className="text-xs text-red-500">seconds</div>
                </div>
              </div>
              <p className="text-gray-600 mb-4">
                Please wait {countdown} second{countdown !== 1 ? "s" : ""}{" "}
                before trying again.
              </p>

              {countdown === 0 ? (
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                  <p className="text-green-700 font-medium">
                    ✓ You can now proceed
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    The other device session is now available for takeover.
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                  <p className="text-amber-700">
                    <span className="font-medium">Note:</span> This prevents
                    exam sharing and ensures fair assessment.
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

      {/* Device Conflict Dialog (Takeover required) */}
      <Dialog
        open={showDeviceConflictDialog}
        onOpenChange={setShowDeviceConflictDialog}
      >
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
                    <p className="font-medium text-blue-800">
                      Time Continuation
                    </p>
                    <p className="text-sm text-blue-600">
                      Your exam time will continue from where it left off
                    </p>
                  </div>
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div className="mt-2 text-center">
                  <div className="text-2xl font-bold text-blue-700">
                    {deviceConflict?.timeRemaining &&
                      formatTime(deviceConflict.timeRemaining)}
                  </div>
                  <p className="text-xs text-blue-600">Time remaining</p>
                </div>
              </div>

              <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-purple-800">
                      Progress Preservation
                    </p>
                    <p className="text-sm text-purple-600">
                      All answered questions will be transferred
                    </p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-purple-500" />
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
                    sessions. This may indicate account sharing, which is not
                    allowed.
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
              <div
                  className="w-16 h-16 p-3 rounded-2xl bg-white/60 backdrop-blur-md shadow-md ring-1 ring-black/5 flex items-center justify-center overflow-hidden"
                >
                  <img src="/icons/icon-192.png" alt="ExamFlow Logo" className="w-full h-full object-cover scale-125" />
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
                    onBlur={handleStudentIdBlur}
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
                    onBlur={handleExamIdBlur}
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
                        : !securityInitialized
                        ? "bg-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl"
                    }
                    relative overflow-hidden group
                  `}
                  disabled={
                    loading ||
                    !securityInitialized ||
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
                    ) : !securityInitialized ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Initializing Security...
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

            {/* Security Footer */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-500">
                    Secure Connection
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {deviceFingerprint
                    ? "Device Verified"
                    : "Verifying Device..."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}