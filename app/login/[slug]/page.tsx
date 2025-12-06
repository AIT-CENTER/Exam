"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import { Loader2, Mail, Phone, Lock, Shield, BookOpen, ChevronRight, Home } from "lucide-react"
import bcrypt from "bcryptjs"
import { setTeacherDataCookie } from "@/utils/teacherCookie"

const VALID_SLUG = process.env.NEXT_PUBLIC_TEACHER_LOGIN_SLUG || "tech"

// Validation schema
const loginSchema = z.object({
  emailOrPhone: z
    .string()
    .min(1, { message: "Email or phone number is required" })
    .refine(
      (val) => {
        if (val.includes("@")) {
          return z.string().email().safeParse(val).success
        }
        const phoneRegex = /^(09|\+2519)\d{8}$/
        return phoneRegex.test(val)
      },
      {
        message: "Enter a valid email or Ethiopian phone number (09xxxxxxxx or +2519xxxxxxxx)",
      },
    ),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(50, { message: "Password too long" }),
})

type LoginForm = z.infer<typeof loginSchema>

interface TeacherAssignment {
  id: string
  username: string
  full_name: string
  email: string
  phone_number: string
  grade_id: number
  subject_id: number
  section: string
  grade_name: string
  subject_name: string
  stream: string | null // Added stream field
}

