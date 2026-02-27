"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SlidingNumber } from "@/components/motion-primitives/sliding-number";
import { toast } from "sonner";
import {
  Clock,
  Flag,
  ChevronRight,
  ChevronLeft,
  Send,
  PanelLeftOpen,
  PanelLeftClose,
  CheckCircle2,
  HelpCircle,
  Maximize,
  AlertTriangle,
  Ban,
  Award,
  Target,
  BarChart,
  BookOpen,
  Minimize2,
  Maximize2,
  Check,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  FileText,
  Link2,
  AlertCircle,
  X,
  BookText,
  ScrollText,
  ChevronUp,
  ChevronDown,
  Shield,
  ShieldAlert,
  Smartphone,
  Globe,
  Cpu,
  LogOut,
  RefreshCw,
  Lock,
  Unlock,
  Zap,
  Activity,
  WifiOff,
  Menu,
  Grid,
  Navigation,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

// --- Security: Validate URL params against tampered values ──────────────────
const isValidSessionId = (id: string | null): boolean =>
  !!id && /^[0-9a-f-]{36}$/i.test(id); // UUID format

const isValidToken = (token: string | null): boolean =>
  !!token && /^[a-z0-9]{32}$/i.test(token);

const isValidStudentId = (id: string | null): boolean =>
  !!id && /^[A-Z0-9\-_]{1,25}$/i.test(id);

const isValidExamCode = (code: string | null): boolean =>
  !!code && /^\d{6}$/.test(code);

// --- Security: Prevent clickjacking ─────────────────────────────────────────
if (typeof window !== "undefined" && window.top !== window.self) {
  // Bust out of iframes
  window.top!.location.href = window.location.href;
}

// --- Device Fingerprinting ---
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

// --- Enhanced Session Monitor with Real-time Device Locking ---
class EnhancedSessionMonitor {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private deviceCheckInterval: NodeJS.Timeout | null = null;
  private sessionCheckInterval: NodeJS.Timeout | null = null;
  private sessionId: string;
  private securityToken: string;
  private deviceFingerprint: string;
  private onSessionTerminated: (reason: string) => void;
  private onRedirectHome: () => void;
  private isActive = true;
  private lastHeartbeatTime = Date.now();
  private heartbeatFailedCount = 0;
  private deviceChanged = false;

  constructor(
    sessionId: string,
    securityToken: string,
    deviceFingerprint: string,
    onSessionTerminated: (reason: string) => void,
    onRedirectHome: () => void
  ) {
    this.sessionId = sessionId;
    this.securityToken = securityToken;
    this.deviceFingerprint = deviceFingerprint;
    this.onSessionTerminated = onSessionTerminated;
    this.onRedirectHome = onRedirectHome;
  }

  async start() {
    // Send immediate heartbeat to claim session
    await this.sendHeartbeat(true);

    // Start heartbeat every 3 seconds
    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeat();
    }, 3000);

    // Check device ownership every 5 seconds
    this.deviceCheckInterval = setInterval(async () => {
      await this.checkDeviceOwnership();
    }, 5000);

    // Check session status every 10 seconds
    this.sessionCheckInterval = setInterval(async () => {
      await this.checkSessionStatus();
    }, 10000);

    console.log("Session monitor started for session:", this.sessionId);
  }

  private async sendHeartbeat(isInitial = false) {
    if (!this.isActive) return;

    try {
      this.lastHeartbeatTime = Date.now();

      // Update both tables atomically
      const updates = [
        supabase
          .from("exam_sessions")
          .update({
            last_activity_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            time_remaining: this.getTimeRemainingCallback?.(),
          })
          .eq("id", this.sessionId)
          .eq("security_token", this.securityToken),

        supabase
          .from("session_security")
          .update({
            last_verified: new Date().toISOString(),
            device_fingerprint: this.deviceFingerprint,
            is_active: true,
          })
          .eq("session_id", this.sessionId)
          .eq("token", this.securityToken),
      ];

      const results = await Promise.all(updates);

      // Check for errors
      const hasError = results.some((result) => result.error);
      if (hasError) {
        throw new Error("Heartbeat update failed");
      }

      this.heartbeatFailedCount = 0;

      if (isInitial) {
        console.log(
          "Initial heartbeat sent, session claimed by device:",
          this.deviceFingerprint
        );
      }
    } catch (error) {
      console.error("Heartbeat failed:", error);
      this.heartbeatFailedCount++;

      if (this.heartbeatFailedCount >= 3) {
        this.terminateSession("Connection lost. Multiple heartbeat failures.");
      }
    }
  }

  private async checkDeviceOwnership() {
    if (!this.isActive) return;

    try {
      // Check if this device still owns the session
      const { data: security, error } = await supabase
        .from("session_security")
        .select("device_fingerprint, is_active, last_verified")
        .eq("session_id", this.sessionId)
        .eq("token", this.securityToken)
        .single();

      if (error || !security) {
        this.terminateSession("Security record not found or invalid.");
        return;
      }

      if (!security.is_active) {
        this.terminateSession("Session deactivated by system.");
        return;
      }

      // Check if device fingerprint matches
      if (security.device_fingerprint !== this.deviceFingerprint) {
        this.deviceChanged = true;
        this.terminateSession(
          "Device changed. Session taken over by another device."
        );
        return;
      }

      // Check last verification time (should be within 15 seconds)
      const lastVerified = new Date(security.last_verified);
      const now = new Date();
      const diffInSeconds = (now.getTime() - lastVerified.getTime()) / 1000;

      if (diffInSeconds > 15) {
        // Session might have issues, try to reclaim
        await this.reclaimSession();
      }
    } catch (error) {
      console.error("Device ownership check error:", error);
    }
  }

  private async checkSessionStatus() {
    if (!this.isActive) return;

    try {
      const { data: session, error } = await supabase
        .from("exam_sessions")
        .select("status, security_token")
        .eq("id", this.sessionId)
        .single();

      if (error || !session) {
        this.terminateSession("Session not found in database.");
        return;
      }

      if (session.status !== "in_progress") {
        this.terminateSession(`Exam session ${session.status}.`);
        return;
      }

      if (session.security_token !== this.securityToken) {
        this.terminateSession(
          "Security token invalid. Session may have been taken over."
        );
        return;
      }
    } catch (error) {
      console.error("Session status check error:", error);
    }
  }

  private async reclaimSession() {
    try {
      await supabase
        .from("session_security")
        .update({
          device_fingerprint: this.deviceFingerprint,
          last_verified: new Date().toISOString(),
          is_active: true,
        })
        .eq("session_id", this.sessionId)
        .eq("token", this.securityToken);

      console.log("Session reclaimed by device:", this.deviceFingerprint);
    } catch (error) {
      console.error("Failed to reclaim session:", error);
    }
  }

  private terminateSession(reason: string) {
    if (!this.isActive) return;

    this.isActive = false;
    this.stop();

    console.log("Session terminated:", reason);
    this.onSessionTerminated(reason);

    // Small delay before redirecting
    setTimeout(() => {
      this.onRedirectHome();
    }, 2000);
  }

  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.deviceCheckInterval) {
      clearInterval(this.deviceCheckInterval);
      this.deviceCheckInterval = null;
    }
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
  }

  // Callback to get current time remaining
  private getTimeRemainingCallback: (() => number) | null = null;

  setTimeRemainingCallback(callback: () => number) {
    this.getTimeRemainingCallback = callback;
  }

  isSessionActive() {
    return this.isActive;
  }
}

// --- Utility Functions ---

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

// Admin dashboard style spinner for full-screen loading
function ExamPageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-white">
      <style>{`
        .exam-spinner-svg { animation: exam-spinner-rotate 2s linear infinite; }
        .exam-spinner-circle {
          stroke-dasharray: 1, 200; stroke-dashoffset: 0;
          animation: exam-spinner-stretch 1.5s ease-in-out infinite;
          stroke-linecap: round;
        }
        @keyframes exam-spinner-rotate { 100% { transform: rotate(360deg); } }
        @keyframes exam-spinner-stretch {
          0%   { stroke-dasharray: 1, 200;  stroke-dashoffset: 0; }
          50%  { stroke-dasharray: 90, 200; stroke-dashoffset: -35px; }
          100% { stroke-dasharray: 90, 200; stroke-dashoffset: -124px; }
        }
      `}</style>
      <svg className="h-10 w-10 text-zinc-800 exam-spinner-svg" viewBox="25 25 50 50">
        <circle
          className="exam-spinner-circle"
          cx="50" cy="50" r="20"
          fill="none" stroke="currentColor" strokeWidth="4"
        />
      </svg>
    </div>
  );
}

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const renderWithMath = (text: string) => {
  if (!text) return null;

  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

  return parts.map((part, index) => {
    if (part.startsWith("$$") && part.endsWith("$$")) {
      const mathContent = part.slice(2, -2);
      return <BlockMath key={index} math={mathContent} />;
    } else if (part.startsWith("$") && part.endsWith("$")) {
      const mathContent = part.slice(1, -1);
      return <InlineMath key={index} math={mathContent} />;
    } else {
      const lines = part.split("\n");
      return (
        <span key={index} style={{ whiteSpace: "pre-wrap" }}>
          {lines.map((line, lineIndex) => (
            <span key={lineIndex}>
              {lineIndex > 0 && <br />}
              {line}
            </span>
          ))}
        </span>
      );
    }
  });
};

const parseQuestionText = (text: string) => {
  if (!text) return { passageHtml: "", questionText: "", hasPassage: false };

  const passageMatch = text.match(
    /\[PASSAGE_HTML\]([\s\S]*?)\[\/PASSAGE_HTML\]/
  );
  if (passageMatch) {
    const passageHtml = passageMatch[1].trim();
    const questionText = text
      .replace(/\[PASSAGE_HTML\][\s\S]*?\[\/PASSAGE_HTML\]\n*/, "")
      .trim();
    return { passageHtml, questionText, hasPassage: true };
  }
  return { passageHtml: "", questionText: text, hasPassage: false };
};

// Improved seeded shuffle function with better randomness
// Uses a simple string hash -> LCG PRNG -> Fisher-Yates.
const seededShuffle = <T,>(array: T[], seed: string): T[] => {
  const shuffled = [...array];

  // Derive an integer seed from the string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0; // force 32‑bit
  }
  // Ensure non‑zero positive seed
  let seedValue = (hash >>> 0) || 1;

  const seededRandom = () => {
    // LCG parameters
    seedValue = (seedValue * 1664525 + 1013904223) >>> 0;
    return seedValue / 0xffffffff;
  };

  // Fisher–Yates shuffle using the seeded PRNG
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
};

