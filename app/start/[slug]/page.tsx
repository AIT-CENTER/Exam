"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
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
  MessageSquare,
  FileText,
  MoreHorizontal,
  MoreVertical
} from 'lucide-react'
import { supabase } from "@/lib/supabaseClient"
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

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

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

const renderWithMath = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
  return parts.map((part, index) => {
    if (part.startsWith("$$") && part.endsWith("$$")) {
      return <BlockMath key={index} math={part.slice(2, -2)} />;
    } else if (part.startsWith("$") && part.endsWith("$")) {
      return <InlineMath key={index} math={part.slice(1, -1)} />;
    } else {
      return <span key={index}>{part}</span>;
    }
  });
};

const parseQuestionText = (text: string) => {
  const passageMatch = text.match(/\[PASSAGE_HTML\]([\s\S]*?)\[\/PASSAGE_HTML\]/)
  if (passageMatch) {
    const passageHtml = passageMatch[1]
    const questionText = text.replace(/\[PASSAGE_HTML\][\s\S]*?\[\/PASSAGE_HTML\]\n*/, "").trim()
    return { passageHtml, questionText, hasPassage: true }
  }
  return { passageHtml: "", questionText: text, hasPassage: false }
}

const truncateText = (text: string, maxLength: number = 200) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function FullscreenWarningModal({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Maximize className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Fullscreen Required</h2>
        <p className="text-gray-600 mb-6">
          You must return to fullscreen mode to continue the exam. 
          The exam cannot be taken outside of fullscreen mode.
        </p>
        <Button onClick={onRetry} className="w-full bg-red-600 hover:bg-red-700 text-lg py-3">
          Return to Fullscreen
        </Button>
        <p className="text-sm text-gray-500 mt-4">
          Click the button above to return to fullscreen mode
        </p>
      </div>
    </div>
  )
}

function ExamAlreadyInProgressModal({ existingSession, onResume, onCancel }: { existingSession: any, onResume: () => void, onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Exam Already in Progress</h2>
        <p className="text-gray-600 mb-6">
          You already have an active exam session. You can only take one exam at a time.
          Would you like to resume your previous session?
        </p>
        <div className="space-y-3">
          <Button onClick={onResume} className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-3">
            Resume Previous Exam
          </Button>
          <Button onClick={onCancel} variant="outline" className="w-full text-lg py-3">
            Cancel
          </Button>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          Note: You cannot start a new exam while another one is in progress
        </p>
      </div>
    </div>
  )
}

function ExamInstructions({
  examData,
  onStartExam,
  isLoading,
  isResuming,
}: {
  examData: any
  onStartExam: () => void
  isLoading: boolean
  isResuming: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardContent className="p-12 text-center">
            <Spinner className="h-12 w-12 mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading exam details...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">{examData?.title || "Exam"}</CardTitle>
          <p className="text-gray-600 pt-1">
            {isResuming
              ? "You are resuming your exam. Please read the instructions carefully."
              : "Please read the instructions carefully before you begin."}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-gray-100 rounded-lg border">
              <p className="text-sm font-medium text-gray-600">Duration</p>
              <p className="text-2xl font-bold">{examData?.duration || 60} Minutes</p>
            </div>
            <div className="p-4 bg-gray-100 rounded-lg border">
              <p className="text-sm font-medium text-gray-600">Total Questions</p>
              <p className="text-2xl font-bold">{examData?.questionCount || 0}</p>
            </div>
          </div>
          {examData?.description && (
            <div>
              <h3 className="font-semibold text-lg mb-2">Instructions:</h3>
              <div className="text-gray-600 bg-amber-50 p-4 rounded-md border border-amber-200 whitespace-pre-wrap">
                {examData.description}
              </div>
            </div>
          )}
          <div className="bg-red-50 p-4 rounded-md border border-red-200">
            <h4 className="font-semibold text-red-900 mb-2">Important Security Measures:</h4>
            <ul className="text-red-800 text-sm space-y-1">
              <li>• <strong>Fullscreen is required</strong> throughout the exam</li>
              <li>• <strong>Screenshots are completely blocked</strong></li>
              <li>• <strong>Right-click is disabled</strong> during the exam</li>
              <li>• Multiple violation attempts may result in exam termination</li>
              <li>• The exam will auto-submit when time runs out</li>
            </ul>
          </div>
        </CardContent>
        <div className="p-6 border-t">
          <Button size="lg" className="w-full text-lg bg-blue-600 hover:bg-blue-700" onClick={onStartExam}>
            {isResuming ? "Resume Exam" : "Start Exam"} <ChevronRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </Card>
    </div>
  )
}