export default function TeacherLogin() {
  const router = useRouter()
  const [isValidAccess, setIsValidAccess] = useState(false)
  const [currentSlug, setCurrentSlug] = useState<string | null>(null)
  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const [displayText, setDisplayText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const [showSubjectSelection, setShowSubjectSelection] = useState(false)
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherAssignment | null>(null)

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      emailOrPhone: "",
      password: "",
    },
  })

  // Check if this is a valid access through URL slug
  useEffect(() => {
    const pathSegments = window.location.pathname.split("/login/").filter(Boolean)
    const urlSlug = pathSegments[0] || ""
    setCurrentSlug(urlSlug)

    if (!VALID_SLUG) {
      setIsValidAccess(true)
      return
    }

    if (urlSlug === VALID_SLUG) {
      setIsValidAccess(true)
    } else {
      toast.error("Invalid access link")
      setTimeout(() => router.replace("/404"), 2000)
    }
  }, [router])

  const motivationalTexts = [
    "Welcome Back, Inspiring Educator!",
    "Shape the Future, One Student at a Time",
    "Your Passion Changes Lives Every Day",
    "Great Teachers Build Great Nations",
    "Empower Minds, Inspire Dreams",
    "Today's Lessons, Tomorrow's Leaders",
  ]

  useEffect(() => {
    if (!isValidAccess) return

    const currentText = motivationalTexts[currentTextIndex]

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (displayText.length < currentText.length) {
            setDisplayText(currentText.slice(0, displayText.length + 1))
          } else {
            setTimeout(() => setIsDeleting(true), 2000)
          }
        } else {
          if (displayText.length > 0) {
            setDisplayText(displayText.slice(0, displayText.length - 1))
          } else {
            setIsDeleting(false)
            setCurrentTextIndex((prev) => (prev + 1) % motivationalTexts.length)
          }
        }
      },
      isDeleting ? 50 : 100,
    )

    return () => clearTimeout(timeout)
  }, [displayText, isDeleting, currentTextIndex, isValidAccess])

  const onSubmit = async (data: LoginForm) => {
    if (VALID_SLUG && currentSlug !== VALID_SLUG) {
      toast.error("Invalid access")
      return
    }

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const isEmail = emailRegex.test(data.emailOrPhone)

      let query = supabase.from("teacher").select(`
          id,
          username,
          full_name,
          email,
          phone_number,
          password,
          grade_id,
          subject_id,
          section,
          stream,
          grades (id, grade_name),
          subjects (id, subject_name)
        `)

      if (isEmail) {
        query = query.eq("email", data.emailOrPhone)
      } else {
        query = query.eq("phone_number", data.emailOrPhone)
      }

      const { data: teacherRecords, error: teacherError } = await query

      if (teacherError) {
        console.error("Teacher query error:", teacherError)
        throw new Error("Teacher not found. Please check your credentials.")
      }

      if (!teacherRecords || teacherRecords.length === 0) {
        throw new Error("Teacher not found. Please check your credentials.")
      }

      // Verify password with the first record (all records should have the same password)
      const firstRecord = teacherRecords[0]
      if (!firstRecord.password) {
        throw new Error("Password not set. Please contact administrator.")
      }

      const isPasswordValid = await bcrypt.compare(data.password, firstRecord.password)

      if (!isPasswordValid) {
        throw new Error("Invalid password. Please try again.")
      }

      if (teacherRecords.length > 1) {
        const assignments: TeacherAssignment[] = teacherRecords.map((record: any) => ({
          id: record.id,
          username: record.username,
          full_name: record.full_name,
          email: record.email,
          phone_number: record.phone_number,
          grade_id: record.grade_id,
          subject_id: record.subject_id,
          section: record.section,
          grade_name: record.grades?.grade_name || "Not assigned",
          subject_name: record.subjects?.subject_name || "Not assigned",
          stream: record.stream, // Using actual stream from database
        }))

        setTeacherAssignments(assignments)
        setShowSubjectSelection(true)
        return
      }

      // Single assignment - proceed directly to dashboard
      await proceedToDashboard(teacherRecords[0])
    } catch (error: any) {
      console.error("Login error:", error)
      toast.error(error.message || "Login failed. Please check your credentials.")
    }
  }

  const proceedToDashboard = async (teacherData: any) => {
    const cookieData = {
      teacherId: teacherData.id,
      username: teacherData.username,
      fullName: teacherData.full_name,
      email: teacherData.email,
      phoneNumber: teacherData.phone_number,
      gradeId: teacherData.grade_id,
      subjectId: teacherData.subject_id,
      section: teacherData.section,
      stream: teacherData.stream || null, // Using actual stream value from database
      gradeName: teacherData.grades?.grade_name || teacherData.grade_name || "Not assigned",
      subjectName: teacherData.subjects?.subject_name || teacherData.subject_name || "Not assigned",
      sections: teacherData.section ? teacherData.section.split(",").map((s: string) => s.trim()) : [],
    }

    setTeacherDataCookie(cookieData)
    toast.success("Login successful!")
    router.push("/teacher")
  }

  const handleSelectAssignment = async (assignment: TeacherAssignment) => {
    setSelectedAssignment(assignment)
    await proceedToDashboard(assignment)
  }

  const handleGoToDashboard = () => {
    router.push("/teacher")
  }

  // Wrong slug page
  if (VALID_SLUG && currentSlug !== VALID_SLUG) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="text-center space-y-6">
          <Shield className="h-20 w-20 text-red-500 mx-auto animate-pulse" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-muted-foreground mt-2">This teacher portal does not exist</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isValidAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    )
  }

  if (showSubjectSelection) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
        {/* Left Side */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-8 bg-gradient-to-br from-indigo-900 via-blue-900 to-purple-900 text-white">
          <div className="max-w-2xl text-center space-y-8">
            <div className="mb-12">
              <h1 className="text-5xl font-bold mb-4">Welcome, {teacherAssignments[0]?.full_name}!</h1>
            </div>
            <div className="h-32 flex items-center justify-center">
              <h2 className="text-2xl font-medium">
                You are assigned to multiple subjects. Please select which one you want to work with today.
              </h2>
            </div>
            <div className="mt-12 p-6 bg-white/10 rounded-lg backdrop-blur-sm">
              <p className="text-lg italic">"Every expert was once a beginner."</p>
              <p className="text-blue-200 mt-2">- Helen Hayes</p>
            </div>
          </div>
        </div>

        {/* Right Side - Subject Selection */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-none shadow-2xl">
            <CardHeader className="space-y-1">
              <div className="flex justify-between items-center">
                <CardTitle className="text-2xl font-bold text-gray-800">Select Your Subject</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGoToDashboard}
                  className="flex items-center gap-2 bg-transparent"
                >
                  <Home className="h-4 w-4" />
                  Go to Dashboard
                </Button>
              </div>
              <p className="text-center text-muted-foreground">Choose which subject you want to work with</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {teacherAssignments.map((assignment) => (
                <button
                  key={`${assignment.id}-${assignment.subject_id}`}
                  onClick={() => handleSelectAssignment(assignment)}
                  className="w-full p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                      <BookOpen className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{assignment.subject_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {assignment.grade_name} - Section {assignment.section}
                        {assignment.stream && ` • ${assignment.stream} Stream`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </button>
              ))}

              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={() => {
                    setShowSubjectSelection(false)
                    setTeacherAssignments([])
                    form.reset()
                  }}
                >
                  Back to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      {/* Left Side - Motivational Text */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-8 bg-gradient-to-br from-indigo-900 via-blue-900 to-purple-900 text-white">
        <div className="max-w-2xl text-center space-y-8">
          <div className="mb-12">
            <h1 className="text-5xl font-bold mb-4 animate-fade-in">Welcome Back Mr. Teacher!</h1>
          </div>

          <div className="h-32 flex items-center justify-center">
            <h2 className="text-3xl font-semibold min-h-[120px] flex items-center justify-center">
              <span className="border-r-2 border-white pr-2 animate-pulse">{displayText}</span>
            </h2>
          </div>

          <div className="mt-12 p-6 bg-white/10 rounded-lg backdrop-blur-sm animate-fade-in">
            <p className="text-lg italic">"The art of teaching is the art of assisting discovery."</p>
            <p className="text-blue-200 mt-2">- Mark Van Doren</p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4">
        <div className="absolute top-6 right-6">
          <Button variant="outline" onClick={handleGoToDashboard} className="flex items-center gap-2 bg-transparent">
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Button>
        </div>

        <Card className="w-full max-w-md border-none shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center text-gray-800">Teacher Login</CardTitle>
            <p className="text-center text-muted-foreground">Enter your credentials to access your dashboard</p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Email or Phone Field */}
                <FormField
                  control={form.control}
                  name="emailOrPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">Email / Phone Number</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className="absolute left-3 top-3.5">
                            {field.value?.includes("@") ? (
                              <Mail className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Phone className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <Input
                            {...field}
                            placeholder="09xxxxxxxx or example@gmail.com"
                            className="pl-11 h-12 text-base"
                            autoFocus
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-sm font-medium" />
                    </FormItem>
                  )}
                />

                {/* Password Field */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="Enter your password"
                            className="pl-11 h-12 text-base"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-sm font-medium" />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-semibold"
                  disabled={form.formState.isSubmitting || !form.formState.isValid}
                  size="lg"
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Login to Dashboard"
                  )}
                </Button>
              </form>
            </Form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Forgot password? <button className="text-blue-600 hover:text-blue-800 font-medium">Contact admin</button>
            </p>
            <p className="text-sm ml-9 text-gray-500">
              Developer By Alpha Institute Tech{" "}
              <a target="_blank" className="text-gray-900 text-center" href="https://alphainstitutetech.com" rel="noreferrer">
                (AIT Tech Center)
              </a>
            </p>
          </CardContent>
        </Card>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
      `}</style>
    </div>
  )
}