// Shuffle MCQ/TF/Passage options
const shuffleOptionsWithSeed = (
  options: any[],
  seed: string,
  correctOptionId: number
) => {
  const shuffledOptions = seededShuffle([...options], seed);

  const originalCorrectOption = options[correctOptionId];
  const newCorrectIndex = shuffledOptions.findIndex(
    (opt) =>
      opt.id === originalCorrectOption?.id ||
      opt.text === originalCorrectOption?.text
  );

  return {
    shuffledOptions,
    newCorrectIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0,
  };
};

// Shuffle Matching pairs (Column B)
const shuffleMatchingPairsWithSeed = (pairs: any[], seed: string) => {
  if (!pairs || pairs.length === 0) return [];

  const shuffledPairs = [...pairs];

  const columnBItems = shuffledPairs.map((pair, idx) => ({
    sideB: pair.sideB,
    correctMatch: pair.correctMatch,
    originalIndex: idx,
  }));

  const shuffledColumnB = seededShuffle(columnBItems, seed);

  const positionMap: Record<string, string> = {};
  columnBItems.forEach((item, oldIdx) => {
    const newIdx = shuffledColumnB.findIndex(
      (shuffled) => shuffled.sideB === item.sideB
    );
    if (newIdx >= 0) {
      const oldLetter = String.fromCharCode(65 + oldIdx);
      const newLetter = String.fromCharCode(65 + newIdx);
      positionMap[oldLetter] = newLetter;
    }
  });

  return shuffledPairs.map((pair, idx) => ({
    ...pair,
    sideB: shuffledColumnB[idx].sideB,
    correctMatch: positionMap[pair.correctMatch] || pair.correctMatch,
  }));
};

// --- Custom Components ---

const UnderlinedBlankInput = ({
  value,
  onChange,
  placeholder = "Type answer...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current && value) {
      const tempSpan = document.createElement("span");
      tempSpan.style.visibility = "hidden";
      tempSpan.style.position = "absolute";
      tempSpan.style.font = window.getComputedStyle(inputRef.current).font;
      tempSpan.textContent = value;
      document.body.appendChild(tempSpan);
      const width = Math.max(tempSpan.offsetWidth + 16, 80);
      tempSpan.remove();
      inputRef.current.style.width = `${Math.min(width, 300)}px`;
    }
  }, [value]);

  return (
    <div className="relative inline-block align-middle">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-0 border-b-2 border-dashed border-primary bg-transparent text-left font-medium text-gray-800 px-2 py-1 outline-none transition-all min-w-[100px] md:min-w-[150px] max-w-[500px]"
        style={{ width: "100px" }}
      />
    </div>
  );
};

const MatchingAnswerInput = ({
  value,
  onChange,
  disabled = false,
  maxLetters = 26,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLetters?: number;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value.toUpperCase();

    const validLetters = Array.from({ length: maxLetters }, (_, i) =>
      String.fromCharCode(65 + i)
    );

    newValue = newValue
      .split("")
      .filter((char) => validLetters.includes(char))
      .join("")
      .slice(0, 1);

    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const validKeys = Array.from({ length: maxLetters }, (_, i) =>
      String.fromCharCode(65 + i).toLowerCase()
    );

    if (
      !validKeys.includes(e.key.toLowerCase()) &&
      e.key !== "Backspace" &&
      e.key !== "Delete" &&
      e.key !== "ArrowLeft" &&
      e.key !== "ArrowRight" &&
      e.key !== "Tab" &&
      e.key !== "Enter"
    ) {
      e.preventDefault();
    }
  };

  useEffect(() => {
    if (inputRef.current) {
      const width = value ? Math.max(28, value.length * 14 + 16) : 44;
      inputRef.current.style.width = `${width}px`;
    }
  }, [value]);

  return (
    <div className="relative inline-flex items-center">
      <input
        ref={inputRef}
        type="text"
        value={value || ""}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="px-1 py-1 text-center text-base font-medium border-0 border-b-2 border border-gray-600 focus:border-blue-600 focus:outline-none bg-transparent min-w-[36px] md:min-w-[44px] max-w-[60px]"
        maxLength={1}
        style={{ width: "36px" }}
      />
    </div>
  );
};