function ExamResultsView({ 
  examData, 
  studentInfo, 
  results, 
  questions,
  answers 
}: { 
  examData: any
  studentInfo: any
  results: any
  questions: any[]
  answers: any[]
}) {
  const router = useRouter()
  
  if (!results) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-10 flex items-center justify-center">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardContent className="p-12 text-center">
            <Spinner className="h-12 w-12 mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading your results...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalQuestions = questions.length
  const correctAnswers = answers.filter((answer, index) => {
    const question = questions[index]
    return question && question.correct_answer_index === answer
  }).length

  const percentage = Math.round((correctAnswers / totalQuestions) * 100)
  const totalMarksObtained = results.total_marks_obtained || 0
  const totalPossibleMarks = examData?.total_marks || totalQuestions

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 md:p-10">
      <Card className="w-full max-w-4xl mx-auto shadow-2xl border-0">
        <CardHeader className="text-center bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg py-8">
          <div className="flex justify-center mb-4">
            <Award className="h-16 w-16 text-yellow-300" />
          </div>
          <CardTitle className="text-3xl font-bold">Exam Results</CardTitle>
          <p className="text-blue-100 pt-2">Your exam has been evaluated successfully</p>
        </CardHeader>
        
        <CardContent className="p-8 space-y-8">
          {/* Student and Exam Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6 border shadow-sm">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                Student Information
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-semibold">{studentInfo?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Student ID:</span>
                  <span className="font-semibold">{studentInfo?.student_id}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border shadow-sm">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <BarChart className="h-5 w-5 text-green-600" />
                Exam Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Exam:</span>
                  <span className="font-semibold">{examData?.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Questions:</span>
                  <span className="font-semibold">{totalQuestions}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
              <div className="text-2xl font-bold text-blue-600">{correctAnswers}</div>
              <div className="text-sm text-gray-600">Correct</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
              <div className="text-2xl font-bold text-red-600">{totalQuestions - correctAnswers}</div>
              <div className="text-sm text-gray-600">Incorrect</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
              <div className="text-2xl font-bold text-green-600">{percentage}%</div>
              <div className="text-sm text-gray-600">Score</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
              <div className="text-2xl font-bold text-purple-600">
                {totalMarksObtained}/{totalPossibleMarks}
              </div>
              <div className="text-sm text-gray-600">Marks</div>
            </div>
          </div>
        </CardContent>
        
        <div className="p-6 border-t bg-gray-50 rounded-b-lg text-center">
          <div className="space-x-4">
            <Button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-700">
              Return to Home
            </Button>
          </div>
          <p className="text-gray-500 text-sm mt-4">
            Results are final and have been recorded in the system.
          </p>
        </div>
      </Card>
    </div>
  )
}

function ExamResultsDisabledView() {
  const router = useRouter()
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 md:p-10 flex items-center justify-center">
      <Card className="w-full max-w-2xl shadow-2xl border-0">
        <CardHeader className="text-center bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg py-8">
          <div className="flex justify-center mb-4">
            <Award className="h-16 w-16 text-yellow-300" />
          </div>
          <CardTitle className="text-3xl font-bold">Exam Submitted Successfully</CardTitle>
          <p className="text-blue-100 pt-2">Your exam has been submitted and recorded</p>
        </CardHeader>
        
        <CardContent className="p-8 text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Thank You!</h3>
          <p className="text-gray-600 mb-6">
            Your exam has been successfully submitted. Results will be available when released by your instructor.
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 font-medium">
              <AlertTriangle className="h-5 w-5 inline-block mr-2" />
              Results are currently not available for viewing.
            </p>
            <p className="text-yellow-700 text-sm mt-2">
              Your instructor will notify you when results are ready to be viewed.
            </p>
          </div>
        </CardContent>
        
        <div className="p-6 border-t bg-gray-50 rounded-b-lg text-center">
          <Button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-700 px-8">
            Return to Home
          </Button>
          <p className="text-gray-500 text-sm mt-4">
            You can close this window now.
          </p>
        </div>
      </Card>
    </div>
  )
}

function ExamTerminatedModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Ban className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Exam Terminated</h2>
        <p className="text-gray-600 mb-6">
          Your exam has been terminated due to multiple security violation attempts. 
          Please contact your teacher for further instructions.
        </p>
        <Button onClick={onClose} className="w-full bg-red-600 hover:bg-red-700 text-lg py-3">
          Return to Home
        </Button>
      </div>
    </div>
  )
}

function PassageModal({ 
  isOpen, 
  onClose, 
  passageHtml,
  questionNumber,
}: {
  isOpen: boolean
  onClose: () => void
  passageHtml: string
  questionNumber: number
}) {
  const [fontSize, setFontSize] = useState(16)

  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 2, 24))
  }

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 2, 12))
  }

  const resetFontSize = () => {
    setFontSize(16)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-w-[95vw] h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Passage for Question {questionNumber}
              </DialogTitle>
              <DialogDescription>
                Read the passage carefully before answering the question.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={decreaseFontSize}
                disabled={fontSize <= 12}
                className="h-8 w-8 p-0"
              >
                <Minimize2 className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetFontSize}
                className="h-8 px-2 text-xs"
              >
                {fontSize}px
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={increaseFontSize}
                disabled={fontSize >= 24}
                className="h-8 w-8 p-0"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-lg border">
          <div 
            className="prose max-w-none p-4 bg-white rounded-lg"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: passageHtml }}
          />
        </div>
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>
            Close Passage
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FullQuestionModal({ 
  isOpen, 
  onClose, 
  questionText,
  questionNumber,
  totalQuestions
}: {
  isOpen: boolean
  onClose: () => void
  questionText: string
  questionNumber: number
  totalQuestions: number
}) {
  const [fontSize, setFontSize] = useState(16)

  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 2, 24))
  }

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 2, 12))
  }

  const resetFontSize = () => {
    setFontSize(16)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-w-[95vw] h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Full Question {questionNumber} of {totalQuestions}
              </DialogTitle>
              <DialogDescription>
                Read the full question text below
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={decreaseFontSize}
                disabled={fontSize <= 12}
                className="h-8 w-8 p-0"
              >
                <Minimize2 className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetFontSize}
                className="h-8 px-2 text-xs"
              >
                {fontSize}px
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={increaseFontSize}
                disabled={fontSize >= 24}
                className="h-8 w-8 p-0"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-lg border">
          <div 
            className="prose max-w-none p-4 bg-white rounded-lg"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
          >
            {renderWithMath(questionText)}
          </div>
        </div>
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const generateShuffleOrder = (array: any[], sessionId: string, type: "questions" | "options") => {
  let seed = 0
  for (let i = 0; i < sessionId.length; i++) {
    seed += sessionId.charCodeAt(i)
  }

  const shuffled = [...array]
  const random = () => {
    const x = Math.sin(seed++) * 10000
    return x - Math.floor(x)
  }

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const checkExistingActiveSessions = async (studentId: string, examId: string) => {
  try {
    const { data: activeSessions, error } = await supabase
      .from("exam_sessions")
      .select("*")
      .eq("student_id", studentId)
      .eq("status", "in_progress")
      .neq("exam_id", examId)

    if (error) {
      console.error("Error checking active sessions:", error)
      return null
    }

    return activeSessions && activeSessions.length > 0 ? activeSessions[0] : null
  } catch (err) {
    console.error("Error checking active sessions:", err)
    return null
  }
}

export default function ExamTakingPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  const [examStatus, setExamStatus] = useState<"loading" | "instructions" | "in-progress" | "completed" | "terminated" | "results">("loading")
  const [examData, setExamData] = useState<any>(null)
  const [studentInfo, setStudentInfo] = useState<any>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [originalQuestions, setOriginalQuestions] = useState<any[]>([])
  const [isResuming, setIsResuming] = useState(false)
  const [showAlreadyInProgressModal, setShowAlreadyInProgressModal] = useState(false)
  const [existingActiveSession, setExistingActiveSession] = useState<any>(null)
  const [examResults, setExamResults] = useState<any>(null)
  const [showResults, setShowResults] = useState(true)

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [flaggedQuestions, setFlaggedQuestions] = useState(() => new Set<number>())
  const [timeLeft, setTimeLeft] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false)
  const [violationCount, setViolationCount] = useState(0)
  const [showPassageModal, setShowPassageModal] = useState(false)
  const [showFullQuestionModal, setShowFullQuestionModal] = useState(false)
  const [currentPassageHtml, setCurrentPassageHtml] = useState("")
  const [isTimerVisible, setIsTimerVisible] = useState(true)
  const [windowWidth, setWindowWidth] = useState(0)
  const [isFullscreenActive, setIsFullscreenActive] = useState(false)

  const examDurationRef = useRef<number>(0)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timeSyncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const autoSubmitTriggeredRef = useRef<boolean>(false)
  const lastFullscreenCheckRef = useRef<number>(0)
  const violationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const fullscreenAttemptRef = useRef<boolean>(false)
  const MAX_VIOLATIONS = 3

  // Track window width for responsive design
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth
      setWindowWidth(newWidth)
    }
    
    // Initial width
    setWindowWidth(window.innerWidth)
    
    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Automatic fullscreen when exam starts
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        const elem = document.documentElement
        if (elem.requestFullscreen && !document.fullscreenElement && examStatus === "in-progress") {
          await elem.requestFullscreen()
          setIsFullscreenActive(true)
          fullscreenAttemptRef.current = true
          console.log("Automatic fullscreen activated")
        }
      } catch (err) {
        console.warn("Fullscreen request failed:", err)
        fullscreenAttemptRef.current = false
      }
    }

    if (examStatus === "in-progress" && !fullscreenAttemptRef.current) {
      // Delay slightly to ensure DOM is ready
      setTimeout(() => {
        enterFullscreen()
      }, 300)
    }
  }, [examStatus])

  // Load exam data
  useEffect(() => {
    const loadExamData = async () => {
      try {
        const studentId = searchParams.get('student')
        const examCode = searchParams.get('exam')
        const sessionIdParam = searchParams.get('session')
        
        if (!studentId || !examCode) {
          toast.error("Invalid exam access. Please check your URL.")
          router.push("/")
          return
        }

        // Check for existing active sessions
        const { data: activeSessionsCheck } = await supabase
          .from("exam_sessions")
          .select("*")
          .eq("student_id", studentId)
          .eq("status", "in_progress")

        if (activeSessionsCheck && activeSessionsCheck.length > 0) {
          const activeSession = activeSessionsCheck[0]
          // Don't block if it's the same exam
          const { data: examCheck } = await supabase
            .from("exams")
            .select("*")
            .eq("exam_code", examCode)
            .single()

          if (examCheck && activeSession.exam_id !== examCheck.id) {
            setExistingActiveSession(activeSession)
            setShowAlreadyInProgressModal(true)
            setExamStatus("loading")
            return
          }
        }

        const { data: student, error: studentError } = await supabase
          .from("students")
          .select("*")
          .eq("student_id", studentId)
          .single()

        if (studentError || !student) {
          toast.error("Student not found. Please check your Student ID.")
          router.push("/")
          return
        }
        setStudentInfo(student)

        const { data: exam, error: examError } = await supabase
          .from("exams")
          .select("*")
          .eq("exam_code", examCode)
          .single()

        if (examError || !exam) {
          toast.error("Exam not found. Please check your Exam ID.")
          router.push("/")
          return
        }

        // Check if results are enabled
        setShowResults(exam.show_results !== false)

        examDurationRef.current = exam.duration * 60

        const { data: questionsData, error: questionsError } = await supabase
          .from("questions")
          .select("*")
          .eq("exam_id", exam.id)
          .order("id")

        if (questionsError || !questionsData || questionsData.length === 0) {
          toast.error("No questions found for this exam")
          return
        }

        const processedQuestions = questionsData.map((q) => {
          let options: any[] = []
          let correctAnswerIndex: number | null = null

          const { passageHtml, questionText, hasPassage } = parseQuestionText(q.question_text)

          if (q.options) {
            try {
              const parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
            
              if (parsedOptions && Array.isArray(parsedOptions.options)) {
                const optionImages = parsedOptions.option_images || []
                options = parsedOptions.options.map((text: string, index: number) => ({
                  id: index,
                  text: text,
                  image: optionImages[index] || null,
                  is_correct: index === parsedOptions.correct_option_id,
                }))
                correctAnswerIndex = parsedOptions.correct_option_id
              } else if (Array.isArray(parsedOptions)) {
                options = parsedOptions.map((opt: any, index: number) => {
                  const isCorrect = opt.correct || false
                  if (isCorrect) correctAnswerIndex = index
                  return {
                    id: index,
                    text: opt.text || `Option ${String.fromCharCode(65 + index)}`,
                    is_correct: isCorrect,
                    image: opt.image || null,
                  }
                })
              }
            } catch (e) {
              console.error("Error parsing options:", e)
            }
          }

          // Default options if none found
          if (options.length === 0) {
            options = ["Option A", "Option B", "Option C", "Option D"].map((text, index) => ({
              id: index,
              text,
              is_correct: false,
              image: null,
            }))
          }

          return {
            ...q,
            question_text: questionText,
            passage_html: passageHtml,
            has_passage: hasPassage,
            options: options,
            correct_answer_index: correctAnswerIndex
          }
        })

        let existingSession = null
        let currentSessionId = sessionIdParam

        if (sessionIdParam) {
          const { data: session } = await supabase
            .from("exam_sessions")
            .select("*")
            .eq("id", sessionIdParam)
            .single()

          if (session) {
            existingSession = session
            currentSessionId = session.id
            setSessionId(session.id)
          }
        }

        let questionsToUse = processedQuestions
        setOriginalQuestions(processedQuestions)

        if (currentSessionId && exam.questions_shuffled) {
          questionsToUse = generateShuffleOrder(processedQuestions, currentSessionId, "questions")
        }

        // Apply option shuffling if enabled
        if (currentSessionId && exam.options_shuffled) {
          questionsToUse = questionsToUse.map((question) => {
            if (question.options && question.options.length > 0) {
              const shuffledOptions = generateShuffleOrder(question.options, `${currentSessionId}-${question.id}`, "options")
              
              // Find new correct answer index after shuffling
              const newCorrectIndex = shuffledOptions.findIndex((opt: any) => opt.is_correct)
              
              return {
                ...question,
                options: shuffledOptions,
                correct_answer_index: newCorrectIndex >= 0 ? newCorrectIndex : question.correct_answer_index
              }
            }
            return question
          })
        }

        let initialExamStatus: "loading" | "instructions" | "in-progress" | "completed" | "results" = "instructions"
        let isResumingSession = false

        if (existingSession) {
          if (existingSession.status === "in_progress") {
            isResumingSession = true
            setIsResuming(true)
            initialExamStatus = "in-progress"
            
            const remaining = Math.max(0, existingSession.time_remaining || examDurationRef.current)
            setTimeLeft(remaining)

            const { data: savedAnswers } = await supabase
              .from("student_answers")
              .select("*")
              .eq("session_id", existingSession.id)

            if (savedAnswers) {
              const restoredAnswers = new Array(questionsToUse.length).fill(null)
              const restoredFlags = new Set<number>()
              
              savedAnswers.forEach((sa: any) => {
                const qIndex = questionsToUse.findIndex(q => q.id === sa.question_id)
                if (qIndex > -1) {
                  restoredAnswers[qIndex] = sa.selected_option_id
                  if (sa.is_flagged) {
                    restoredFlags.add(qIndex)
                  }
                }
              })
              
              setAnswers(restoredAnswers)
              setFlaggedQuestions(restoredFlags)
            }
          } else if (existingSession.status === "submitted") {
            // Check if results should be shown
            if (exam.show_results !== false) {
              const { data: results } = await supabase
                .from("results")
                .select("*")
                .eq("exam_id", exam.id)
                .eq("student_id", student.id)
                .single()

              if (results) {
                setExamResults(results)
                setExamStatus("results")
                return
              }
            } else {
              setExamStatus("completed")
              return
            }
          }
        } else {
          setAnswers(new Array(questionsToUse.length).fill(null))
          setTimeLeft(examDurationRef.current)
        }

        setExamData({ 
          ...exam, 
          questionCount: processedQuestions.length,
          title: exam.title,
          duration: exam.duration,
          description: exam.description,
          total_marks: exam.total_marks,
          options_shuffled: exam.options_shuffled,
          questions_shuffled: exam.questions_shuffled,
          show_results: exam.show_results
        })
        setQuestions(questionsToUse)
        setExamStatus(initialExamStatus)

      } catch (err) {
        console.error("Error loading exam:", err)
        toast.error("Failed to load exam. Please try again.")
        router.push("/")
      }
    }

    loadExamData()
  }, [router, searchParams])

  // Timer - Working properly with real-time countdown
  useEffect(() => {
    if (examStatus === "in-progress") {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
      
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (!autoSubmitTriggeredRef.current) {
              autoSubmitTriggeredRef.current = true
              handleFinalSubmit()
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [examStatus])

  // Time sync to database every 15 seconds - REAL WORKING VERSION
  useEffect(() => {
    if (examStatus === "in-progress" && sessionId) {
      if (timeSyncIntervalRef.current) {
        clearInterval(timeSyncIntervalRef.current)
      }
      
      const syncTimeToDatabase = async () => {
        try {
          const now = new Date().toISOString()
          
          // Update time remaining in database
          const { error: updateError } = await supabase
            .from("exam_sessions")
            .update({
              time_remaining: timeLeft,
              last_activity_at: now,
              updated_at: now
            })
            .eq("id", sessionId)

          if (updateError) {
            console.error("Error syncing time to database:", updateError)
          }
        } catch (error) {
          console.error("Error in time sync:", error)
        }
      }

      // Initial sync
      syncTimeToDatabase()
      
      // Set up interval for every 15 seconds
      timeSyncIntervalRef.current = setInterval(syncTimeToDatabase, 15000)

      return () => {
        if (timeSyncIntervalRef.current) {
          clearInterval(timeSyncIntervalRef.current)
          timeSyncIntervalRef.current = null
        }
      }
    }
  }, [examStatus, sessionId, timeLeft])

  // Security measures - Enhanced screenshot blocking
  useEffect(() => {
    let styleElement: HTMLStyleElement | null = null

    const handleContextMenu = (e: MouseEvent) => {
      if (examStatus === "in-progress") {
        e.preventDefault()
        handleSecurityViolation()
        return false
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (examStatus === "in-progress") {
        const blockedShortcuts = [
          e.key === 'PrintScreen',
          e.key === 'Snapshot',
          e.ctrlKey && e.key === 'p',
          e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4'),
          e.ctrlKey && e.shiftKey && e.key === 's',
          e.altKey && e.key === 'PrintScreen',
          e.key === 'F12',
          e.ctrlKey && e.shiftKey && e.key === 'i',
          e.ctrlKey && e.shiftKey && e.key === 'j',
          e.ctrlKey && e.shiftKey && e.key === 'c',
          e.ctrlKey && e.key === 'u',
          e.ctrlKey && e.key === 's',
          e.metaKey && e.key === 'p',
          e.metaKey && e.key === 'PrintScreen',
          e.altKey && e.key === 'PrintScreen',
          // Block Windows + PrtScn
          e.key === 'PrintScreen' && (e.ctrlKey || e.metaKey || e.altKey),
          // Block Alt + PrtScn
          e.altKey && e.key === 'PrintScreen',
        ]

        if (blockedShortcuts.some((condition) => condition)) {
          e.preventDefault()
          e.stopPropagation()
          handleSecurityViolation()
          return false
        }
      }
    }

    const addProtectiveStyles = () => {
      const protectiveCSS = `
        * {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
          -webkit-user-drag: none !important;
          -webkit-touch-callout: none !important;
        }
        
        img, .question-content, .options-container, .card, .radio-group {
          pointer-events: none !important;
          -webkit-user-select: none !important;
          -webkit-user-drag: none !important;
          -webkit-touch-callout: none !important;
        }
        
        body {
          cursor: default !important;
        }
        
        /* Prevent screenshot visual feedback */
        ::selection {
          background: transparent !important;
        }
        
        /* Make content non-selectable */
        * {
          -webkit-tap-highlight-color: transparent !important;
        }
      `

      styleElement = document.createElement('style')
      styleElement.id = 'exam-protection-styles'
      styleElement.textContent = protectiveCSS
      document.head.appendChild(styleElement)
    }

    const removeProtectiveStyles = () => {
      if (styleElement) {
        styleElement.remove()
        styleElement = null
      }
    }

    // Additional screenshot blocking
    const preventScreenshot = () => {
      // Add overlay div to prevent screenshots
      const overlay = document.createElement('div')
      overlay.id = 'screenshot-blocker'
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 999999;
        pointer-events: none;
        background: transparent;
        display: none;
      `
      document.body.appendChild(overlay)
      
      // Add event listeners for screenshot attempts
      const showBlocker = () => {
        overlay.style.display = 'block'
        setTimeout(() => {
          overlay.style.display = 'none'
        }, 100)
      }
      
      // Listen for potential screenshot shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.key === 'PrintScreen' || e.key === 'Snapshot' || 
            (e.ctrlKey && e.key === 'p') || 
            (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4'))) {
          showBlocker()
        }
      })
    }

    if (examStatus === "in-progress") {
      addProtectiveStyles()
      document.addEventListener('contextmenu', handleContextMenu)
      document.addEventListener('keydown', handleKeyDown, true)
      preventScreenshot()

      return () => {
        document.removeEventListener('contextmenu', handleContextMenu)
        document.removeEventListener('keydown', handleKeyDown, true)
        removeProtectiveStyles()
        const blocker = document.getElementById('screenshot-blocker')
        if (blocker) blocker.remove()
      }
    }

    return () => {
      removeProtectiveStyles()
      const blocker = document.getElementById('screenshot-blocker')
      if (blocker) blocker.remove()
    }
  }, [examStatus])

  // Fullscreen monitoring - SILENT
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement
      setIsFullscreenActive(isFullscreen)
      const now = Date.now()
      
      if (now - lastFullscreenCheckRef.current > 2000) {
        if (!isFullscreen && examStatus === "in-progress") {
          handleSecurityViolation()
          setShowFullscreenWarning(true)
        } else {
          setShowFullscreenWarning(false)
        }
        lastFullscreenCheckRef.current = now
      }
    }

    const checkFullscreen = () => {
      const isFullscreen = !!document.fullscreenElement
      setIsFullscreenActive(isFullscreen)
      const now = Date.now()
      
      if (now - lastFullscreenCheckRef.current > 2000) {
        if (!isFullscreen && examStatus === "in-progress") {
          handleSecurityViolation()
          setShowFullscreenWarning(true)
        } else {
          setShowFullscreenWarning(false)
        }
        lastFullscreenCheckRef.current = now
      }
    }

    const interval = setInterval(checkFullscreen, 2000)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [examStatus])

  const handleSecurityViolation = () => {
    const newCount = violationCount + 1
    setViolationCount(newCount)

    if (newCount >= MAX_VIOLATIONS) {
      terminateExam()
    } else if (newCount === MAX_VIOLATIONS - 1) {
      toast.error(`Final Warning: One more violation will terminate your exam!`, {
        duration: 4000,
      })
    }

    // Reset violation count after 30 seconds of good behavior
    if (violationTimerRef.current) {
      clearTimeout(violationTimerRef.current)
    }
    violationTimerRef.current = setTimeout(() => {
      setViolationCount(0)
    }, 30000)
  }

  const terminateExam = async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    
    if (timeSyncIntervalRef.current) {
      clearInterval(timeSyncIntervalRef.current)
      timeSyncIntervalRef.current = null
    }

    if (sessionId) {
      try {
        await supabase
          .from("exam_sessions")
          .update({
            status: "terminated",
            terminated_reason: "Multiple security violations detected",
            submitted_at: new Date().toISOString(),
            time_remaining: 0
          })
          .eq("id", sessionId)

        await supabase
          .from("results")
          .upsert({
            exam_id: examData.id,
            student_id: studentInfo.id,
            teacher_id: examData.created_by,
            total_marks_obtained: 0,
            grade: "F",
            comments: "Exam terminated due to security violations",
            submission_time: new Date().toISOString()
          })

      } catch (error) {
        console.error("Error terminating exam:", error)
      }
    }

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }

    setExamStatus("terminated")
  }

  const handleRetryFullscreen = async () => {
    try {
      const elem = document.documentElement
      if (elem.requestFullscreen) {
        await elem.requestFullscreen()
        setShowFullscreenWarning(false)
        setIsFullscreenActive(true)
      }
    } catch (err) {
      console.warn("Fullscreen request failed:", err)
    }
  }

  const handleResumeExistingSession = () => {
    if (existingActiveSession) {
      const url = `/exam/take?student=${searchParams.get('student')}&exam=${existingActiveSession.exam_id}&session=${existingActiveSession.id}`
      router.push(url)
    }
  }

  const handleCancelExistingSession = () => {
    setShowAlreadyInProgressModal(false)
    router.push("/")
  }

  const stats = useMemo(() => ({
    answered: answers.filter((a) => a !== null).length,
    unanswered: answers.filter((a) => a === null).length,
    flagged: flaggedQuestions.size,
  }), [answers, flaggedQuestions.size])

  const handleStartExam = async () => {
    try {
      if (!studentInfo || !examData) {
        toast.error("Student or exam data not loaded")
        return
      }

      const existingActiveSession = await checkExistingActiveSessions(studentInfo.id, examData.id)
      if (existingActiveSession) {
        setExistingActiveSession(existingActiveSession)
        setShowAlreadyInProgressModal(true)
        return
      }

      let currentSessionId = sessionId

      if (!currentSessionId) {
        const { data: newSession, error } = await supabase
          .from("exam_sessions")
          .insert({
            student_id: studentInfo.id,
            exam_id: examData.id,
            teacher_id: examData.created_by,
            status: "in_progress",
            time_remaining: examDurationRef.current,
            started_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) {
          if (error.code === '23505') {
            toast.error("You already have an active exam session.")
            return
          }
          throw error
        }
        currentSessionId = newSession.id
        setSessionId(newSession.id)

        // Apply shuffling with new session ID
        if (examData.questions_shuffled && originalQuestions.length > 0) {
          const shuffled = generateShuffleOrder(originalQuestions, newSession.id, "questions")

          // Apply option shuffling if enabled
          let finalQuestions = shuffled
          if (examData.options_shuffled) {
            finalQuestions = shuffled.map((question) => {
              if (question.options && question.options.length > 0) {
                const shuffledOptions = generateShuffleOrder(
                  question.options,
                  `${newSession.id}-${question.id}`,
                  "options",
                )

                const newCorrectIndex = shuffledOptions.findIndex((opt: any) => opt.is_correct)

                return {
                  ...question,
                  options: shuffledOptions,
                  correct_answer_index: newCorrectIndex >= 0 ? newCorrectIndex : question.correct_answer_index,
                }
              }
              return question
            })
          }

          setQuestions(finalQuestions)
        }
      }

      setExamStatus("in-progress")

      // Automatic fullscreen without user interaction
      try {
        const elem = document.documentElement
        if (elem.requestFullscreen && !document.fullscreenElement) {
          await elem.requestFullscreen()
          setIsFullscreenActive(true)
        }
      } catch (err) {
        console.warn("Fullscreen request failed:", err)
      }
    } catch (err) {
      console.error("Error starting exam:", err)
      toast.error("Failed to start exam")
    }
  }

  const handleAnswerChange = async (optionIndex: number) => {
    const newAnswers = [...answers]
    newAnswers[currentQuestionIndex] = optionIndex
    setAnswers(newAnswers)

    if (sessionId && questions[currentQuestionIndex]) {
      try {
        const question = questions[currentQuestionIndex]
        const isCorrect = question.correct_answer_index === optionIndex
        
        await supabase
          .from("student_answers")
          .upsert({
            session_id: sessionId,
            question_id: question.id,
            selected_option_id: optionIndex,
            is_correct: isCorrect,
            is_flagged: flaggedQuestions.has(currentQuestionIndex),
            answered_at: new Date().toISOString()
          }, {
            onConflict: 'session_id,question_id'
          })
      } catch (error) {
        console.error("Error saving answer:", error)
      }
    }
  }

  const handleToggleFlag = async () => {
    const newFlags = new Set(flaggedQuestions)
    if (newFlags.has(currentQuestionIndex)) {
      newFlags.delete(currentQuestionIndex)
    } else {
      newFlags.add(currentQuestionIndex)
    }
    setFlaggedQuestions(newFlags)

    if (sessionId && questions[currentQuestionIndex]) {
      const question = questions[currentQuestionIndex]
      const currentAnswer = answers[currentQuestionIndex]
      const isCorrect = currentAnswer !== null ? question.correct_answer_index === currentAnswer : false
      
      try {
        await supabase
          .from("student_answers")
          .upsert({
            session_id: sessionId,
            question_id: question.id,
            selected_option_id: currentAnswer,
            is_correct: isCorrect,
            is_flagged: newFlags.has(currentQuestionIndex)
          }, {
            onConflict: 'session_id,question_id'
          })
      } catch (error) {
        console.error("Error saving flag:", error)
      }
    }
  }

  const handleFinalSubmit = async () => {
    if (isSubmitting) return

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    if (timeSyncIntervalRef.current) {
      clearInterval(timeSyncIntervalRef.current)
      timeSyncIntervalRef.current = null
    }

    setIsConfirmModalOpen(false)
    setIsSubmitting(true)

    try {
      let totalMarksObtained = 0
      let correctCount = 0
      
      answers.forEach((answerIndex, qIndex) => {
        if (answerIndex !== null) {
          const question = questions[qIndex]
          if (question && question.correct_answer_index === answerIndex) {
            correctCount++
            totalMarksObtained += question.marks || 1
          }
        }
      })

      const totalQuestions = questions.length
      const totalPossibleMarks = examData.total_marks
      const percentage = Math.round((correctCount / totalQuestions) * 100)

      // Calculate grade based on percentage
      let grade = 'F'
      if (percentage >= 90) grade = 'A'
      else if (percentage >= 80) grade = 'B'
      else if (percentage >= 70) grade = 'C'
      else if (percentage >= 60) grade = 'D'

      if (sessionId) {
        const { error: sessionError } = await supabase
          .from("exam_sessions")
          .update({
            status: "submitted",
            score: totalMarksObtained,
            submitted_at: new Date().toISOString(),
            time_remaining: 0,
            updated_at: new Date().toISOString()
          })
          .eq("id", sessionId)

        if (sessionError) {
          console.error("Error updating exam session:", sessionError)
          throw sessionError
        }

        const { data: result, error: resultError } = await supabase
          .from("results")
          .upsert({
            exam_id: examData.id,
            student_id: studentInfo.id,
            teacher_id: examData.created_by,
            total_marks_obtained: totalMarksObtained,
            grade: grade,
            comments: `Scored ${totalMarksObtained} out of ${totalPossibleMarks} marks - ${correctCount} correct answers out of ${totalQuestions} questions (${percentage}%)`,
            submission_time: new Date().toISOString()
          }, {
            onConflict: 'exam_id,student_id'
          })
          .select()
          .single()

        if (resultError) {
          console.error("Error saving result:", resultError)
          throw resultError
        }

        setExamResults(result)
      }

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }

      // Check if results should be shown
      if (examData.show_results !== false) {
        setExamStatus("results")
      } else {
        setExamStatus("completed")
      }
      toast.success("Exam submitted successfully!")

    } catch (err) {
      console.error("Error submitting exam:", err)
      toast.error("Failed to submit exam. Please try again.")
      setIsSubmitting(false)
    }
  }

  const openPassage = (passageHtml: string) => {
    setCurrentPassageHtml(passageHtml)
    setShowPassageModal(true)
  }

  const toggleTimerVisibility = () => {
    setIsTimerVisible(!isTimerVisible)
  }

  // Simple sidebar toggle function
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  // Determine device type for responsive design
  const getDeviceType = () => {
    if (windowWidth < 768) return 'mobile'
    if (windowWidth < 1024) return 'tablet'
    return 'desktop'
  }

  const deviceType = getDeviceType()
  const isMobile = deviceType === 'mobile'

  if (showAlreadyInProgressModal) {
    return (
      <ExamAlreadyInProgressModal
        existingSession={existingActiveSession}
        onResume={handleResumeExistingSession}
        onCancel={handleCancelExistingSession}
      />
    )
  }

  if (examStatus === "terminated") {
    return <ExamTerminatedModal onClose={() => router.push("/")} />
  }

  if (examStatus === "loading") {
    return <ExamInstructions examData={{}} onStartExam={() => {}} isLoading={true} isResuming={false} />
  }

  if (examStatus === "instructions") {
    return <ExamInstructions examData={examData} onStartExam={handleStartExam} isLoading={false} isResuming={isResuming} />
  }

  if (examStatus === "results") {
    return (
      <ExamResultsView 
        examData={examData}
        studentInfo={studentInfo}
        results={examResults}
        questions={questions}
        answers={answers}
      />
    )
  }

  if (examStatus === "completed") {
    return <ExamResultsDisabledView />
  }

  if (showFullscreenWarning) {
    return <FullscreenWarningModal onRetry={handleRetryFullscreen} />
  }

  if (!questions.length || !questions[currentQuestionIndex]) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const shouldTruncate = currentQuestion.question_text && currentQuestion.question_text.length > 200
  const truncatedText = shouldTruncate ? truncateText(currentQuestion.question_text, 200) : currentQuestion.question_text

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 select-none">
      <PassageModal
        isOpen={showPassageModal}
        onClose={() => setShowPassageModal(false)}
        passageHtml={currentPassageHtml}
        questionNumber={currentQuestionIndex + 1}
      />

      <FullQuestionModal
        isOpen={showFullQuestionModal}
        onClose={() => setShowFullQuestionModal(false)}
        questionText={currentQuestion.question_text}
        questionNumber={currentQuestionIndex + 1}
        totalQuestions={questions.length}
      />

      {/* Mobile Sheet */}
      {isMobile ? (
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>Questions</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-5 gap-2">
                {questions.map((_, index) => {
                  const isAnswered = answers[index] !== null
                  const isFlagged = flaggedQuestions.has(index)
                  const isCurrent = currentQuestionIndex === index
                  return (
                    <Button
                      key={index}
                      variant={isCurrent ? "default" : isAnswered ? "secondary" : "outline"}
                      className={cn(
                        "h-10 w-10 p-0 relative",
                        isCurrent && "ring-2 ring-blue-500 ring-offset-2",
                        !isCurrent && isAnswered && "bg-green-100 text-green-800 border-green-300"
                      )}
                      onClick={() => {
                        setCurrentQuestionIndex(index)
                        setIsSidebarOpen(false)
                      }}
                    >
                      {isFlagged && <Flag className="absolute -top-1 -right-1 h-4 w-4 text-amber-500 fill-amber-500" />}
                      {index + 1}
                    </Button>
                  )
                })}
              </div>
            </div>
            <div className="p-4 border-t">
              <h3 className="text-sm font-semibold mb-3">Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center text-green-600">
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Answered</span>
                  <span className="font-semibold">{stats.answered}</span>
                </div>
                <div className="flex justify-between items-center text-gray-500">
                  <span className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /> Unanswered</span>
                  <span className="font-semibold">{stats.unanswered}</span>
                </div>
                <div className="flex justify-between items-center text-amber-600">
                  <span className="flex items-center gap-2"><Flag className="h-4 w-4" /> Flagged</span>
                  <span className="font-semibold">{stats.flagged}</span>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        // Desktop/Tab Sidebar
        <aside className={cn(
          "bg-white border-r flex flex-col transition-all duration-300 ease-in-out",
          isSidebarOpen ? "w-64 md:w-72 p-4" : "w-0 p-0 border-0 overflow-hidden"
        )}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Questions</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="grid grid-cols-5 gap-2 p-2">
              {questions.map((_, index) => {
                const isAnswered = answers[index] !== null
                const isFlagged = flaggedQuestions.has(index)
                const isCurrent = currentQuestionIndex === index
                return (
                  <Button
                    key={index}
                    variant={isCurrent ? "default" : isAnswered ? "secondary" : "outline"}
                    className={cn(
                      "h-10 w-10 p-0 relative text-sm",
                      isCurrent && "ring-2 ring-blue-500 ring-offset-2",
                      !isCurrent && isAnswered && "bg-green-100 text-green-800 border-green-300"
                    )}
                    onClick={() => setCurrentQuestionIndex(index)}
                  >
                    {isFlagged && <Flag className="absolute -top-1 -right-1 h-3 w-3 text-amber-500 fill-amber-500" />}
                    {index + 1}
                  </Button>
                )
              })}
            </div>
          </div>
          <div className="mt-auto pt-4 border-t">
            <h3 className="text-sm font-semibold mb-3">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center text-green-600">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Answered</span>
                <span className="font-semibold">{stats.answered}</span>
              </div>
              <div className="flex justify-between items-center text-gray-500">
                <span className="flex items-center gap-2"><HelpCircle className="h-3 w-3" /> Unanswered</span>
                <span className="font-semibold">{stats.unanswered}</span>
              </div>
              <div className="flex justify-between items-center text-amber-600">
                <span className="flex items-center gap-2"><Flag className="h-3 w-3" /> Flagged</span>
                <span className="font-semibold">{stats.flagged}</span>
              </div>
            </div>
          </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between p-3 sm:p-4 border-b bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={toggleSidebar} 
              className="h-9 w-9"
            >
              {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold truncate max-w-[150px] sm:max-w-none">{examData?.title || "Exam"}</h1>
              {!isFullscreenActive && examStatus === "in-progress" && (
                <p className="text-xs text-red-600 font-medium">⚠️ Return to fullscreen</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            {/* Timer with hide/show button */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleTimerVisibility}
                className="h-8 w-8"
              >
                {isTimerVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              {isTimerVisible && (
                <div className="flex items-center gap-2 text-base sm:text-lg font-semibold font-mono">
                  <Clock className={`h-5 w-5 sm:h-6 sm:w-6 ${timeLeft < 300 ? "text-red-600" : "text-blue-600"}`} />
                  <span className={timeLeft < 300 ? "text-red-600" : ""}>{formatTime(timeLeft)}</span>
                </div>
              )}
            </div>
            
            <Separator orientation="vertical" className="h-6 sm:h-8" />
            <div className="flex items-center gap-2 sm:gap-3">
              <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                <AvatarFallback className="text-xs sm:text-sm">
                  {studentInfo?.name?.split(" ").map((n: string) => n[0]).join("") || "ST"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="font-semibold text-sm">{studentInfo?.name}</p>
                <p className="text-xs text-gray-500">{studentInfo?.student_id}</p>
              </div>
            </div>
            <Button variant="destructive" onClick={() => setIsConfirmModalOpen(true)} disabled={isSubmitting} className="h-9 px-3 text-sm sm:h-10 sm:px-4 sm:text-base">
              <Send className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              <span className="hidden sm:inline">Submit</span>
              <span className="sm:hidden">End</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10 overflow-y-auto">
          <Card className="shadow-md">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Question {currentQuestionIndex + 1} of {questions.length}</p>

                  {/* Passage button - always shows if there's a passage */}
                  {currentQuestion.has_passage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 mb-3"
                      onClick={() => openPassage(currentQuestion.passage_html)}
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      View Passage
                    </Button>
                  )}

                  <CardTitle className="pt-2 text-lg sm:text-xl md:text-2xl leading-relaxed">
                    {renderWithMath(truncatedText)}
                    {shouldTruncate && (
                      <Button
                        variant="link"
                        className="ml-2 p-0 h-auto text-blue-600 text-sm sm:text-base"
                        onClick={() => setShowFullQuestionModal(true)}
                      >
                        Read Full Question
                      </Button>
                    )}
                  </CardTitle>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleToggleFlag}
                  className={cn(
                    "flex-shrink-0",
                    flaggedQuestions.has(currentQuestionIndex) && 
                    "bg-amber-100 text-amber-800 border-amber-300"
                  )}
                >
                  <Flag className="h-4 w-4 mr-2" /> 
                  {flaggedQuestions.has(currentQuestionIndex) ? "Flagged" : "Flag"}
                </Button>
              </div>

              {currentQuestion.image_url && (
                <div className="mt-4 mb-4 sm:mb-6">
                  <div className="relative">
                    <img 
                      src={currentQuestion.image_url || "/placeholder.svg"} 
                      alt="Question" 
                      className="w-full h-auto max-h-48 sm:max-h-64 object-contain rounded-lg border"
                    />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <RadioGroup 
                value={answers[currentQuestionIndex]?.toString() ?? ""} 
                onValueChange={(val) => handleAnswerChange(Number(val))} 
                className="space-y-3 sm:space-y-4"
              >
                {currentQuestion.options?.map((option: any, index: number) => {
                  const optionLetter = String.fromCharCode(65 + index)
                  const isSelected = answers[currentQuestionIndex] === index
                  const hasImage = option.image
                  
                  return (
                    <div
                      key={index}
                      className={cn(
                        "relative flex flex-col sm:flex-row p-3 sm:p-4 rounded-lg border-2 transition-all cursor-pointer hover:bg-gray-50",
                        isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200",
                        hasImage ? "items-start" : "items-center"
                      )}
                      onClick={() => handleAnswerChange(index)}
                    >
                      {/* Hidden radio input for accessibility */}
                      <RadioGroupItem value={index.toString()} id={`option-${index}`} className="sr-only" />
                      
                      {/* Layout with image on left */}
                      <div className="flex w-full">
                        {/* Option image on LEFT side if exists */}
                        {hasImage && (
                          <div className="flex-shrink-0 mr-4 w-32 sm:w-40 h-24 sm:h-28">
                            <div className="w-full h-full rounded-lg overflow-hidden border bg-gray-50">
                              <img
                                src={option.image || "/placeholder.svg"}
                                alt={`Option ${optionLetter}`}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* Option content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            {/* Option letter badge */}
                            <div className={cn(
                              "flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mr-3 sm:mr-4 font-bold text-base sm:text-lg",
                              isSelected 
                                ? "bg-blue-500 text-white" 
                                : "bg-gray-100 text-gray-700 border border-gray-300"
                            )}>
                              {optionLetter}
                            </div>
                            
                            {/* Option text content */}
                            <div className="flex-1 min-w-0">
                              <Label htmlFor={`option-${index}`} className="cursor-pointer block">
                                <div className="text-sm sm:text-base font-medium whitespace-normal">
                                  <span className="inline-block align-middle">
                                    {renderWithMath(option.text)}
                                  </span>
                                </div>
                              </Label>
                            </div>
                            
                            {/* Selection indicator */}
                            {isSelected && (
                              <div className="flex-shrink-0 ml-2 sm:ml-4">
                                <Check className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                              </div>
                            )}
                          </div>
                          
                          {/* Image label for mobile */}
                          {hasImage && isMobile && (
                            <p className="text-xs text-gray-500 mt-2 ml-12">Option {optionLetter} Image</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </RadioGroup>
            </CardContent>
          </Card>

          <div className="flex justify-between mt-4 sm:mt-6">
            <Button 
              variant="outline" 
              onClick={() => setCurrentQuestionIndex((p) => p - 1)} 
              disabled={currentQuestionIndex === 0}
              className="h-9 sm:h-10"
            >
              <ChevronLeft className="h-4 w-4 mr-2" /> Previous
            </Button>
            <Button 
              onClick={() => setCurrentQuestionIndex((p) => p + 1)} 
              disabled={currentQuestionIndex === questions.length - 1}
              className="bg-blue-600 hover:bg-blue-700 h-9 sm:h-10"
            >
              Next <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </main>
      </div>

      <AlertDialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit your exam? This action cannot be undone.
              <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.answered}</div>
                    <div className="text-xs sm:text-sm text-gray-600">Answered</div>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-600">{stats.unanswered}</div>
                    <div className="text-xs sm:text-sm text-gray-600">Unanswered</div>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-amber-600">{stats.flagged}</div>
                    <div className="text-xs sm:text-sm text-gray-600">Flagged</div>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Continue Exam</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalSubmit} disabled={isSubmitting} className="w-full sm:w-auto bg-red-600 hover:bg-red-700">
              {isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
              Submit Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}