// Modern Passage Display Component
const ModernPassageDisplay = ({
  passageHtml,
  isExpanded = false,
  onToggle,
}: {
  passageHtml: string;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  if (!passageHtml) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BookText className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-700">Reading Passage</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Collapse</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Expand</span>
            </>
          )}
        </Button>
      </div>

      <div
        className={cn(
          "bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100 rounded-xl p-4 transition-all duration-300",
          isExpanded
            ? "max-h-[500px] overflow-y-auto"
            : "max-h-[200px] overflow-hidden"
        )}
      >
        <div
          className="prose prose-sm md:prose-lg max-w-none p-2 md:p-3 bg-white/70 rounded-lg backdrop-blur-sm"
          dangerouslySetInnerHTML={{ __html: passageHtml }}
        />
      </div>

      {!isExpanded && (
        <div className="mt-2 text-center">
          <div className="inline-flex items-center gap-1 text-xs md:text-sm text-blue-600 bg-blue-50 px-2 py-1 md:px-3 md:py-1 rounded-full">
            <ScrollText className="h-3 w-3" />
            <span className="hidden sm:inline">
              Click "Expand" to read full passage
            </span>
            <span className="sm:hidden">Tap to expand passage</span>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Modals ---

function FullscreenWarningModal({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md mx-4 text-center">
        <div className="w-12 h-12 md:w-16 md:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Maximize className="h-6 w-6 md:h-8 md:w-8 text-red-600" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">
          Fullscreen Required
        </h2>
        <p className="text-gray-600 mb-6 text-sm md:text-base">
          Exam setting requires fullscreen mode. Please enter fullscreen to
          continue.
        </p>
        <Button
          onClick={onRetry}
          className="w-full bg-red-600 hover:bg-red-700 text-base md:text-lg py-3"
        >
          Return to Fullscreen
        </Button>
      </div>
    </div>
  );
}

function SessionTerminatedModal({
  onClose,
  reason = "Session terminated due to security violation",
}: {
  onClose: () => void;
  reason?: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md mx-4 text-center">
        <div className="w-12 h-12 md:w-16 md:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Ban className="h-6 w-6 md:h-8 md:w-8 text-red-600" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">
          Session Terminated
        </h2>
        <p className="text-gray-600 mb-6 text-sm md:text-base">{reason}</p>
        <Button
          onClick={onClose}
          className="w-full bg-red-600 hover:bg-red-700"
        >
          Return to Home
        </Button>
      </div>
    </div>
  );
}

// Updated Passage Modal with modern design
function PassageModal({
  isOpen,
  onClose,
  passageHtml,
  questionNumber,
}: {
  isOpen: boolean;
  onClose: () => void;
  passageHtml: string;
  questionNumber: number;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-w-[95vw] h-[85vh] flex flex-col p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 md:p-6">
          <DialogHeader className="text-white">
            <div className="flex items-center gap-2 md:gap-3">
              <BookText className="h-5 w-5 md:h-6 md:w-6" />
              <div>
                <DialogTitle className="text-lg md:text-xl">
                  Reading Passage
                </DialogTitle>
                <DialogDescription className="text-blue-100">
                  For Question {questionNumber}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-4 md:p-8 border border-gray-200">
              <div
                className="prose prose-sm md:prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: passageHtml }}
              />
            </div>
          </div>
        </div>

        <div className="border-t p-4 bg-gray-50 flex justify-end">
          <Button
            onClick={onClose}
            className="bg-zinc-900 hover:bg-zinc-700 text-white text-sm md:text-base transition-colors"
          >
            Return to Question
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Floating Mobile Navigation Bar (mobile drawer using Sheet)
const FloatingMobileNavBar = ({
  currentQuestionIndex,
  questions,
  answers,
  flaggedQuestions,
  onQuestionSelect,
  isOpen,
  setIsOpen,
}: {
  currentQuestionIndex: number;
  questions: any[];
  answers: any[];
  flaggedQuestions: Set<number>;
  onQuestionSelect: (index: number) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const answeredCount = answers.filter(
    (a) => a !== null && a !== undefined
  ).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        side="bottom"
        className="h-[80vh] rounded-t-3xl px-0 pt-2 pb-4 bg-[#F7F7F4]"
      >
        <div className="px-4 pb-3 border-b border-[#e3e3dd] rounded-t-3xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm text-gray-800">
              Question navigator
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center justify-between text-xs text-gray-600 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>Answered: {answeredCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                <span>Unanswered: {unansweredCount}</span>
              </div>
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[11px]",
                  viewMode === "grid"
                    ? "bg-white text-gray-900 border border-[#e3e3dd]"
                    : "bg-transparent text-gray-600 border border-transparent"
                )}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[11px]",
                  viewMode === "list"
                    ? "bg-white text-gray-900 border border-[#e3e3dd]"
                    : "bg-transparent text-gray-600 border border-transparent"
                )}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {/* Questions Grid/List */}
        <div className="px-4 pt-3 overflow-y-auto max-h-[calc(80vh-64px)]">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-5 gap-2">
              {questions.map((_, i) => {
                const isAnswered =
                  answers[i] !== null && answers[i] !== undefined;
                const isCurrent = currentQuestionIndex === i;
                const isFlagged = flaggedQuestions.has(i);

                return (
                  <button
                    key={i}
                    onClick={() => {
                      onQuestionSelect(i);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "h-10 w-10 md:h-12 md:w-12 p-0 flex items-center justify-center rounded-lg border text-sm md:text-lg font-medium transition-all bg-white",
                      isCurrent && "border-blue-500 text-blue-600",
                      isAnswered && !isCurrent && "bg-[#f4f4ef]",
                      isFlagged && "border-amber-400"
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {questions.map((_, i) => {
                const isAnswered =
                  answers[i] !== null && answers[i] !== undefined;
                const isCurrent = currentQuestionIndex === i;
                const isFlagged = flaggedQuestions.has(i);

                return (
                  <button
                    key={i}
                    onClick={() => {
                      onQuestionSelect(i);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-all bg-white",
                      isCurrent && "border-blue-500 text-blue-600",
                      isAnswered && !isCurrent && "bg-[#f4f4ef]",
                      isFlagged && "border-amber-400"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center font-medium",
                          isCurrent
                            ? "bg-blue-600 text-white"
                            : isAnswered
                            ? "bg-green-500 text-white"
                            : "bg-gray-400 text-white"
                        )}
                      >
                        {i + 1}
                      </div>
                      <span className="font-medium">Question {i + 1}</span>
                      {isFlagged && (
                        <Flag className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        isAnswered
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      )}
                    >
                      {isAnswered ? "Answered" : "Not answered"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// --- Main Component ---

export default function ExamTakingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [examStatus, setExamStatus] = useState<
    "loading" | "instructions" | "in-progress" | "completed" | "terminated"
  >("loading");
  const [examData, setExamData] = useState<any>(null);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [flaggedQuestions, setFlaggedQuestions] = useState(
    () => new Set<number>()
  );
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Security States
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>("");
  const [ipAddress, setIpAddress] = useState<string>("");
  const [securityToken, setSecurityToken] = useState<string>("");
  const [securityInitialized, setSecurityInitialized] = useState(false);
  const [sessionMonitor, setSessionMonitor] =
    useState<EnhancedSessionMonitor | null>(null);

  // Timer States
  const [timeLeft, setTimeLeft] = useState(0);
  const timeLeftRef = useRef(0);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showPassageModal, setShowPassageModal] = useState(false);
  const [showFullQuestionModal, setShowFullQuestionModal] = useState(false);
  const [currentPassageHtml, setCurrentPassageHtml] = useState("");
  const [isTimerVisible, setIsTimerVisible] = useState(true);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);
  const [passageExpanded, setPassageExpanded] = useState(false);
  const [showSessionTerminated, setShowSessionTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "poor"
  >("connected");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Refs
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const examDurationRef = useRef<number>(0);
  const autoSubmitTriggeredRef = useRef<boolean>(false);
  const lastFullscreenCheckRef = useRef<number>(0);
  const sessionMonitorRef = useRef<EnhancedSessionMonitor | null>(null);
  const lastAnswerSaveRef = useRef<number>(0);

  // Refs to track latest state for timer callback
  const questionsRef = useRef<any[]>([]);
  const answersRef = useRef<any[]>([]);
  const examDataRef = useRef<any>(null);
  const studentInfoRef = useRef<any>(null);
  const sessionIdRef = useRef<string | null>(null);
  const securityTokenRef = useRef<string>("");

  // Keep refs updated with latest state
  useEffect(() => {
    questionsRef.current = questions;
    answersRef.current = answers;
    examDataRef.current = examData;
    studentInfoRef.current = studentInfo;
    sessionIdRef.current = sessionId;
    securityTokenRef.current = securityToken;
  }, [questions, answers, examData, studentInfo, sessionId, securityToken]);

  // Initialize device fingerprinting
  useEffect(() => {
    const initializeSecurity = async () => {
      try {
        const fingerprint = await getBrowserFingerprint();
        setDeviceFingerprint(fingerprint);

        // Check stored fingerprint (from login)
        const storedFingerprint = localStorage.getItem("device_fingerprint");
        const storedToken = localStorage.getItem("security_token");

        if (storedFingerprint && storedToken) {
          setSecurityToken(storedToken);
          securityTokenRef.current = storedToken;
        }

        setSecurityInitialized(true);
      } catch (error) {
        console.error("Failed to initialize security:", error);
        setSecurityInitialized(true);
      }
    };

    initializeSecurity();
  }, []);

  // Initialize Session Monitor
  useEffect(() => {
    if (
      sessionId &&
      securityToken &&
      deviceFingerprint &&
      examStatus === "in-progress"
    ) {
      const monitor = new EnhancedSessionMonitor(
        sessionId,
        securityToken,
        deviceFingerprint,
        handleSessionInvalidation,
        () => {
          router.push("/");
        }
      );

      // Set time remaining callback
      monitor.setTimeRemainingCallback(() => timeLeftRef.current);

      monitor.start();
      sessionMonitorRef.current = monitor;
      setSessionMonitor(monitor);

      console.log("Session monitor initialized for device:", deviceFingerprint);

      return () => {
        if (sessionMonitorRef.current) {
          sessionMonitorRef.current.stop();
          sessionMonitorRef.current = null;
        }
      };
    }
  }, [sessionId, securityToken, deviceFingerprint, examStatus, router]);

  // Handle session invalidation
  const handleSessionInvalidation = async (reason: string) => {
    setTerminationReason(reason);
    setShowSessionTerminated(true);
    setExamStatus("terminated");

    // Clean up
    if (sessionMonitorRef.current) {
      sessionMonitorRef.current.stop();
    }

    // Stop timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Exit fullscreen if active
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.log("Fullscreen exit failed:", err);
      }
    }

    // Clear session data
    localStorage.removeItem("examSession");
    localStorage.removeItem("security_token");
  };

  // Check device ownership on load
  const checkDeviceOwnership = async (sessionId: string, token: string) => {
    try {
      const { data: security, error } = await supabase
        .from("session_security")
        .select("device_fingerprint, is_active")
        .eq("session_id", sessionId)
        .eq("token", token)
        .single();

      if (error || !security) {
        return { valid: false, reason: "Security record not found" };
      }

      if (!security.is_active) {
        return { valid: false, reason: "Session is not active" };
      }

      // Check if device fingerprint matches
      const storedFingerprint = localStorage.getItem("device_fingerprint");
      if (security.device_fingerprint !== storedFingerprint) {
        return {
          valid: false,
          reason: "Device mismatch. This session belongs to another device.",
        };
      }

      return { valid: true };
    } catch (error) {
      console.error("Device ownership check error:", error);
      return { valid: false, reason: "Check failed" };
    }
  };

  // Initialization
  useEffect(() => {
    setWindowWidth(window.innerWidth);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Keep time ref updated
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // --- Load Data with Shuffling and Randomization ---
  useEffect(() => {
    const loadExamData = async () => {
      try {
        const studentId = searchParams.get("student");
        const examCode = searchParams.get("exam");
        const sessionParam = searchParams.get("session");
        const tokenParam = searchParams.get("token");

        if (!studentId || !examCode) {
          toast.error("Invalid URL");
          router.push("/");
          return;
        }

        // Get student info
        const { data: student } = await supabase
          .from("students")
          .select("*")
          .eq("student_id", studentId)
          .single();

        if (!student) {
          toast.error("Student not found");
          return;
        }
        setStudentInfo(student);
        studentInfoRef.current = student;

        // Get exam data WITH ALL SETTINGS
        const { data: exam } = await supabase
          .from("exams")
          .select("*")
          .eq("exam_code", examCode)
          .single();

        if (!exam) {
          toast.error("Exam not found");
          return;
        }

        // Check if exam is active
        if (!exam.exam_active) {
          toast.error("This exam is no longer active");
          router.push("/");
          return;
        }

        setExamData(exam);
        examDataRef.current = exam;
        examDurationRef.current = exam.duration * 60;

        // Fetch Questions
        const { data: qData } = await supabase
          .from("questions")
          .select("*")
          .eq("exam_id", exam.id)
          .order("id");

        if (!qData || qData.length === 0) {
          toast.error("No questions found");
          return;
        }

        // Process questions
        const processedQuestions = qData.map((q, originalIndex) => {
          const { passageHtml, questionText, hasPassage } = parseQuestionText(
            q.question_text
          );

          // Determine question type
          let type = "mcq";
          if (q.question_type === "matching") type = "matching";
          else if (q.question_type === "fill_blank") type = "blank";
          else if (q.question_type === "true_false") type = "tf";
          else if (passageHtml) type = "passage";

          // Parse options for MCQ/TF/Passage
          let options: any[] = [];
          let correct_option_id = q.correct_option_id || 0;

          if (q.options) {
            try {
              const parsed =
                typeof q.options === "string"
                  ? JSON.parse(q.options)
                  : q.options;
              if (parsed && parsed.options) {
                options = parsed.options.map((text: string, i: number) => ({
                  id: i,
                  text,
                  image: parsed.option_images?.[i] || null,
                }));
              }
            } catch (e) {
              console.error("Error parsing options:", e);
            }
          }

          // Parse metadata for matching and blank questions
          let matchingPairs: any[] = [];
          let matchingInstructions = "";
          let blanks: any[] = [];
          let rawMetadata: any = null;

          if (q.metadata) {
            try {
              rawMetadata =
                typeof q.metadata === "string"
                  ? JSON.parse(q.metadata)
                  : q.metadata;

              if (type === "matching") {
                matchingPairs = rawMetadata.pairs || [];
                matchingInstructions = rawMetadata.instructions || "";

                // Ensure each pair has correctMatch
                matchingPairs = matchingPairs.map((pair: any, idx: number) => ({
                  ...pair,
                  correctMatch:
                    pair.correctMatch || String.fromCharCode(65 + idx),
                }));
              } else if (type === "blank") {
                blanks = rawMetadata.blanks || [];
                blanks = blanks.map((blank: any) => ({
                  ...blank,
                  correctAnswer: blank.correctAnswer || blank.answer || "",
                }));
              }
            } catch (e) {
              console.error("Error parsing metadata:", e);
            }
          }

          return {
            ...q,
            type,
            question_text: questionText,
            passage_html: passageHtml,
            has_passage: hasPassage,
            options,
            blanks,
            matchingPairs,
            matchingInstructions,
            raw_metadata: rawMetadata,
            marks: q.marks || 1,
            correct_option_id,
            original_index: originalIndex,
          };
        });

        // Create a per-student, per-exam shuffle seed.
        // We persist a random seed in localStorage so order is:
        // - Truly randomized per student
        // - Stable across reloads/resume for that student+exam
        const baseShuffleSeed = `${student.id}-${exam.id}-${exam.exam_code}`;
        let shuffleSeed = baseShuffleSeed;
        try {
          const seedKey = `exam_shuffle_seed_${student.id}_${exam.id}`;
          const stored = localStorage.getItem(seedKey);
          if (stored) {
            shuffleSeed = stored;
          } else {
            let randomPart = "";
            if (typeof crypto !== "undefined" && crypto.getRandomValues) {
              const buffer = new Uint32Array(2);
              crypto.getRandomValues(buffer);
              randomPart = Array.from(buffer)
                .map((n) => n.toString(16))
                .join("");
            } else {
              randomPart = `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}`;
            }
            shuffleSeed = `${baseShuffleSeed}-${randomPart}`;
            localStorage.setItem(seedKey, shuffleSeed);
          }
        } catch {
          // Fallback: keep baseShuffleSeed if localStorage/crypto unavailable
        }
        let finalQuestions = processedQuestions;

        // SHUFFLE QUESTIONS if enabled in exam settings (treat null as true)
        if (exam.questions_shuffled !== false) {
          finalQuestions = seededShuffle(processedQuestions, shuffleSeed);
        }

        // RANDOMIZE OPTIONS if enabled in exam settings (treat null as true)
        if (exam.options_shuffled !== false) {
          finalQuestions = finalQuestions.map((q) => {
            if (
              (q.type === "mcq" || q.type === "tf" || q.type === "passage") &&
              q.options.length > 0
            ) {
              const optionSeed = shuffleSeed + q.id;
              const { shuffledOptions, newCorrectIndex } =
                shuffleOptionsWithSeed(
                  q.options,
                  optionSeed,
                  q.correct_option_id
                );

              return {
                ...q,
                options: shuffledOptions,
                correct_option_id: newCorrectIndex,
              };
            }
            return q;
          });
        }

        // SHUFFLE MATCHING PAIRS if enabled
        if (exam.options_shuffled !== false) {
          finalQuestions = finalQuestions.map((q) => {
            if (
              q.type === "matching" &&
              q.matchingPairs &&
              q.matchingPairs.length > 0
            ) {
              const pairSeed = shuffleSeed + q.id + "-matching";
              const shuffledPairs = shuffleMatchingPairsWithSeed(
                q.matchingPairs,
                pairSeed
              );

              return {
                ...q,
                matchingPairs: shuffledPairs,
              };
            }
            return q;
          });
        }

        setQuestions(finalQuestions);
        questionsRef.current = finalQuestions;

        // Initialize answers structure
        const initialAnswers = finalQuestions.map((q) => {
          if (q.type === "matching") {
            return Array(q.matchingPairs?.length || 0).fill(null);
          } else if (q.type === "blank") {
            const answerObj: Record<string, string> = {};
            q.blanks?.forEach((blank: any) => {
              answerObj[blank.id] = "";
            });
            return answerObj;
          }
          return null;
        });

        setAnswers(initialAnswers);
        answersRef.current = initialAnswers;

        // Check for existing session (resume or new)
        let activeSession = null;
        let sessionToken = tokenParam;

        // If session ID is provided in URL, try to resume that specific session
        if (sessionParam) {
          const { data: session } = await supabase
            .from("exam_sessions")
            .select("*")
            .eq("id", sessionParam)
            .eq("student_id", student.id)
            .eq("exam_id", exam.id)
            .eq("status", "in_progress")
            .single();

          activeSession = session;

          if (activeSession && !sessionToken) {
            sessionToken = activeSession.security_token;
          }
        } else {
          // Otherwise look for any active session
          const { data: activeSessions } = await supabase
            .from("exam_sessions")
            .select("*")
            .eq("student_id", student.id)
            .eq("exam_id", exam.id)
            .eq("status", "in_progress");

          activeSession =
            activeSessions && activeSessions.length > 0
              ? activeSessions[0]
              : null;

          if (activeSession && !sessionToken) {
            sessionToken = activeSession.security_token;
          }
        }

        if (activeSession) {
          // Check if session is already submitted
          if (activeSession.status === "submitted") {
            toast.error("You have already submitted this exam");
            router.push("/");
            return;
          }

          // Validate device ownership
          if (sessionToken) {
            const deviceCheck = await checkDeviceOwnership(
              activeSession.id,
              sessionToken
            );
            if (!deviceCheck.valid) {
              toast.error(deviceCheck.reason || "Device validation failed");
              router.push("/");
              return;
            }
          }

          // Store security token
          if (sessionToken) {
            setSecurityToken(sessionToken);
            securityTokenRef.current = sessionToken;
            localStorage.setItem("security_token", sessionToken);
          }

          // Resume existing session
          setSessionId(activeSession.id);
          sessionIdRef.current = activeSession.id;
          const remaining =
            activeSession.time_remaining !== null
              ? activeSession.time_remaining
              : examDurationRef.current;
          setTimeLeft(remaining);
          timeLeftRef.current = remaining;

        // Load saved answers
        const { data: savedAnswers } = await supabase
          .from("student_answers")
          .select("*")
          .eq("session_id", activeSession.id);

        const hasSavedAnswers =
          Array.isArray(savedAnswers) && savedAnswers.length > 0;

        if (hasSavedAnswers) {
          const restoredAnswers = [...initialAnswers];
          const restoredFlags = new Set<number>();

          savedAnswers.forEach((sa: any) => {
            const idx = finalQuestions.findIndex(
              (q) => q.id === sa.question_id
            );
            if (idx > -1) {
              try {
                if (sa.answer_text) {
                  const parsed = JSON.parse(sa.answer_text);

                  if (finalQuestions[idx].type === "matching") {
                    if (
                      typeof parsed === "object" &&
                      !Array.isArray(parsed)
                    ) {
                      const pairCount =
                        finalQuestions[idx].matchingPairs?.length || 0;
                      const answerArray = Array(pairCount).fill(null);
                      Object.entries(parsed).forEach(([key, value]) => {
                        const index = parseInt(key);
                        if (
                          !isNaN(index) &&
                          index >= 0 &&
                          index < pairCount
                        ) {
                          answerArray[index] = value;
                        }
                      });
                      restoredAnswers[idx] = answerArray;
                    } else {
                      restoredAnswers[idx] = parsed;
                    }
                  } else {
                    restoredAnswers[idx] = parsed;
                  }
                } else {
                  restoredAnswers[idx] = sa.selected_option_id;
                }
              } catch {
                restoredAnswers[idx] =
                  sa.answer_text || sa.selected_option_id;
              }
              if (sa.is_flagged) restoredFlags.add(idx);
            }
          });

          setAnswers(restoredAnswers);
          answersRef.current = restoredAnswers;
          setFlaggedQuestions(restoredFlags);
        }

        const hasProgress =
          hasSavedAnswers ||
          (typeof activeSession.time_remaining === "number" &&
            activeSession.time_remaining < examDurationRef.current);

        if (hasProgress) {
          // Resume directly into exam when there is any progress
          // (saved answers or time already spent in this session)
          setExamStatus("in-progress");

          // Enter fullscreen if required
          if (exam.fullscreen_required) {
            try {
              await document.documentElement.requestFullscreen();
            } catch (err) {
              console.log("Fullscreen request failed:", err);
            }
          }
        } else {
          // First-time start for this exam session -> show instructions once
          setExamStatus("instructions");
        }
        } else {
          // Check if exam was already submitted
          const { data: existingResult } = await supabase
            .from("results")
            .select("*")
            .eq("student_id", student.id)
            .eq("exam_id", exam.id)
            .single();

          if (existingResult) {
            toast.error("You have already completed this exam");
            router.push("/");
            return;
          }

          // New session - show instructions
          setExamStatus("instructions");
        }
      } catch (err) {
        console.error("Error loading exam data:", err);
        toast.error("Error loading exam");
      }
    };

    loadExamData();
  }, [searchParams, router]);

  // --- Calculate Score Function ---
  const calculateScore = (questions: any[], answers: any[]) => {
    let totalMarks = 0;
    let correctCount = 0;
    let questionResults: any[] = [];

    questions.forEach((q, i) => {
      const studentAns = answers[i];
      const marksPerQuestion = q.marks || 1;
      let earnedMarks = 0;
      let isFullyCorrect = false;

      if (studentAns !== null && studentAns !== undefined) {
        if (q.type === "mcq" || q.type === "tf" || q.type === "passage") {
          if (studentAns === q.correct_option_id) {
            earnedMarks = marksPerQuestion;
            correctCount++;
            isFullyCorrect = true;
          }
        } else if (q.type === "matching") {
          const correctPairs = q.matchingPairs || q.raw_metadata?.pairs || [];
          if (correctPairs.length === 0) {
            questionResults.push({ questionIndex: i, earnedMarks: 0 });
            return;
          }

          let correctMatches = 0;
          const studentAnswers = Array.isArray(studentAns) ? studentAns : [];
          const marksPerMatch = marksPerQuestion / correctPairs.length;

          correctPairs.forEach((pair: any, idx: number) => {
            const studentAnswer = studentAnswers[idx];
            const correctAnswer = pair.correctMatch;

            if (
              studentAnswer &&
              correctAnswer &&
              studentAnswer.toString().toUpperCase() ===
                correctAnswer.toString().toUpperCase()
            ) {
              correctMatches++;
              earnedMarks += marksPerMatch;
            }
          });

          earnedMarks = Math.round(earnedMarks * 100) / 100;

          if (correctMatches === correctPairs.length) {
            correctCount++;
            isFullyCorrect = true;
          }
        } else if (q.type === "blank") {
          const correctBlanks = q.blanks || q.raw_metadata?.blanks || [];
          if (correctBlanks.length === 0) {
            questionResults.push({ questionIndex: i, earnedMarks: 0 });
            return;
          }

          let correctBlanksCount = 0;
          const studentAnswers = studentAns as Record<string, string>;
          const marksPerBlank = marksPerQuestion / correctBlanks.length;

          correctBlanks.forEach((blank: any) => {
            const studentVal = studentAnswers[blank.id]?.trim();
            const correctVal = blank.correctAnswer?.trim();

            if (
              studentVal &&
              correctVal &&
              studentVal.toLowerCase() === correctVal.toLowerCase()
            ) {
              correctBlanksCount++;
              earnedMarks += marksPerBlank;
            }
          });

          earnedMarks = Math.round(earnedMarks * 100) / 100;

          if (correctBlanksCount === correctBlanks.length) {
            correctCount++;
            isFullyCorrect = true;
          }
        }
      }

      totalMarks += earnedMarks;
      questionResults.push({
        questionIndex: i,
        earnedMarks,
        isFullyCorrect,
      });
    });

    totalMarks = Math.round(totalMarks * 100) / 100;

    const totalPossibleMarks = questions.reduce((sum, q) => {
      return sum + (q.marks || 1);
    }, 0);

    const percent = Math.round((totalMarks / totalPossibleMarks) * 100) || 0;

    return {
      totalMarks,
      totalPossibleMarks,
      percent,
      correctCount,
      totalQuestions: questions.length,
      timeSpent: examDurationRef.current - timeLeft,
      questionResults,
    };
  };

  // --- Submit Function (used by both manual and auto-submit) ---
  const submitExam = async (isAutoSubmit = false) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Get current data from refs to ensure we have latest
      const currentQuestions = questionsRef.current;
      const currentAnswers = answersRef.current;
      const currentExamData = examDataRef.current;
      const currentStudentInfo = studentInfoRef.current;
      const currentSessionId = sessionIdRef.current;
      const currentSecurityToken = securityTokenRef.current;

      if (
        !currentQuestions ||
        !currentAnswers ||
        !currentExamData ||
        !currentStudentInfo ||
        !currentSessionId ||
        !currentSecurityToken
      ) {
        console.error("Missing data for submission");
        toast.error("Cannot submit: missing exam data");
        return;
      }

      // Validate session before submission
      if (
        sessionMonitorRef.current &&
        !sessionMonitorRef.current.isSessionActive()
      ) {
        toast.error("Session is no longer active");
        return;
      }

      // Calculate score using current data
      const result = calculateScore(currentQuestions, currentAnswers);

      if (isAutoSubmit) {
        console.log("Auto-submitting with score:", result.totalMarks);
      }

      setSubmissionResult(result);

      // Stop session monitor first
      if (sessionMonitorRef.current) {
        sessionMonitorRef.current.stop();
      }

      // Update Session
      const { error: sessionError } = await supabase
        .from("exam_sessions")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
          time_remaining: 0,
          score: result.totalMarks,
        })
        .eq("id", currentSessionId);

      if (sessionError) {
        console.error("Error updating session:", sessionError);
        throw sessionError;
      }

      // Update session security
      await supabase
        .from("session_security")
        .update({ is_active: false })
        .eq("session_id", currentSessionId)
        .eq("token", currentSecurityToken);

      // Save Results (NO GRADE COLUMN)
      const { error: resultError } = await supabase.from("results").upsert(
        {
          exam_id: currentExamData.id,
          student_id: currentStudentInfo.id,
          teacher_id: currentExamData.created_by,
          total_marks_obtained: result.totalMarks,
          comments: `Auto-graded: ${result.correctCount}/${result.totalQuestions} questions correct, ${result.totalMarks}/${result.totalPossibleMarks} total points (${result.percent}%)`,
          submission_time: new Date().toISOString(),
        },
        { onConflict: "exam_id,student_id" }
      );

      if (resultError) {
        console.error("Error saving results:", resultError);
        throw resultError;
      }

      // Update question answers with correctness
      const updatePromises = result.questionResults.map(
        async (questionResult) => {
          const q = currentQuestions[questionResult.questionIndex];
          const studentAns = currentAnswers[questionResult.questionIndex];

          if (currentSessionId) {
            let isCorrect = false;

            if (q.type === "mcq" || q.type === "tf" || q.type === "passage") {
              isCorrect = studentAns === q.correct_option_id;
            } else if (q.type === "matching") {
              isCorrect = questionResult.isFullyCorrect;
            } else if (q.type === "blank") {
              isCorrect = questionResult.isFullyCorrect;
            }

            return supabase
              .from("student_answers")
              .update({ is_correct: isCorrect })
              .eq("session_id", currentSessionId)
              .eq("question_id", q.id);
          }
        }
      );

      await Promise.all(updatePromises);

      // Update local state
      setExamStatus("completed");

      // Exit fullscreen if active
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch (err) {
          console.log("Fullscreen exit failed:", err);
        }
      }

      // Clear session data
      localStorage.removeItem("examSession");
      localStorage.removeItem("security_token");

      if (isAutoSubmit) {
        toast.info("Exam auto-submitted due to time expiration");
      } else {
        toast.success("Exam submitted successfully!");
      }

      console.log("Submission successful. Score:", result.totalMarks);
    } catch (e) {
      console.error("Error submitting exam:", e);
      toast.error("Submit failed");
      // Don't set status to completed if submission failed
      setExamStatus("in-progress");
    } finally {
      setIsSubmitting(false);
      autoSubmitTriggeredRef.current = false;
    }
  };

  // --- Timer & Sync ---
  useEffect(() => {
    if (examStatus === "in-progress" && sessionId) {
      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const newValue = Math.max(0, prev - 1);

          // Check for auto-submit when time reaches 0
          if (newValue === 0 && !autoSubmitTriggeredRef.current) {
            autoSubmitTriggeredRef.current = true;

            // Clear the timer interval immediately
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }

            // Auto-submit with current data
            console.log("Time's up! Auto-submitting...");
            submitExam(true);
          }

          return newValue;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [examStatus, sessionId]);

  // --- Fullscreen Check ---
  useEffect(() => {
    const checkFullscreen = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreenActive(isFs);
      if (
        examData?.fullscreen_required &&
        examStatus === "in-progress" &&
        !isFs &&
        Date.now() - lastFullscreenCheckRef.current > 3000
      ) {
        setShowFullscreenWarning(true);
        lastFullscreenCheckRef.current = Date.now();
      }
    };

    const interval = setInterval(checkFullscreen, 2000);
    return () => clearInterval(interval);
  }, [examStatus, examData]);

  // --- Network Connection Monitor ---
  useEffect(() => {
    const handleOnline = () => {
      setConnectionStatus("connected");
    };

    const handleOffline = () => {
      setConnectionStatus("disconnected");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // --- Keyboard & shortcut restrictions (anti-cheating) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isModifier = e.ctrlKey || e.metaKey;

      // Block common copy/print/save shortcuts and print-screen
      if (
        e.key === "PrintScreen" ||
        (isModifier &&
          (key === "c" || key === "x" || key === "p" || key === "s"))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // --- Handlers ---

  const handleStartExam = async () => {
    try {
      // If a session already exists (created during login or takeover)
      // and we're currently on the instructions screen, just move into
      // the in-progress state instead of creating a new session.
      if (sessionIdRef.current && sessionId) {
        setExamStatus("in-progress");
        if (examData?.fullscreen_required) {
          try {
            await document.documentElement.requestFullscreen();
          } catch (err) {
            console.log("Fullscreen request failed:", err);
          }
        }
        return;
      }

      // Generate security token
      const newSecurityToken = [...Array(32)]
        .map(() => Math.random().toString(36)[2])
        .join("");

      const { data: newSession, error } = await supabase
        .from("exam_sessions")
        .insert({
          student_id: studentInfo.id,
          exam_id: examData.id,
          teacher_id: examData.created_by,
          status: "in_progress",
          time_remaining: examDurationRef.current,
          security_token: newSecurityToken,
          device_takeover_count: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Create session security record
      const { error: securityError } = await supabase
        .from("session_security")
        .insert({
          session_id: newSession.id,
          student_id: studentInfo.id,
          device_fingerprint: deviceFingerprint,
          ip_address: ipAddress || "unknown",
          user_agent: navigator.userAgent,
          token: newSecurityToken,
          is_active: true,
          last_verified: new Date().toISOString(),
        });

      if (securityError) {
        // Rollback session creation
        await supabase.from("exam_sessions").delete().eq("id", newSession.id);
        throw securityError;
      }

      // Store security token
      setSecurityToken(newSecurityToken);
      securityTokenRef.current = newSecurityToken;
      localStorage.setItem("security_token", newSecurityToken);

      setSessionId(newSession.id);
      sessionIdRef.current = newSession.id;
      setExamStatus("in-progress");
      setTimeLeft(examDurationRef.current);
      timeLeftRef.current = examDurationRef.current;

      if (examData.fullscreen_required) {
        try {
          await document.documentElement.requestFullscreen();
        } catch (err) {
          console.log("Fullscreen request failed:", err);
        }
      }
    } catch (err) {
      console.error("Failed to start exam:", err);
      toast.error("Failed to start exam");
    }
  };

  const handleAnswerChange = async (val: any) => {
    // Check session validity
    if (
      sessionMonitorRef.current &&
      !sessionMonitorRef.current.isSessionActive()
    ) {
      handleSessionInvalidation("Session no longer active");
      return;
    }

    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = val;
    setAnswers(newAnswers);
    answersRef.current = newAnswers;

    // Throttle answer saves to avoid too many database calls
    const now = Date.now();
    if (now - lastAnswerSaveRef.current < 1000) {
      return;
    }

    lastAnswerSaveRef.current = now;

    if (sessionId) {
      const q = questions[currentQuestionIndex];
      const payload: any = {
        session_id: sessionId,
        question_id: q.id,
        answered_at: new Date().toISOString(),
      };

      if (q.type === "mcq" || q.type === "tf" || q.type === "passage") {
        payload.selected_option_id = val;
      } else if (q.type === "matching") {
        payload.answer_text = JSON.stringify(val);
      } else {
        payload.answer_text = JSON.stringify(val);
      }

      try {
        await supabase
          .from("student_answers")
          .upsert(payload, { onConflict: "session_id,question_id" });
      } catch (error) {
        console.error("Failed to save answer:", error);
      }
    }
  };

  const handleToggleFlag = async () => {
    // Check session validity
    if (
      sessionMonitorRef.current &&
      !sessionMonitorRef.current.isSessionActive()
    ) {
      handleSessionInvalidation("Session no longer active");
      return;
    }

    const newFlags = new Set(flaggedQuestions);
    if (newFlags.has(currentQuestionIndex)) {
      newFlags.delete(currentQuestionIndex);
    } else {
      newFlags.add(currentQuestionIndex);
    }
    setFlaggedQuestions(newFlags);

    if (sessionId) {
      try {
        await supabase.from("student_answers").upsert(
          {
            session_id: sessionId,
            question_id: questions[currentQuestionIndex].id,
            is_flagged: newFlags.has(currentQuestionIndex),
          },
          { onConflict: "session_id,question_id" }
        );
      } catch (error) {
        console.error("Failed to save flag:", error);
      }
    }
  };

  const handleFinalSubmit = async () => {
    // Validate session before submission
    if (
      sessionMonitorRef.current &&
      !sessionMonitorRef.current.isSessionActive()
    ) {
      toast.error("Session is no longer active");
      return;
    }
    await submitExam(false);
  };

  const getMatchingAnswer = () => {
    const currentAnswer = answers[currentQuestionIndex];
    return Array.isArray(currentAnswer) ? currentAnswer : [];
  };

  const handleMatchSelect = (pairIndex: number, selectedLetter: string) => {
    const current = [...getMatchingAnswer()];
    while (current.length <= pairIndex) {
      current.push(null);
    }
    current[pairIndex] = selectedLetter || null;
    handleAnswerChange(current);
  };

  const getBlankAnswer = (blankId: string) => {
    const currentAnswer = answers[currentQuestionIndex];
    return currentAnswer && typeof currentAnswer === "object"
      ? currentAnswer[blankId] || ""
      : "";
  };

  const handleBlankChange = (blankId: string, value: string) => {
    const current = {
      ...((answers[currentQuestionIndex] as Record<string, string>) || {}),
    };
    current[blankId] = value;
    handleAnswerChange(current);
  };

  const stats = useMemo(
    () => ({
      answered: answers.filter((a) => {
        if (a === null || a === undefined) return false;
        if (Array.isArray(a)) {
          return a.some(
            (val) =>
              val !== null && val !== undefined && val.toString().trim() !== ""
          );
        }
        if (typeof a === "object") {
          return Object.values(a).some(
            (val: any) =>
              val !== null && val !== undefined && val.toString().trim() !== ""
          );
        }
        return a !== null && a !== undefined;
      }).length,
      unanswered: answers.filter((a) => {
        if (a === null || a === undefined) return true;
        if (Array.isArray(a)) {
          return !a.some(
            (val) =>
              val !== null && val !== undefined && val.toString().trim() !== ""
          );
        }
        if (typeof a === "object") {
          return !Object.values(a).some(
            (val: any) =>
              val !== null && val !== undefined && val.toString().trim() !== ""
          );
        }
        return a === null || a === undefined;
      }).length,
      flagged: flaggedQuestions.size,
    }),
    [answers, flaggedQuestions]
  );

  const currentQ = questions[currentQuestionIndex];
  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;

  // --- Render Views ---

  if (examStatus === "loading") {
    return <ExamPageSpinner />;
  }

  if (examStatus === "instructions") {
    return (
      <div
        className="flex items-center justify-center min-h-screen p-4 select-none"
        style={{ backgroundColor: "#F7F7F4" }}
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
      >
        <Card className="w-full max-w-2xl shadow-xl border-0">
          <CardHeader className="text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
            <CardTitle className="text-lg md:text-2xl font-bold">
              {examData?.title}
            </CardTitle>
            <p className="text-blue-100 pt-1 text-xs md:text-sm">
              Read all instructions carefully before you begin.
            </p>
          </CardHeader>
          <CardContent className="space-y-6 p-4 md:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 md:p-4 bg-blue-50 rounded-lg border border-blue-100 text-center">
                <p className="text-xs md:text-sm font-medium text-blue-600">
                  Duration
                </p>
                <p className="text-base md:text-xl font-bold text-gray-900">
                  {examData?.duration} Min
                </p>
              </div>
              <div className="p-3 md:p-4 bg-indigo-50 rounded-lg border border-indigo-100 text-center">
                <p className="text-xs md:text-sm font-medium text-indigo-600">
                  Questions
                </p>
                <p className="text-base md:text-xl font-bold text-gray-900">
                  {questions.length}
                </p>
              </div>
            </div>

            {examData?.description && (
              <div className="rounded-xl border border-amber-200 bg-white/90 shadow-sm">
                <div className="flex items-start gap-2 p-3 md:p-4 border-b border-amber-100 bg-amber-50/80">
                  <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900 text-xs md:text-sm uppercase tracking-wide">
                      Exam Instructions
                    </p>
                    <p className="text-[11px] md:text-xs text-amber-800 mt-0.5">
                      These instructions were prepared by your teacher. Please read them fully.
                    </p>
                  </div>
                </div>
                <div className="p-3 md:p-4 max-h-64 md:max-h-80 overflow-y-auto bg-amber-50/40">
                  <div
                    className="prose prose-sm md:prose-base max-w-none text-slate-800 [&_p]:mb-2 [&_p:last-child]:mb-0"
                    dangerouslySetInnerHTML={{ __html: examData.description }}
                  />
                </div>
              </div>
            )}

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-3 md:p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2 md:mb-3">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                <p className="font-bold text-blue-800 text-xs md:text-sm">
                  Exam Settings:
                </p>
              </div>
              <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-blue-800">
                {examData?.questions_shuffled && (
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 md:h-2 md:w-2 rounded-full bg-blue-600"></div>
                    <span>
                      <strong>Questions are randomized</strong> - Each student
                      gets different order
                    </span>
                  </li>
                )}
                {examData?.options_shuffled && (
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 md:h-2 md:w-2 rounded-full bg-blue-600"></div>
                    <span>
                      <strong>Options are shuffled</strong> - Answer choices
                      appear in different order
                    </span>
                  </li>
                )}
                {examData?.fullscreen_required && (
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 md:h-2 md:w-2 rounded-full bg-blue-600"></div>
                    <span>
                      <strong>Fullscreen required</strong> - You must stay in
                      fullscreen mode
                    </span>
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 md:h-2 md:w-2 rounded-full bg-blue-600"></div>
                  <span>
                    <strong>Device locking enabled</strong> - One device per
                    student only
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 md:h-2 md:w-2 rounded-full bg-blue-600"></div>
                  <span>
                    <strong>Auto-save enabled</strong> - Answers are saved
                    automatically
                  </span>
                </li>
                {examData?.show_results && (
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 md:h-2 md:w-2 rounded-full bg-green-600"></div>
                    <span>
                      <strong>Results will be shown</strong> - You'll see your
                      score after submission
                    </span>
                  </li>
                )}
              </ul>
            </div>

            {deviceFingerprint && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-3 md:p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                    <span className="font-medium text-green-800 text-xs md:text-sm">
                      Device Verified
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600">Secure</span>
                  </div>
                </div>
                <p className="text-xs text-green-700 mt-1 md:mt-2">
                  Device ID: {deviceFingerprint.substring(0, 12)}...
                </p>
              </div>
            )}

            <Button
              size="lg"
              className="w-full bg-zinc-900 hover:bg-zinc-700 text-white font-semibold py-3 text-sm md:text-base transition-colors"
              onClick={handleStartExam}
              disabled={!securityInitialized}
            >
              {securityInitialized ? (
                <>
                  Start Exam Now{" "}
                  <ChevronRight className="ml-2 h-4 w-4 md:h-5 md:w-5" />
                </>
              ) : (
                <>
                  <Spinner className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                  Initializing Security...
                </>
              )}
            </Button>

            <p className="text-center text-xs md:text-sm text-gray-500">
              By starting the exam, you agree to follow all exam rules and
              guidelines.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (examStatus === "completed") {
    // Check if we should show results based on exam setting
    const shouldShowResults = examData?.show_results !== false;

    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 select-none"
        style={{ backgroundColor: "#F7F7F4" }}
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
      >
        <Card className="w-full max-w-2xl text-center shadow-2xl border-0 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 md:p-8">
            <CheckCircle2 className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4" />
            <h2 className="text-lg md:text-2xl font-bold mb-2">
              Exam Submitted Successfully!
            </h2>
            <p className="text-green-100 text-xs md:text-sm">
              Your answers have been recorded and graded.
            </p>
          </div>

          <CardContent className="p-4 md:p-8">
            {shouldShowResults && submissionResult ? (
              <div className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div className="p-3 md:p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs md:text-sm font-medium text-green-600">
                      Score Obtained
                    </p>
                      <p className="text-base md:text-xl font-bold text-gray-900">
                      {submissionResult.totalMarks} /{" "}
                      {submissionResult.totalPossibleMarks}
                    </p>
                  </div>
                  <div className="p-3 md:p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs md:text-sm font-medium text-blue-600">
                      Percentage
                    </p>
                      <p className="text-base md:text-xl font-bold text-gray-900">
                      {submissionResult.percent}%
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div className="p-3 md:p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs md:text-sm font-medium text-amber-600">
                      Correct Answers
                    </p>
                      <p className="text-base md:text-xl font-bold text-gray-900">
                      {submissionResult.correctCount} /{" "}
                      {submissionResult.totalQuestions}
                    </p>
                  </div>
                  <div className="p-3 md:p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p className="text-xs md:text-sm font-medium text-indigo-600">
                      Time Taken
                    </p>
                      <p className="text-base md:text-xl font-bold text-gray-900">
                      {formatTime(submissionResult.timeSpent)}
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 md:p-6 rounded-xl border border-blue-200">
                  <div className="flex items-center justify-center gap-2 md:gap-3 mb-3 md:mb-4">
                    <Award className="h-5 w-5 md:h-7 md:w-7 text-amber-600" />
                    <h3 className="text-base md:text-lg font-bold text-gray-800">
                      Performance Summary
                    </h3>
                  </div>
                  <div className="mt-3 md:mt-4 w-full bg-gray-200 rounded-full h-2 md:h-4">
                    <div
                      className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 md:h-4 rounded-full transition-all duration-500"
                      style={{ width: `${submissionResult.percent}%` }}
                    ></div>
                  </div>
                  <p className="text-xs md:text-sm text-gray-500 mt-2">
                    Progress: {submissionResult.percent}%
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 md:p-6 rounded-xl border border-blue-200">
                <div className="flex items-center justify-center gap-2 md:gap-3 mb-3 md:mb-4">
                  <EyeOff className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
                  <h3 className="text-lg md:text-xl font-bold text-gray-800">
                    Results Hidden
                  </h3>
                </div>
                <p className="text-gray-600 text-sm md:text-base">
                  Your exam has been submitted successfully. Results are not
                  shown immediately as per the exam settings. Your teacher will
                  notify you when results are available.
                </p>
              </div>
            )}

            <Button
              onClick={() => router.push("/")}
              className="mt-4 md:mt-6 bg-zinc-900 hover:bg-zinc-700 text-white w-full py-3 text-base md:text-lg transition-colors"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showSessionTerminated) {
    return (
      <SessionTerminatedModal
        onClose={() => router.push("/")}
        reason={terminationReason}
      />
    );
  }

  if (showFullscreenWarning) {
    return (
      <FullscreenWarningModal
        onRetry={() => {
          document.documentElement.requestFullscreen();
          setShowFullscreenWarning(false);
        }}
      />
    );
  }

  // --- Main Exam UI ---
  return (
    <div
      className="relative h-screen w-full text-gray-900 select-none text-[0.95rem] md:text-[0.98rem]"
      style={{ backgroundColor: "#F7F7F4" }}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
    >
      {examData?.fullscreen_required &&
        examStatus === "in-progress" &&
        isFullscreenActive && (
          <div className="pointer-events-none absolute inset-0 bg-[#F7F7F4]/85 backdrop-blur-md" />
        )}

      <div className="relative z-10 flex h-full">
        <PassageModal
          isOpen={showPassageModal}
          onClose={() => setShowPassageModal(false)}
          passageHtml={currentPassageHtml}
          questionNumber={currentQuestionIndex + 1}
        />

        {/* Floating Mobile Navigation */}
        {isMobile && examStatus === "in-progress" && (
          <FloatingMobileNavBar
            currentQuestionIndex={currentQuestionIndex}
            questions={questions}
            answers={answers}
            flaggedQuestions={flaggedQuestions}
            onQuestionSelect={setCurrentQuestionIndex}
            isOpen={mobileNavOpen}
            setIsOpen={setMobileNavOpen}
          />
        )}

        {/* Sidebar (Desktop) */}
        {!isMobile && (
          <aside
            className={cn(
              "bg-white border-r flex flex-col transition-all duration-300 ease-in-out shadow-lg",
              isSidebarOpen
                ? "w-64 md:w-80 p-3 md:p-4"
                : "w-0 p-0 border-0 overflow-hidden"
            )}
          >
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h3 className="text-base md:text-lg font-semibold text-gray-800">
                Question Navigator
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(false)}
                className="h-8 w-8 md:h-9 md:w-9"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
                {questions.map((_, i) => {
                  const isAnswered =
                    answers[i] !== null && answers[i] !== undefined;
                  const isCurrent = currentQuestionIndex === i;
                  const isFlagged = flaggedQuestions.has(i);

                  return (
                    <Button
                      key={i}
                      variant={
                        isCurrent
                          ? "default"
                          : isAnswered
                          ? "secondary"
                          : "outline"
                      }
                      className={cn(
                        "h-10 w-10 md:h-12 md:w-12 p-0 relative text-sm md:text-lg font-medium transition-all",
                        isAnswered &&
                          !isCurrent &&
                          "bg-green-100 text-green-800 border-green-300 hover:bg-green-200",
                        isFlagged && "border-amber-300"
                      )}
                      onClick={() => setCurrentQuestionIndex(i)}
                    >
                      {isFlagged && (
                        <Flag className="absolute -top-1 -right-1 h-3 w-3 md:h-4 md:w-4 text-amber-500 fill-amber-500" />
                      )}
                      {i + 1}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto pt-4 md:pt-6 border-t space-y-2 md:space-y-3">
              <div className="flex justify-between items-center text-green-600 bg-green-50 p-2 md:p-3 rounded-lg">
                <span className="flex items-center gap-1 md:gap-2 font-medium text-sm md:text-base">
                  <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4" /> Answered
                </span>
                <span className="font-bold text-base md:text-lg">
                  {stats.answered}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600 bg-gray-50 p-2 md:p-3 rounded-lg">
                <span className="flex items-center gap-1 md:gap-2 font-medium text-sm md:text-base">
                  <HelpCircle className="h-3 w-3 md:h-4 md:w-4" /> Unanswered
                </span>
                <span className="font-bold text-base md:text-lg">
                  {stats.unanswered}
                </span>
              </div>
              <div className="flex justify-between items-center text-amber-600 bg-amber-50 p-2 md:p-3 rounded-lg">
                <span className="flex items-center gap-1 md:gap-2 font-medium text-sm md:text-base">
                  <Flag className="h-3 w-3 md:h-4 md:w-4" /> Flagged
                </span>
                <span className="font-bold text-base md:text-lg">
                  {stats.flagged}
                </span>
              </div>

              {/* Security Status */}
              <div
                className={cn(
                  "flex justify-between items-center p-2 md:p-3 rounded-lg text-sm md:text-base",
                  connectionStatus === "connected"
                    ? "text-blue-600 bg-blue-50"
                    : connectionStatus === "disconnected"
                    ? "text-red-600 bg-red-50"
                    : "text-amber-600 bg-amber-50"
                )}
              >
                <span className="flex items-center gap-1 md:gap-2 font-medium">
                  {connectionStatus === "connected" ? (
                    <Activity className="h-3 w-3 md:h-4 md:w-4" />
                  ) : connectionStatus === "disconnected" ? (
                    <WifiOff className="h-3 w-3 md:h-4 md:w-4" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 md:h-4 md:w-4" />
                  )}
                  {connectionStatus === "connected"
                    ? "Connected"
                    : connectionStatus === "disconnected"
                    ? "Disconnected"
                    : "Poor Connection"}
                </span>
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    connectionStatus === "connected"
                      ? "bg-green-500 animate-pulse"
                      : connectionStatus === "disconnected"
                      ? "bg-red-500"
                      : "bg-amber-500"
                  )}
                ></div>
              </div>
            </div>
          </aside>
        )}

        <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-3 md:p-4 border-b border-[#e3e3dd] bg-[#F7F7F4] sticky top-0 z-10">
          <div className="flex items-center gap-2 md:gap-4">
            {!isMobile && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="border-[#e3e3dd] hover:bg-[#f1f1ec] h-8 w-8 md:h-9 md:w-9"
              >
                {isSidebarOpen ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" />
                )}
              </Button>
            )}
            <div>
              <h1 className="font-semibold text-sm md:text-base truncate max-w-[180px] md:max-w-[300px]">
                {examData?.title}
              </h1>
              <p className="text-xs md:text-sm text-gray-500">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-6">
            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsTimerVisible(!isTimerVisible)}
                  className="h-7 w-7 md:h-8 md:w-8 border-[#e3e3dd] hover:bg-[#f1f1ec]"
              >
                {isTimerVisible ? (
                  <EyeOff className="h-3 w-3 md:h-4 md:w-4" />
                ) : (
                  <Eye className="h-3 w-3 md:h-4 md:w-4" />
                )}
              </Button>
              {isTimerVisible && (
                <div
                  className={cn(
                    "flex items-center gap-1 md:gap-2 font-mono text-xs md:text-sm font-semibold px-2 md:px-3 py-1 rounded-lg border border-[#e3e3dd]",
                    timeLeft < 300
                      ? "bg-red-50 text-red-600"
                      : "bg-white text-gray-800"
                  )}
                >
                  <Clock className="h-4 w-4 md:h-5 md:w-5" />
                  <div className="flex items-baseline gap-0.5">
                    <SlidingNumber
                      value={Math.floor(timeLeft / 60)}
                      padStart
                    />
                    <span>:</span>
                    <SlidingNumber value={timeLeft % 60} padStart />
                  </div>
                  {timeLeft < 300 && (
                    <span className="text-xs ml-1">(Low!)</span>
                  )}
                </div>
              )}
            </div>

            {isMobile && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMobileNavOpen(true)}
                className="h-8 w-8 border-[#e3e3dd] hover:bg-[#f1f1ec]"
              >
                <Grid className="h-4 w-4" />
              </Button>
            )}

            <Separator orientation="vertical" className="h-6 md:h-8" />

            <div className="flex items-center gap-2 md:gap-3">
              <Avatar className="border border-blue-200 h-8 w-8 md:h-9 md:w-9">
                <AvatarFallback className="bg-[#ebece4] text-gray-800 text-xs md:text-sm font-medium">
                  {studentInfo?.name?.[0] || "S"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="font-semibold text-xs md:text-sm">
                  {studentInfo?.name}
                </p>
                <p className="text-xs text-gray-500">
                  {studentInfo?.student_id}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setIsConfirmModalOpen(true)}
              className="border border-[#e3e3dd] bg-white hover:bg-[#f1f1ec] text-xs md:text-sm px-3 md:px-4 py-1.5 md:py-2 font-medium transition-colors"
            >
              Submit
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-3 md:p-6 overflow-y-auto pb-20 md:pb-6">
          {currentQ && (
            <Card className="overflow-hidden border border-[#e3e3dd] bg-white shadow-sm rounded-xl">
              <CardHeader className="p-4 md:p-6 border-b border-[#e3e3dd] bg-white">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="px-2 md:px-3 py-0.5 bg-[#ebece4] text-gray-800 rounded-full text-[11px] md:text-xs font-medium border border-[#e3e3dd]">
                          Q{currentQuestionIndex + 1}
                        </div>
                        <p className="text-[11px] md:text-xs font-medium text-gray-500">
                          {currentQ.type === "matching" &&
                            currentQ.matchingPairs &&
                            `${currentQ.matchingPairs.length} matching pairs`}
                          {currentQ.type === "blank" &&
                            currentQ.blanks &&
                            `${currentQ.blanks.length} blanks`}
                          {["mcq", "tf", "passage"].includes(currentQ.type) &&
                            `${currentQ.options?.length || 0} options`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 md:gap-2">
                        <Button
                          variant="outline"
                          onClick={handleToggleFlag}
                          className={cn(
                            "transition-all text-xs md:text-sm h-8 md:h-9 px-2 md:px-3",
                            flaggedQuestions.has(currentQuestionIndex) &&
                              "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                          )}
                        >
                          <Flag className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                          {flaggedQuestions.has(currentQuestionIndex)
                            ? "Flagged"
                            : "Flag"}
                        </Button>
                      </div>
                    </div>

                    {/* Modern Passage Display */}
                    {currentQ.has_passage && currentQ.passage_html && (
                      <ModernPassageDisplay
                        passageHtml={currentQ.passage_html}
                        isExpanded={passageExpanded}
                        onToggle={() => setPassageExpanded(!passageExpanded)}
                      />
                    )}

                    {/* Question Text */}
                    <div className="mt-3 md:mt-4">
                      {currentQ.type === "blank" ? (
                        <div className="text-sm md:text-base leading-relaxed font-normal bg-[#fafaf6] p-3 md:p-4 rounded-lg border border-[#e3e3dd]">
                          {currentQ.question_text
                            .split(/(\[BLANK:[^\]]+\])/g)
                            .map((part: string, i: number) => {
                              const match = part.match(/\[BLANK:([^\]]+)\]/);
                              if (match) {
                                const blankId = match[1];
                                return (
                                  <span
                                    key={i}
                                    className="inline-block mx-1 align-bottom"
                                  >
                                    <UnderlinedBlankInput
                                      value={getBlankAnswer(blankId)}
                                      onChange={(val) =>
                                        handleBlankChange(blankId, val)
                                      }
                                    />
                                  </span>
                                );
                              }
                              return (
                                <span key={i}>{renderWithMath(part)}</span>
                              );
                            })}
                        </div>
                      ) : currentQ.type === "matching" ? (
                        <div className="space-y-3 md:space-y-4">
                          {currentQ.matchingInstructions && (
                            <div className="bg-[#fafaf6] p-2 md:p-3 rounded-lg border border-[#e3e3dd]">
                              <p className="text-xs md:text-sm font-medium text-gray-700">
                                {renderWithMath(currentQ.matchingInstructions)}
                              </p>
                            </div>
                          )}
                          <CardTitle className="text-sm md:text-base text-gray-800 font-medium">
                            {renderWithMath(currentQ.question_text)}
                          </CardTitle>
                        </div>
                      ) : (
                        <CardTitle className="text-sm md:text-base leading-relaxed text-gray-800 font-medium">
                          {renderWithMath(currentQ.question_text)}
                        </CardTitle>
                      )}
                    </div>
                  </div>
                </div>

                {currentQ.image_url && (
                  <div className="mt-4 md:mt-6 flex justify-center">
                    <div className="max-w-2xl w-full">
                      <img
                        src={currentQ.image_url}
                        alt="Question"
                        className="w-full max-h-60 md:max-h-80 rounded-xl border-2 border-gray-200 object-contain shadow-md"
                      />
                    </div>
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-4 md:p-8 pt-4 md:pt-6">
                {/* MCQ / TF / Passage Options */}
                {["mcq", "tf", "passage"].includes(currentQ.type) && (
                  <div className="space-y-3 md:space-y-4">
                    <p className="text-[11px] md:text-xs font-medium text-gray-500 mb-1 md:mb-2 uppercase tracking-wide">
                      Choose the best option
                    </p>
                    <RadioGroup
                      value={answers[currentQuestionIndex]?.toString() ?? ""}
                      onValueChange={(v) => handleAnswerChange(Number(v))}
                      className="space-y-2 md:space-y-3"
                    >
                      {currentQ.options?.map((opt: any, idx: number) => {
                        const isSelected =
                          answers[currentQuestionIndex] === idx;
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "flex items-center p-3 md:p-4 rounded-lg border cursor-pointer transition-all",
                              isSelected
                                ? "border-blue-500 bg-[#f3f6ff]"
                                : "border-[#e3e3dd] bg-white hover:border-blue-300 hover:bg-[#f6f6f0]"
                            )}
                            onClick={() => handleAnswerChange(idx)}
                          >
                            <RadioGroupItem
                              value={idx.toString()}
                              id={`opt-${idx}`}
                              className="sr-only"
                            />
                            <div className="flex w-full items-center">
                              <div
                                className={cn(
                                  "h-8 w-8 md:h-9 md:w-9 rounded-md flex items-center justify-center mr-3 md:mr-4 font-medium text-sm md:text-base border transition-all",
                                  isSelected
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-[#f3f3ee] text-gray-700 border-[#deded7]"
                                )}
                              >
                                {String.fromCharCode(65 + idx)}
                              </div>
                              <div className="flex-1 font-normal text-sm md:text-sm text-gray-800">
                                {renderWithMath(opt.text)}
                              </div>
                              {opt.image && (
                                <img
                                  src={opt.image}
                                  alt="Option"
                                  className="h-16 w-16 md:h-24 md:w-24 object-cover rounded-lg border ml-2 md:ml-4 shadow-sm"
                                />
                              )}
                              {isSelected && (
                                <div className="ml-2 md:ml-4">
                                  <Check className="h-5 w-5 md:h-7 md:w-7 text-green-600 bg-green-100 p-0.5 md:p-1 rounded-full" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </div>
                )}

                {/* Matching UI - Side by Side on all devices */}
                {currentQ.type === "matching" && currentQ.matchingPairs && (
                  <div className="w-full space-y-4 md:space-y-6 overflow-hidden">
                    {/* Instruction Box - Full width, stays visible */}
                    <div className="bg-blue-50 p-3 md:p-4 rounded-lg border border-blue-200 flex gap-3 md:gap-4 items-center">
                      <div className="bg-blue-100 p-1.5 md:p-2 rounded-full flex-shrink-0">
                        <svg
                          className="w-5 h-5 md:w-6 md:h-6 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div className="text-xs md:text-sm text-blue-800">
                        <span className="font-bold">Instructions:</span> Match
                        items from A to B.
                      </div>
                    </div>

                    {/* Scrollable Wrapper - Only this part scrolls horizontally if needed */}
                    <div className="relative border-2 border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
                      <div className="overflow-x-auto custom-scrollbar">
                        {/* Set a fixed minimum width only for the grid content to force internal scroll */}
                        <div className="min-w-[650px] md:min-w-full grid grid-cols-2 divide-x divide-gray-200">
                          {/* COLUMN A */}
                          <div className="flex flex-col">
                            <div className="p-3 md:p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                              <h3 className="text-center font-bold text-gray-800 uppercase tracking-wider text-xs md:text-base">
                                Column A
                              </h3>
                            </div>
                            <div className="flex-1 divide-y divide-gray-100">
                              {currentQ.matchingPairs.map(
                                (pair: any, idx: number) => {
                                  const currentAnswer = getMatchingAnswer();
                                  const answerLetter = currentAnswer[idx] || "";
                                  return (
                                    <div
                                      key={idx}
                                      className="p-3 md:p-4 min-h-[90px] flex items-center hover:bg-gray-50/50"
                                    >
                                      <div className="flex items-center gap-2 md:gap-4 w-full">
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <MatchingAnswerInput
                                            value={answerLetter}
                                            onChange={(val) =>
                                              handleMatchSelect(idx, val)
                                            }
                                            maxLetters={
                                              currentQ.matchingPairs.length
                                            }
                                          />
                                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                                            {idx + 1}
                                          </div>
                                        </div>
                                        <div className="flex-1 min-w-0 text-sm md:text-base text-gray-800 font-medium">
                                          {renderWithMath(pair.sideA)}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>

                          {/* COLUMN B */}
                          <div className="flex flex-col bg-gray-50/20">
                            <div className="p-3 md:p-4 border-b bg-gradient-to-r from-emerald-50 to-green-50">
                              <h3 className="text-center font-bold text-gray-800 uppercase tracking-wider text-xs md:text-base">
                                Column B
                              </h3>
                            </div>
                            <div className="flex-1 divide-y divide-gray-100">
                              {currentQ.matchingPairs.map(
                                (pair: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="p-3 md:p-4 min-h-[90px] flex items-center hover:bg-gray-50/50"
                                  >
                                    <div className="flex items-start gap-3 w-full">
                                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold flex items-center justify-center text-sm flex-shrink-0">
                                        {String.fromCharCode(65 + idx)}
                                      </div>
                                      <div className="flex-1 min-w-0 text-sm md:text-base text-gray-700 pt-1">
                                        {renderWithMath(pair.sideB)}
                                      </div>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6 md:mt-8">
            <Button
              variant="outline"
              size={isMobile ? "default" : "lg"}
              onClick={() => setCurrentQuestionIndex((p) => p - 1)}
              disabled={currentQuestionIndex === 0}
              className="px-3 md:px-6 py-2 md:py-3 border-blue-200 hover:bg-blue-50 text-xs md:text-sm"
            >
              <ChevronLeft className="mr-1 md:mr-2 h-3 w-3 md:h-5 md:w-5" />{" "}
              Previous
            </Button>

            <div className="flex items-center gap-3 md:gap-4">
              <span className="text-xs md:text-sm text-gray-500">
                {currentQuestionIndex + 1} of {questions.length}
              </span>
              <Button
                onClick={() => setCurrentQuestionIndex((p) => p + 1)}
                size={isMobile ? "default" : "lg"}
                disabled={currentQuestionIndex === questions.length - 1}
                className="px-3 md:px-6 py-2 md:py-3 bg-zinc-900 hover:bg-zinc-700 text-white text-xs md:text-sm transition-colors"
              >
                Next{" "}
                <ChevronRight className="ml-1 md:ml-2 h-3 w-3 md:h-5 md:w-5" />
              </Button>
            </div>
          </div>
        </main>
      </div>

      {/* Close inner layout wrapper */}
      </div>

      {/* Submit Confirmation Modal */}
      <AlertDialog
        open={isConfirmModalOpen}
        onOpenChange={setIsConfirmModalOpen}
      >
        <AlertDialogContent className="max-w-md mx-4">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-amber-600" />
              <AlertDialogTitle className="text-lg md:text-xl">
                Ready to Submit?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-gray-600 text-sm md:text-base">
              You're about to submit your exam. Make sure you've answered all
              questions before proceeding.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-3 md:py-4">
            <div className="grid grid-cols-3 gap-2 md:gap-3 text-center">
              <div className="p-3 md:p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg md:rounded-xl border border-green-200">
                <div className="text-xl md:text-3xl font-bold text-green-600">
                  {stats.answered}
                </div>
                <div className="text-xs text-green-800 font-medium mt-1 md:mt-2 uppercase tracking-wider">
                  Answered
                </div>
              </div>
              <div className="p-3 md:p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg md:rounded-xl border border-gray-200">
                <div className="text-xl md:text-3xl font-bold text-gray-600">
                  {stats.unanswered}
                </div>
                <div className="text-xs text-gray-800 font-medium mt-1 md:mt-2 uppercase tracking-wider">
                  Unanswered
                </div>
              </div>
              <div className="p-3 md:p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg md:rounded-xl border border-amber-200">
                <div className="text-xl md:text-3xl font-bold text-amber-600">
                  {stats.flagged}
                </div>
                <div className="text-xs text-amber-800 font-medium mt-1 md:mt-2 uppercase tracking-wider">
                  Flagged
                </div>
              </div>
            </div>

            <div className="mt-3 md:mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Time Remaining:</strong> {formatTime(timeLeft)}
              </p>
              {timeLeft < 300 && (
                <p className="text-sm text-red-600 mt-1">
                  ⚠️ Time is running out!
                </p>
              )}
            </div>
          </div>

          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 md:gap-3">
            <AlertDialogCancel className="w-full sm:w-auto text-sm md:text-base">
              Review More
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinalSubmit}
              className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-700 text-white text-sm md:text-base transition-colors"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                  Submitting...
                </>
              ) : (
                "Submit Exam Now"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}