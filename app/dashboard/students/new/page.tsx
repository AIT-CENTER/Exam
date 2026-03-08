"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Calendar as CalendarIcon, UserPlus, Users, Settings, Plus, Trash2, Upload, RefreshCw, AlertTriangle, AlertCircle, Download } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { createBrowserClient } from "@supabase/ssr"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"

const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface Grade {
  id: number
  grade_name: string
}

interface Section {
  id: number
  section_name: string
  grade_id: number
  stream: string | null
}

interface Subject {
  id: number
  subject_name: string
  stream: string | null
}

interface BulkStudent {
  id: string
  name: string
  father_name: string
  grandfather_name: string
  gender: string
  date_of_birth: string
  phone: string
  address: string
  parent_name: string
  parent_phone: string
  grade_id: string
  section: string
  stream: string
  email: string
  student_id: string
}

interface IdConfig {
  prefix: string
  digits: number
  separator: string
}

interface DuplicateCheck {
  exists: boolean
  message: string
}

// Premium spinner matching the dashboard
function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[70vh] w-full bg-transparent">
      <style>{`
        .spinner-svg {
          animation: spinner-rotate 2s linear infinite;
        }
        .spinner-circle {
          stroke-dasharray: 1, 200;
          stroke-dashoffset: 0;
          animation: spinner-stretch 1.5s ease-in-out infinite;
          stroke-linecap: round;
        }
        @keyframes spinner-rotate {
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes spinner-stretch {
          0% {
            stroke-dasharray: 1, 200;
            stroke-dashoffset: 0;
          }
          50% {
            stroke-dasharray: 90, 200;
            stroke-dashoffset: -35px;
          }
          100% {
            stroke-dasharray: 90, 200;
            stroke-dashoffset: -124px;
          }
        }
      `}</style>
      
      <svg
        className="h-10 w-10 text-zinc-800 dark:text-zinc-200 spinner-svg"
        viewBox="25 25 50 50"
      >
        <circle
          className="spinner-circle"
          cx="50"
          cy="50"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        />
      </svg>
    </div>
  );
}

export default function NewStudentPage() {
  // ID Configuration State
  const [idConfig, setIdConfig] = useState<IdConfig>({
    prefix: "S",
    digits: 6,
    separator: "",
  })
  const [showIdSettings, setShowIdSettings] = useState(false)
  const [tempIdConfig, setTempIdConfig] = useState<IdConfig>(idConfig)

  // Single Student Form State
  const [formData, setFormData] = useState({
    name: "",
    father_name: "",
    grandfather_name: "",
    gender: "",
    date_of_birth: "",
    phone: "",
    address: "",
    parent_name: "",
    parent_phone: "",
    grade_id: "",
    section: "",
    stream: "",
    email: "",
  })

  const [studentId, setStudentId] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicateError, setDuplicateError] = useState<DuplicateCheck | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  // Bulk Import State
  const [bulkStudents, setBulkStudents] = useState<BulkStudent[]>([createEmptyBulkStudent()])
  const [bulkGradeId, setBulkGradeId] = useState("")
  const [bulkSection, setBulkSection] = useState("")
  const [bulkStream, setBulkStream] = useState("")
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkErrors, setBulkErrors] = useState<Record<string, Record<string, string>>>({})
  const [bulkDuplicateErrors, setBulkDuplicateErrors] = useState<Record<string, string>>({})

  // Import State
  const [importProgress, setImportProgress] = useState(0)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Shared State
  const [grades, setGrades] = useState<Grade[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [gradeSubjects, setGradeSubjects] = useState<Record<number, Record<string, number[]>>>({}) // grade_id -> stream -> subject_ids
  const [gradesLoading, setGradesLoading] = useState(true)

  const streamOptions = ["Natural", "Social"]

  function createEmptyBulkStudent(): BulkStudent {
    return {
      id: crypto.randomUUID(),
      name: "",
      father_name: "",
      grandfather_name: "",
      gender: "",
      date_of_birth: "",
      phone: "",
      address: "",
      parent_name: "",
      parent_phone: "",
      grade_id: "",
      section: "",
      stream: "",
      email: "",
      student_id: "",
    }
  }

  function getFullName(student: BulkStudent): string {
    return [student.name, student.father_name, student.grandfather_name].filter(Boolean).join(" ")
  }

  function parseFullName(fullName: string): { name: string; father_name: string; grandfather_name: string } {
    const parts = fullName.trim().split(/\s+/)
    return {
      name: parts[0] ?? "",
      father_name: parts[1] ?? "",
      grandfather_name: parts[2] ?? "",
    }
  }

  function validateFullName(fullName: string): string {
    const trimmed = fullName.trim()
    if (!trimmed) return "Full name is required"
    const parts = trimmed.split(/\s+/)
    if (parts.length !== 3) return "Must have 3 parts: name father grandfather (2 spaces)"
    for (const part of parts) {
      if (part.length < 2) return "Each part must be at least 2 characters"
      if (!/^[a-zA-Z]+$/.test(part)) return "Each part must contain only letters"
    }
    return ""
  }

  function generateStudentIdWithConfig(config: IdConfig): string {
    const max = Math.pow(10, config.digits) - 1
    const min = Math.pow(10, config.digits - 1)
    const randomDigits = Math.floor(min + Math.random() * (max - min + 1))
      .toString()
      .padStart(config.digits, "0")
    const sep = config.separator === "none" ? "" : config.separator
    return `${config.prefix}${sep}${randomDigits}`
  }

  useEffect(() => {
    setStudentId(generateStudentIdWithConfig(idConfig))
    fetchGrades()
    fetchSections()
    fetchSubjects()
    fetchGradeSubjects()
  }, [])

  useEffect(() => {
    setStudentId(generateStudentIdWithConfig(idConfig))
  }, [idConfig])

  const fetchGrades = async () => {
    try {
      const { data, error } = await supabase.from("grades").select("id, grade_name").order("id", { ascending: true })

      if (error) throw error
      setGrades(data || [])
    } catch (error) {
      console.error("Error fetching grades:", error)
      toast.error("Failed to load grades")
    } finally {
      setGradesLoading(false)
    }
  }

  const fetchSections = async () => {
    try {
      const { data, error } = await supabase
        .from("grade_sections")
        .select("id, grade_id, section_name, stream")
        .order("section_name", { ascending: true })

      if (error) throw error
      setSections((data || []).map((s: any) => ({ ...s, stream: s.stream ?? null })))
    } catch (error) {
      console.error("Error fetching sections:", error)
    }
  }

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, subject_name, stream")
        .order("subject_name", { ascending: true })

      if (error) throw error
      setSubjects(data || [])
    } catch (error) {
      console.error("Error fetching subjects:", error)
    }
  }

  const fetchGradeSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from("grade_subjects")
        .select("grade_id, subject_id, stream")

      if (error) {
        console.warn("grade_subjects table may not exist yet")
        return
      }

      const gradeSubjectsMap: Record<number, Record<string, number[]>> = {}
      data?.forEach((item: any) => {
        const stream = item.stream ?? "Common"
        if (!gradeSubjectsMap[item.grade_id]) {
          gradeSubjectsMap[item.grade_id] = { Common: [], Natural: [], Social: [] }
        }
        if (!gradeSubjectsMap[item.grade_id][stream]) {
          gradeSubjectsMap[item.grade_id][stream] = []
        }
        gradeSubjectsMap[item.grade_id][stream].push(item.subject_id)
      })

      setGradeSubjects(gradeSubjectsMap)
    } catch (error) {
      console.error("Error fetching grade subjects:", error)
    }
  }

  const getSectionsForGrade = (gradeId: string, stream?: string | null) => {
    if (!gradeId) return []
    const gid = Number.parseInt(gradeId)
    const grade = grades.find((g) => g.id === gid)
    const isStreamed = grade && (grade.grade_name.includes("11") || grade.grade_name.includes("12"))
    if (isStreamed && stream) {
      return sections.filter((s) => s.grade_id === gid && s.stream === stream)
    }
    return sections.filter((s) => s.grade_id === gid && s.stream == null)
  }

  const getSubjectsForGradeAndStream = (gradeId: string, stream: string) => {
    if (!gradeId) return []
    const gradeIdNum = Number.parseInt(gradeId)
    const byStream = gradeSubjects[gradeIdNum] || { Common: [], Natural: [], Social: [] }
    const streamIds = byStream[stream] || []
    const commonIds = byStream.Common || []
    const allowedIds = new Set([...streamIds, ...commonIds])
    if (allowedIds.size === 0) {
      return subjects.filter((s) => s.stream === stream || s.stream === "Common" || !s.stream)
    }
    return subjects.filter((s) => allowedIds.has(s.id))
  }

  const handleSaveIdConfig = () => {
    setIdConfig(tempIdConfig)
    setShowIdSettings(false)
    toast.success("ID format updated successfully")
  }

  const checkDuplicateStudent = async (
    name: string,
    fatherName: string,
    grandfatherName: string,
    gradeId: string,
    section: string,
  ): Promise<DuplicateCheck> => {
    if (!name || !fatherName || !grandfatherName || !gradeId || !section) {
      return { exists: false, message: "" }
    }

    try {
      const { data, error } = await supabase
        .from("students")
        .select("name, father_name, grandfather_name, grade_id, section, student_id")
        .eq("name", name.trim())
        .eq("father_name", fatherName.trim())
        .eq("grandfather_name", grandfatherName.trim())
        .eq("grade_id", Number.parseInt(gradeId))
        .eq("section", section)
        .maybeSingle()

      if (error && error.code !== "PGRST116") {
        throw error
      }

      if (data) {
        const grade = grades.find((g) => g.id === Number.parseInt(gradeId))
        const gradeName = grade ? grade.grade_name : `Grade ${gradeId}`

        return {
          exists: true,
          message: `Student "${name.trim()} ${fatherName.trim()} ${grandfatherName.trim()}" already exists in ${gradeName}, Section ${section} (ID: ${data.student_id})`,
        }
      }

      return { exists: false, message: "" }
    } catch (error) {
      console.error("Error checking duplicate:", error)
      return { exists: false, message: "Error checking duplicate" }
    }
  }

  const checkDuplicateStudentId = async (studentId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("student_id")
        .eq("student_id", studentId)
        .maybeSingle()

      if (error && error.code !== "PGRST116") {
        throw error
      }

      return !!data
    } catch (error) {
      console.error("Error checking duplicate ID:", error)
      return false
    }
  }

  const generateUniqueStudentId = async (): Promise<string> => {
    let newId = generateStudentIdWithConfig(idConfig)
    let attempts = 0
    const maxAttempts = 20

    while (attempts < maxAttempts) {
      const isDuplicate = await checkDuplicateStudentId(newId)
      if (!isDuplicate) {
        return newId
      }
      newId = generateStudentIdWithConfig(idConfig)
      attempts++
    }

    return `${generateStudentIdWithConfig(idConfig)}-${Date.now().toString().slice(-4)}`
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
    if (name === "name" || name === "father_name" || name === "grandfather_name") {
      setDuplicateError(null)
    }
  }

  const handleSingleFullNameChange = (fullName: string) => {
    const { name, father_name, grandfather_name } = parseFullName(fullName)
    setFormData((prev) => ({ ...prev, name, father_name, grandfather_name }))
    if (errors.name || errors.father_name || errors.grandfather_name) {
      setErrors((prev) => ({ ...prev, name: "", father_name: "", grandfather_name: "" }))
    }
    setDuplicateError(null)
  }

  const handleGenderChange = (value: string) => {
    setFormData((prev) => ({ ...prev, gender: value }))
    if (errors["gender"]) {
      setErrors((prev) => ({ ...prev, gender: "" }))
    }
  }

  const handleGradeChange = async (value: string) => {
    setFormData((prev) => ({
      ...prev,
      grade_id: value,
      section: "",
      stream: "",
    }))
    if (errors["grade_id"]) {
      setErrors((prev) => ({ ...prev, grade_id: "" }))
    }
    setDuplicateError(null)
  }

  const handleSectionChange = async (value: string) => {
    setFormData((prev) => ({ ...prev, section: value }))
    if (errors["section"]) {
      setErrors((prev) => ({ ...prev, section: "" }))
    }
    setDuplicateError(null)
  }

  const handleStreamChange = (value: string) => {
    setFormData((prev) => ({ ...prev, stream: value }))
    if (errors["stream"]) {
      setErrors((prev) => ({ ...prev, stream: "" }))
    }
  }

  const validateName = (name: string, field: string) => {
    const trimmed = name.trim()
    if (!trimmed) {
      return `${field} is required`
    }
    if (trimmed.length < 2) {
      return `${field} must be at least 2 characters`
    }
    if (!/^[a-zA-Z\s]+$/.test(trimmed)) {
      return `${field} must contain only letters`
    }
    return ""
  }

  const validateEmail = (email: string) => {
    if (!email) return ""
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return "Invalid email format"
    }
    return ""
  }

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {}
    setDuplicateError(null)

    const fullName = [formData.name, formData.father_name, formData.grandfather_name].filter(Boolean).join(" ")
    const fullNameError = validateFullName(fullName)
    if (fullNameError) {
      newErrors.name = fullNameError
    }

    if (!formData.gender) {
      newErrors.gender = "Gender is required"
    }

    if (!formData.grade_id) {
      newErrors.grade_id = "Grade is required"
    }

    if (!formData.section) {
      newErrors.section = "Section is required"
    }

    const selectedGrade = grades.find((g) => g.id.toString() === formData.grade_id)
    const isGrade11or12 =
      selectedGrade && (selectedGrade.grade_name.includes("11") || selectedGrade.grade_name.includes("12"))
    if (isGrade11or12 && !formData.stream) {
      newErrors.stream = "Stream is required for Grade 11 and 12"
    }

    const emailError = validateEmail(formData.email)
    if (emailError) {
      newErrors.email = emailError
    }

    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      return false
    }

    const duplicateCheck = await checkDuplicateStudent(
      formData.name,
      formData.father_name,
      formData.grandfather_name,
      formData.grade_id,
      formData.section,
    )

    if (duplicateCheck.exists) {
      setDuplicateError(duplicateCheck)
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    setDuplicateError(null)

    const isValid = await validateForm()

    if (!isValid) {
      toast.error("Please fix the errors below")
      return
    }

    setLoading(true)

    try {
      let finalStudentId = studentId
      const isDuplicateId = await checkDuplicateStudentId(studentId)
      if (isDuplicateId) {
        finalStudentId = await generateUniqueStudentId()
        toast.info("Generated new unique Student ID")
      }

      const { error } = await supabase.from("students").insert({
        name: formData.name.trim(),
        father_name: formData.father_name.trim(),
        grandfather_name: formData.grandfather_name.trim(),
        gender: formData.gender.toLowerCase(),
        date_of_birth: formData.date_of_birth || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        parent_name: formData.parent_name.trim() || null,
        parent_phone: formData.parent_phone.trim() || null,
        student_id: finalStudentId,
        grade_id: Number.parseInt(formData.grade_id),
        section: formData.section,
        stream: formData.stream || null,
        email: formData.email.trim() || null,
      })

      if (error) {
        console.error("Error inserting student:", error)
        if (error.code === "23505") {
          if (error.message.includes("unique_student_name_grade_section")) {
            const grade = grades.find((g) => g.id === Number.parseInt(formData.grade_id))
            const gradeName = grade ? grade.grade_name : `Grade ${formData.grade_id}`

            toast.error(
              `Student already exists with same name combination in ${gradeName}, Section ${formData.section}`,
            )
            setDuplicateError({
              exists: true,
              message: `This student already exists in ${gradeName}, Section ${formData.section} with the same name, father name, and grandfather name.`,
            })
          } else if (error.message.includes("students_student_id_key")) {
            toast.error("Student ID already exists. Generating new one...")
            const newId = await generateUniqueStudentId()
            setStudentId(newId)
            toast.error("Please try again with the new Student ID")
          } else {
            toast.error("Failed to register student: " + error.message)
          }
        } else {
          toast.error("Failed to register student: " + error.message)
        }
      } else {
        toast.success("Student registered successfully!")
        setFormData({
          name: "",
          father_name: "",
          grandfather_name: "",
          gender: "",
          date_of_birth: "",
          phone: "",
          address: "",
          parent_name: "",
          parent_phone: "",
          grade_id: "",
          section: "",
          stream: "",
          email: "",
        })
        const newId = await generateUniqueStudentId()
        setStudentId(newId)
        setSuccessMessage("Student registered successfully!")
        setErrors({})
        setDuplicateError(null)
        setSubmitAttempted(false)
      }
    } catch (error) {
      console.error("Error in handleSubmit:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  // Bulk Import Handlers
  const handleBulkFullNameChange = (studentId: string, fullName: string) => {
    const { name, father_name, grandfather_name } = parseFullName(fullName)
    setBulkStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, name, father_name, grandfather_name } : s)))
    if (bulkErrors[studentId]?.name || bulkErrors[studentId]?.father_name || bulkErrors[studentId]?.grandfather_name) {
      setBulkErrors((prev) => ({
        ...prev,
        [studentId]: { ...prev[studentId], name: "", father_name: "", grandfather_name: "" },
      }))
    }
    if (bulkDuplicateErrors[studentId]) {
      setBulkDuplicateErrors((prev) => {
        const next = { ...prev }
        delete next[studentId]
        return next
      })
    }
  }

  const handleBulkInputChange = (studentId: string, field: keyof BulkStudent, value: string) => {
    setBulkStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, [field]: value } : s)))
    if (bulkErrors[studentId]?.[field]) {
      setBulkErrors((prev) => ({
        ...prev,
        [studentId]: { ...prev[studentId], [field]: "" },
      }))
    }
    if (bulkDuplicateErrors[studentId]) {
      setBulkDuplicateErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[studentId]
        return newErrors
      })
    }
  }

  const addBulkRow = () => {
    const newStudent = createEmptyBulkStudent()
    newStudent.student_id = generateStudentIdWithConfig(idConfig)
    setBulkStudents((prev) => [...prev, newStudent])
  }

  const addMultipleBulkRows = (count: number) => {
    const newStudents = Array.from({ length: count }, () => {
      const student = createEmptyBulkStudent()
      student.student_id = generateStudentIdWithConfig(idConfig)
      return student
    })
    setBulkStudents((prev) => [...prev, ...newStudents])
    toast.success(`Added ${count} rows`)
  }

  const removeBulkRow = (studentId: string) => {
    if (bulkStudents.length <= 1) {
      toast.error("At least one row is required")
      return
    }
    setBulkStudents((prev) => prev.filter((s) => s.id !== studentId))
    setBulkErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[studentId]
      return newErrors
    })
    setBulkDuplicateErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[studentId]
      return newErrors
    })
  }

  const regenerateBulkIds = async () => {
    const newStudents = await Promise.all(
      bulkStudents.map(async (s) => {
        let newId = generateStudentIdWithConfig(idConfig)
        let attempts = 0
        const maxAttempts = 5

        while (attempts < maxAttempts) {
          const isDuplicate = await checkDuplicateStudentId(newId)
          if (!isDuplicate) {
            break
          }
          newId = generateStudentIdWithConfig(idConfig)
          attempts++
        }

        return {
          ...s,
          student_id: newId,
        }
      }),
    )

    setBulkStudents(newStudents)
    toast.success("Student IDs regenerated")
  }

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportProgress(0)

    try {
      const ext = file.name.split(".").pop()?.toLowerCase()
      const rows: string[][] = []

      if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const sheetRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 }) as any[][]
        sheetRows
          .filter((r) => r && r.some((cell) => String(cell ?? "").trim().length > 0))
          .forEach((r) => rows.push(r.map((cell) => String(cell ?? "").trim())))
      } else {
        const text = await file.text()
        const lines = text.split(/\r?\n/).filter((line) => line.trim())
        lines.forEach((line) => {
          const cols = line.split(",").map((c) => c.trim())
          rows.push(cols)
        })
      }

      if (rows.length < 2) {
        toast.error("File must have at least a header row and one data row")
        return
      }

      // Parse header – accept full_name or separate name/father/grandfather
      const header = rows[0].map((h) => h.trim().toLowerCase())
      const fullNameIndex = header.findIndex((h) => h === "full_name" || h === "fullname")
      const nameIndex = fullNameIndex === -1 ? header.findIndex((h) => h.includes("name") && !h.includes("father") && !h.includes("grand")) : -1
      const fatherIndex = header.findIndex((h) => h.includes("father"))
      const grandfatherIndex = header.findIndex((h) => h.includes("grand"))
      const genderIndex = header.findIndex((h) => h.includes("gender") || h.includes("sex"))
      const emailIndex = header.findIndex((h) => h.includes("email"))
      const phoneIndex = header.findIndex((h) => h.includes("phone") && !h.includes("parent"))
      const parentNameIndex = header.findIndex((h) => h.includes("parent_name") || h.includes("guardian_name") || h.includes("parent"))
      const dobIndex = header.findIndex((h) => h.includes("date_of_birth") || h.includes("dob") || h.includes("birth"))
      const addressIndex = header.findIndex((h) => h.includes("address"))

      if (fullNameIndex === -1 && nameIndex === -1) {
        toast.error("CSV must have 'full_name' or 'name' column")
        return
      }

      const importedStudents: BulkStudent[] = []

      for (let i = 1; i < rows.length; i++) {
        setImportProgress(Math.round((i / (rows.length - 1)) * 100))

        const cols = rows[i]

        const nameVal = fullNameIndex >= 0 ? cols[fullNameIndex] || "" : cols[nameIndex] || ""
        if (!nameVal && fullNameIndex >= 0) continue
        if (!nameVal && nameIndex >= 0) continue

        const student = createEmptyBulkStudent()
        student.student_id = generateStudentIdWithConfig(idConfig)
        if (fullNameIndex >= 0) {
          const parsed = parseFullName(nameVal)
          student.name = parsed.name
          student.father_name = parsed.father_name
          student.grandfather_name = parsed.grandfather_name
        } else {
          student.name = nameVal
          student.father_name = fatherIndex >= 0 ? cols[fatherIndex] || "" : ""
          student.grandfather_name = grandfatherIndex >= 0 ? cols[grandfatherIndex] || "" : ""
        }
        student.gender = genderIndex >= 0 ? (cols[genderIndex]?.trim() ? cols[genderIndex].toLowerCase() : "") : ""
        student.email = emailIndex >= 0 ? cols[emailIndex] || "" : ""
        student.phone = phoneIndex >= 0 ? cols[phoneIndex] || "" : ""
        student.parent_name = parentNameIndex >= 0 ? cols[parentNameIndex] || "" : ""
        // parent_phone removed from UI - do not import
        student.date_of_birth = dobIndex >= 0 ? cols[dobIndex] || "" : ""
        student.address = addressIndex >= 0 ? cols[addressIndex] || "" : ""

        importedStudents.push(student)
      }

      if (importedStudents.length === 0) {
        toast.error("No valid students found in file")
        return
      }

      setBulkStudents(importedStudents)
      toast.success(`Imported ${importedStudents.length} students from file`)
    } catch (error) {
      console.error("Error importing file:", error)
      toast.error("Failed to import file. Make sure it's a valid CSV.")
    } finally {
      setIsImporting(false)
      setImportProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const downloadTemplate = () => {
    const template =
      "full_name,gender,email,phone,parent_name,date_of_birth,address\n" +
      "John Michael David,male,john@example.com,0912345678,Michael Sr,2005-01-15,City\n" +
      "Jane Robert James,female,jane@example.com,0912345679,Mary,2006-02-20,City"
    const blob = new Blob([template], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "student_import_template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePaste = (e: React.ClipboardEvent, rowIndex: number, field: keyof BulkStudent) => {
    const pastedData = e.clipboardData.getData("text")
    const rows = pastedData.split("\n").filter((row) => row.trim())

    if (rows.length > 1) {
      e.preventDefault()

      const parsedRows = rows.map((row) => {
        const cols = row.includes("\t") ? row.split("\t") : row.split(",")
        return cols.map((c) => c.trim())
      })

      const pasteFields: Array<keyof BulkStudent | "full_name"> = [
        "full_name",
        "gender",
        "email",
        "phone",
        "parent_name",
        "date_of_birth",
        "address",
      ]

      setBulkStudents((prev) => {
        const newStudents = [...prev]
        parsedRows.forEach((cols, i) => {
          const targetIndex = rowIndex + i
          if (targetIndex < newStudents.length) {
            cols.forEach((value, colIndex) => {
              const field = pasteFields[colIndex]
              if (!field) return
              if (field === "full_name") {
                const parsed = parseFullName(value)
                newStudents[targetIndex] = { ...newStudents[targetIndex], ...parsed }
              } else {
                newStudents[targetIndex] = { ...newStudents[targetIndex], [field]: value }
              }
            })
          } else {
            const newStudent = createEmptyBulkStudent()
            newStudent.student_id = generateStudentIdWithConfig(idConfig)
            cols.forEach((value, colIndex) => {
              const field = pasteFields[colIndex]
              if (!field) return
              if (field === "full_name") {
                Object.assign(newStudent, parseFullName(value))
              } else {
                ;(newStudent as unknown as Record<string, string>)[field] = value
              }
            })
            newStudents.push(newStudent)
          }
        })
        return newStudents
      })

      toast.success(`Pasted ${parsedRows.length} rows`)
    }
  }

  const checkBulkDuplicates = async (): Promise<boolean> => {
    const errors: Record<string, string> = {}
    let hasDuplicates = false

    const nameCombos = new Map<string, number[]>()

    bulkStudents.forEach((student, index) => {
      const nameKey = `${student.name.trim().toLowerCase()}|${student.father_name.trim().toLowerCase()}|${student.grandfather_name.trim().toLowerCase()}`
      if (!nameCombos.has(nameKey)) {
        nameCombos.set(nameKey, [])
      }
      nameCombos.get(nameKey)!.push(index)
    })

    for (const [nameKey, indices] of nameCombos) {
      if (indices.length > 1 && nameKey !== "||") {
        indices.forEach((index) => {
          errors[bulkStudents[index].id] =
            `Duplicate name combination found within this list (Row ${indices.map((i) => i + 1).join(", ")})`
        })
        hasDuplicates = true
      }
    }

    if (bulkGradeId && bulkSection) {
      const grade = grades.find((g) => g.id === Number.parseInt(bulkGradeId))
      const gradeName = grade ? grade.grade_name : `Grade ${bulkGradeId}`

      for (const student of bulkStudents) {
        if (student.name.trim() && student.father_name.trim() && student.grandfather_name.trim()) {
          const duplicateCheck = await checkDuplicateStudent(
            student.name,
            student.father_name,
            student.grandfather_name,
            bulkGradeId,
            bulkSection,
          )

          if (duplicateCheck.exists) {
            errors[student.id] = `Student already exists in ${gradeName}, Section ${bulkSection}`
            hasDuplicates = true
          }
        }
      }
    }

    setBulkDuplicateErrors(errors)
    return hasDuplicates
  }

  const validateBulkStudents = async (): Promise<boolean> => {
    const newErrors: Record<string, Record<string, string>> = {}
    let hasErrors = false

    if (!bulkGradeId) {
      toast.error("Please select a grade for bulk import")
      return false
    }

    if (!bulkSection) {
      toast.error("Please select a section for bulk import")
      return false
    }

    const selectedGrade = grades.find((g) => g.id.toString() === bulkGradeId)
    const isGrade11or12 =
      selectedGrade && (selectedGrade.grade_name.includes("11") || selectedGrade.grade_name.includes("12"))
    if (isGrade11or12 && !bulkStream) {
      toast.error("Please select a stream for Grade 11/12")
      return false
    }

    bulkStudents.forEach((student) => {
      const studentErrors: Record<string, string> = {}
      const fullName = getFullName(student)
      const fullNameError = validateFullName(fullName)
      if (fullNameError) studentErrors.name = fullNameError

      if (!student.gender?.trim()) studentErrors.gender = "Required"

      const emailError = validateEmail(student.email)
      if (emailError) studentErrors.email = emailError

      if (Object.keys(studentErrors).length > 0) {
        newErrors[student.id] = studentErrors
        hasErrors = true
      }
    })

    setBulkErrors(newErrors)

    if (hasErrors) {
      return false
    }

    const hasDuplicates = await checkBulkDuplicates()
    if (hasDuplicates) {
      toast.error("Duplicate students found. Please check the list.")
      return false
    }

    return true
  }

  const handleBulkSubmit = async () => {
    const isValid = await validateBulkStudents()
    if (!isValid) {
      return
    }

    setBulkLoading(true)

    try {
      const studentsWithUniqueIds = await Promise.all(
        bulkStudents.map(async (s) => {
          let finalStudentId = s.student_id
          const isDuplicateId = await checkDuplicateStudentId(s.student_id)
          if (isDuplicateId) {
            finalStudentId = await generateUniqueStudentId()
          }

          return {
            name: s.name.trim(),
            father_name: s.father_name.trim(),
            grandfather_name: s.grandfather_name.trim(),
            gender: s.gender.toLowerCase(),
            date_of_birth: s.date_of_birth || null,
            phone: s.phone.trim() || null,
            address: s.address.trim() || null,
            parent_name: s.parent_name.trim() || null,
            parent_phone: null,
            student_id: finalStudentId,
            grade_id: Number.parseInt(bulkGradeId),
            section: bulkSection,
            stream: bulkStream || null,
            email: s.email.trim() || null,
          }
        }),
      )

      const { error } = await supabase.from("students").insert(studentsWithUniqueIds)

      if (error) {
        console.error("Error inserting students:", error)
        if (error.code === "23505") {
          const grade = grades.find((g) => g.id === Number.parseInt(bulkGradeId))
          const gradeName = grade ? grade.grade_name : `Grade ${bulkGradeId}`

          if (error.message.includes("unique_student_name_grade_section")) {
            toast.error(
              `Some students already exist in ${gradeName}, Section ${bulkSection} with same name combination`,
            )
          } else if (error.message.includes("students_student_id_key")) {
            toast.error("Some student IDs already exist. Please regenerate IDs and try again.")
          } else {
            toast.error("Failed to register students: " + error.message)
          }
        } else {
          toast.error("Failed to register students: " + error.message)
        }
      } else {
        toast.success(`Successfully registered ${bulkStudents.length} students!`)
        const newStudent = createEmptyBulkStudent()
        newStudent.student_id = generateStudentIdWithConfig(idConfig)
        setBulkStudents([newStudent])
        setBulkGradeId("")
        setBulkSection("")
        setBulkStream("")
        setBulkErrors({})
        setBulkDuplicateErrors({})
      }
    } catch (error) {
      console.error("Error in bulk submit:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setBulkLoading(false)
    }
  }

  const isFieldError = (field: string) => errors[field] && submitAttempted

  const selectedGrade = grades.find((g) => g.id.toString() === formData.grade_id)
  const isGrade11or12 =
    selectedGrade && (selectedGrade.grade_name.includes("11") || selectedGrade.grade_name.includes("12"))

  const bulkSelectedGrade = grades.find((g) => g.id.toString() === bulkGradeId)
  const isBulkGrade11or12 =
    bulkSelectedGrade && (bulkSelectedGrade.grade_name.includes("11") || bulkSelectedGrade.grade_name.includes("12"))

  if (gradesLoading) {
    return <PageSpinner />
  }

  return (
    <div className="flex-1 space-y-3 p-3 sm:p-4 md:p-5 lg:p-6 bg-transparent min-h-screen max-w-full overflow-x-hidden">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div className="space-y-0.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Register Students</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Add students individually or import multiple at once
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowIdSettings(true)} className="gap-1.5 h-8 text-xs">
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ID Format</span>
          </Button>
        </div>
      </div>

      {/* Duplicate Warning Banner */}
      {duplicateError && duplicateError.exists && (
        <div className="p-2 sm:p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-amber-800 dark:text-amber-200 font-medium text-sm">Duplicate Student Found</p>
              <p className="text-amber-700 dark:text-amber-300 text-xs">{duplicateError.message}</p>
              <p className="text-amber-600 dark:text-amber-400 text-xs mt-0.5">Cannot register duplicate student in same grade and section.</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        
        <Tabs defaultValue="single" className="flex-1 min-w-0 space-y-3">
        <div className="flex space-between items-center gap-2">
        <TabsList className="grid w-full max-w-sm sm:max-w-md grid-cols-2 h-9">
          <TabsTrigger value="single" className="gap-1.5 text-xs sm:text-sm">
            <UserPlus className="h-3.5 w-3.5" />
            Single Student
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-1.5 text-xs sm:text-sm">
            <Users className="h-3.5 w-3.5" />
            Bulk Import
          </TabsTrigger>
        </TabsList>

        {/* Compact ID format in front of tabs */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <span>ID:</span>
          <code className="px-1.5 py-0.5 bg-muted rounded font-mono text-[11px]">{idConfig.prefix}{idConfig.separator === "none" ? "" : idConfig.separator}{"0".repeat(idConfig.digits)}</code>
          <code className="text-primary font-mono text-[11px]">{studentId}</code>
        </div>
        </div>

        {/* Single Student Tab - Compact table-like layout */}
        <TabsContent value="single">
          <Card className="overflow-hidden">
            <CardHeader className="py-3 px-4 sm:px-5">
              <CardTitle className="text-base sm:text-lg">Register Single Student</CardTitle>
              <CardDescription className="text-xs">Fill in all required fields to register a new student</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pb-4 pt-0">
              {successMessage && (
                <div className="mb-3 p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded text-green-800 dark:text-green-200 text-xs">
                  {successMessage}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-6">
  {/* Header Section: Student ID */}
  <div className="flex items-center gap-3 bg-muted/30 p-4 rounded-lg border">
    <div className="space-y-1">
      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Student ID</Label>
      <div className="flex gap-2">
        <Input 
          value={studentId} 
          readOnly 
          className="h-9 text-xs bg-background cursor-not-allowed font-mono w-[180px] border-dashed" 
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={async () => {
            const newId = await generateUniqueStudentId()
            setStudentId(newId)
            toast.success("New unique ID generated")
          }}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>

  {/* Row 1: Primary Personal Info */}
  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
    {/* Full Name - Larger Span */}
    <div className="md:col-span-5 space-y-1.5">
      <Label htmlFor="fullName" className="text-xs font-medium">Full Name *</Label>
      <Input 
        id="fullName"
        value={[formData.name, formData.father_name, formData.grandfather_name].filter(Boolean).join(" ")}
        onChange={(e) => handleSingleFullNameChange(e.target.value)}
        className={`h-9 text-xs w-full ${isFieldError("name") ? "border-destructive ring-1 ring-destructive" : ""}`}
        placeholder="First Father Grandfather" 
      />
      {errors.name && <p className="text-destructive text-[10px] mt-1">{errors.name}</p>}
    </div>

    {/* Gender */}
    <div className="md:col-span-2 space-y-1.5">
      <Label className="text-xs font-medium">Gender *</Label>
      <Select value={formData.gender} onValueChange={handleGenderChange}>
        <SelectTrigger className="h-9 text-xs w-full">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="male">Male</SelectItem>
          <SelectItem value="female">Female</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {/* Date of Birth with Year/Month Picker */}
    <div className="md:col-span-3 space-y-1.5">
      <Label className="text-xs font-medium">Date of Birth</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("h-9 text-xs w-full justify-start font-normal", !formData.date_of_birth && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formData.date_of_birth ? format(new Date(formData.date_of_birth), "MMM d, yyyy") : "Select Date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar 
            mode="single" 
            selected={formData.date_of_birth ? new Date(formData.date_of_birth) : undefined}
            onSelect={(date) => setFormData((prev) => ({ ...prev, date_of_birth: date ? format(date, "yyyy-MM-dd") : "" }))}
            captionLayout="dropdown"
            startMonth={new Date(1990, 0)}
            endMonth={new Date()}
            hideNavigation
            disabled={(date) => date > new Date()}
            className="rounded-md border"
          />
        </PopoverContent>
      </Popover>
    </div>

    {/* Phone */}
    <div className="md:col-span-2 space-y-1.5">
      <Label htmlFor="phone" className="text-xs font-medium">Phone</Label>
      <Input id="phone" name="phone" value={formData.phone} onChange={handleInputChange} className="h-9 text-xs w-full" placeholder="09..." />
    </div>
  </div>

  {/* Row 2: Academic & Contact Info */}
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Grade *</Label>
      <Select value={formData.grade_id} onValueChange={handleGradeChange}>
        <SelectTrigger className="h-9 text-xs w-full">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {grades.map((grade) => <SelectItem key={grade.id} value={grade.id.toString()}>{grade.grade_name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>

    {isGrade11or12 && (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Stream *</Label>
        <Select value={formData.stream} onValueChange={handleStreamChange}>
          <SelectTrigger className="h-9 text-xs w-full">
            <SelectValue placeholder="Stream" />
          </SelectTrigger>
          <SelectContent>
            {streamOptions.map((stream) => <SelectItem key={stream} value={stream}>{stream}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    )}

    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Section *</Label>
      <Select value={formData.section} onValueChange={handleSectionChange} disabled={!formData.grade_id}>
        <SelectTrigger className="h-9 text-xs w-full">
          <SelectValue placeholder="Section" />
        </SelectTrigger>
        <SelectContent>
          {getSectionsForGrade(formData.grade_id, isGrade11or12 ? formData.stream : undefined).map((s) => (
            <SelectItem key={s.id} value={s.section_name}>Section {s.section_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div className="space-y-1.5">
      <Label htmlFor="parent_name" className="text-xs font-medium">Parent Name</Label>
      <Input id="parent_name" name="parent_name" value={formData.parent_name} onChange={handleInputChange} className="h-9 text-xs w-full" placeholder="Parent Name" />
    </div>

    <div className="space-y-1.5">
      <Label htmlFor="parent_phone" className="text-xs font-medium">Parent Phone</Label>
      <Input id="parent_phone" name="parent_phone" value={formData.parent_phone} onChange={handleInputChange} className="h-9 text-xs w-full" placeholder="09..." />
    </div>

    <div className="space-y-1.5">
      <Label htmlFor="address" className="text-xs font-medium">Home Address</Label>
      <Input id="address" name="address" value={formData.address} onChange={handleInputChange} className="h-9 text-xs w-full" placeholder="City, Kebele" />
    </div>
  </div>

  {/* Action Button */}
  <div className="flex justify-end pt-6 border-t">
    <Button 
      type="submit" 
      disabled={loading || !formData.grade_id}
      className="gap-2 h-10 px-12 text-sm font-semibold shadow-md transition-all hover:translate-y-[-1px]"
    >
      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
      Register Student
    </Button>
  </div>
</form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Import Tab - Compact table layout */}
        <TabsContent value="bulk">
          <Card className="overflow-hidden">
            <CardHeader className="py-3 px-4 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg">Bulk Import Students</CardTitle>
                  <CardDescription className="text-xs">Add multiple students or import from CSV</CardDescription>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 h-8 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    Template
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="gap-1.5 h-8 text-xs">
                    <Upload className="h-3.5 w-3.5" />
                    Import CSV
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleFileImport} className="hidden" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pb-4 space-y-3">
              {isImporting && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span>Importing...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="h-1.5" />
                </div>
              )}

              {/* Grade, Section, Stream - compact row */}
              <div className="flex flex-wrap gap-2 sm:gap-3 p-2.5 sm:p-3 bg-muted/50 dark:bg-muted/20 rounded-md">
                <div className="min-w-[100px] flex-1 sm:flex-initial">
                  <Label className="text-xs">Grade *</Label>
                  <Select value={bulkGradeId} onValueChange={(v) => { setBulkGradeId(v); setBulkSection(""); setBulkStream("") }}>
                    <SelectTrigger className="h-8 text-xs mt-0.5">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {grades.map((g) => <SelectItem key={g.id} value={g.id.toString()}>{g.grade_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[100px] flex-1 sm:flex-initial">
                  <Label className="text-xs">Section *</Label>
                  <Select value={bulkSection} onValueChange={setBulkSection} disabled={!bulkGradeId || (isBulkGrade11or12 && !bulkStream)}>
                    <SelectTrigger className="h-8 text-xs mt-0.5">
                      <SelectValue placeholder={getSectionsForGrade(bulkGradeId, isBulkGrade11or12 ? bulkStream || undefined : undefined).length > 0 ? "Select" : isBulkGrade11or12 && !bulkStream ? "Stream first" : "No sections"} />
                    </SelectTrigger>
                    <SelectContent>
                      {getSectionsForGrade(bulkGradeId, isBulkGrade11or12 ? bulkStream || undefined : undefined).length > 0 ? (
                        getSectionsForGrade(bulkGradeId, isBulkGrade11or12 ? bulkStream || undefined : undefined).map((s) => (
                          <SelectItem key={s.id} value={s.section_name}>Section {s.section_name}</SelectItem>
                        ))
                      ) : (
                        <div className="text-center py-2 text-xs text-muted-foreground">No sections</div>
                      )}
                    </SelectContent>
                  </Select>
                  {bulkGradeId && getSectionsForGrade(bulkGradeId, isBulkGrade11or12 ? bulkStream || undefined : undefined).length === 0 && (
                    <p className="text-[10px] text-amber-600 mt-0.5">{isBulkGrade11or12 && !bulkStream ? "Select stream first." : "Assign sections in Grade Management."}</p>
                  )}
                </div>
                {isBulkGrade11or12 && (
                  <div className="min-w-[100px] flex-1 sm:flex-initial">
                    <Label className="text-xs">Stream *</Label>
                    <Select value={bulkStream} onValueChange={setBulkStream}>
                      <SelectTrigger className="h-8 text-xs mt-0.5">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {streamOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Bulk Actions - compact */}
              <div className="flex flex-wrap gap-1.5">
                <Button variant="outline" size="sm" onClick={addBulkRow} className="gap-1 h-7 text-xs">
                  <Plus className="h-3 w-3" /> Add
                </Button>
                <Button variant="outline" size="sm" onClick={() => addMultipleBulkRows(5)} className="h-7 text-xs">+5</Button>
                <Button variant="outline" size="sm" onClick={() => addMultipleBulkRows(10)} className="h-7 text-xs">+10</Button>
                <Button variant="outline" size="sm" onClick={regenerateBulkIds} className="gap-1 h-7 text-xs">
                  <RefreshCw className="h-3 w-3" /> Regenerate IDs
                </Button>
              </div>

              {/* Student table - normal table with header and input cells */}
              {/* Wrapper to control the dynamic height and scroll trigger after ~10 rows */}
<div className="border rounded-md overflow-hidden bg-background">
  <div className="overflow-auto max-h-[440px] w-full"> 
    <table className="w-full border-collapse text-xs min-w-[800px] table-fixed">
      {/* Fixed Header with distinct background */}
      <thead className="sticky top-0 z-30 bg-muted/95 backdrop-blur-sm border-b">
        <tr>
          <th className="text-left p-2.5 font-semibold w-[110px] text-muted-foreground">Student ID</th>
          <th className="text-left p-2.5 font-semibold min-w-[200px] text-muted-foreground">Full Name *</th>
          <th className="text-left p-2.5 font-semibold w-[90px] text-muted-foreground">Gender *</th>
          <th className="text-left p-2.5 font-semibold min-w-[150px] text-muted-foreground">Email</th>
          <th className="text-left p-2.5 font-semibold w-[120px] text-muted-foreground">Phone</th>
          <th className="text-left p-2.5 font-semibold min-w-[130px] text-muted-foreground">Parent</th>
          <th className="text-left p-2.5 font-semibold w-[100px] text-muted-foreground">DOB</th>
          <th className="text-left p-2.5 font-semibold min-w-[130px] text-muted-foreground">Address</th>
          <th className="w-12 p-2.5"></th>
        </tr>
      </thead>

      {/* Table Body with white/transparent background and horizontal lines */}
      <tbody className="bg-background">
        {bulkStudents.map((student, index) => (
          <tr
            key={student.id}
            className={cn(
              "border-b last:border-b-0 hover:bg-muted/20 transition-colors group",
              bulkDuplicateErrors[student.id] && "bg-amber-50/50 dark:bg-amber-950/20"
            )}
          >
            <td className="p-0 border-r last:border-r-0">
              <Input 
                value={student.student_id} 
                disabled 
                className="h-10 w-full border-0 bg-muted/30 text-xs font-mono shadow-none rounded-none cursor-not-allowed" 
              />
            </td>
            <td className="p-0 border-r last:border-r-0">
              <Input
                value={getFullName(student)}
                onChange={(e) => handleBulkFullNameChange(student.id, e.target.value)}
                onPaste={(e) => handlePaste(e, index, "name")}
                className={`h-10 w-full border-0 bg-transparent text-xs shadow-none focus-visible:ring-1 rounded-none ${bulkErrors[student.id]?.name || bulkDuplicateErrors[student.id] ? "ring-1 ring-destructive" : ""}`}
                placeholder="Name Father Grandfather"
              />
            </td>
            <td className="p-0 border-r last:border-r-0">
              <Select value={student.gender || "__empty__"} onValueChange={(v) => handleBulkInputChange(student.id, "gender", v === "__empty__" ? "" : v)}>
                <SelectTrigger className="h-10 w-full border-0 bg-transparent text-xs shadow-none focus:ring-1 rounded-none">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty__">—</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </td>
            <td className="p-0 border-r last:border-r-0">
              <Input 
                value={student.email} 
                onChange={(e) => handleBulkInputChange(student.id, "email", e.target.value)}
                className="h-10 w-full border-0 bg-transparent text-xs shadow-none focus-visible:ring-1 rounded-none" 
                placeholder="Email" 
              />
            </td>
            <td className="p-0 border-r last:border-r-0">
              <Input 
                value={student.phone} 
                onChange={(e) => handleBulkInputChange(student.id, "phone", e.target.value)}
                className="h-10 w-full border-0 bg-transparent text-xs shadow-none focus-visible:ring-1 rounded-none" 
                placeholder="+251..." 
              />
            </td>
            <td className="p-0 border-r last:border-r-0">
              <Input 
                value={student.parent_name} 
                onChange={(e) => handleBulkInputChange(student.id, "parent_name", e.target.value)}
                className="h-10 w-full border-0 bg-transparent text-xs shadow-none focus-visible:ring-1 rounded-none" 
                placeholder="Parent Name" 
              />
            </td>
            <td className="p-0 border-r last:border-r-0 px-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-9 w-full justify-start text-xs font-normal">
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {student.date_of_birth ? format(new Date(student.date_of_birth), "MM/dd/yy") : "Select"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar 
                    mode="single" 
                    selected={student.date_of_birth ? new Date(student.date_of_birth) : undefined}
                    onSelect={(date) => handleBulkInputChange(student.id, "date_of_birth", date ? format(date, "yyyy-MM-dd") : "")}
                    captionLayout="dropdown"
                    startMonth={new Date(1990, 0)}
                    endMonth={new Date()}
                    hideNavigation
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </td>
            <td className="p-0 border-r last:border-r-0">
              <Input 
                value={student.address} 
                onChange={(e) => handleBulkInputChange(student.id, "address", e.target.value)}
                className="h-10 w-full border-0 bg-transparent text-xs shadow-none focus-visible:ring-1 rounded-none" 
                placeholder="Address" 
              />
            </td>
            <td className="p-1 text-center sticky right-0 z-20 bg-background border-l group-hover:bg-muted/50 transition-colors">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => removeBulkRow(student.id)} 
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <p className="text-xs text-muted-foreground">{bulkStudents.length} student(s) ready</p>
                <Button onClick={handleBulkSubmit} disabled={bulkLoading || !bulkGradeId || (isBulkGrade11or12 && !bulkStream) || getSectionsForGrade(bulkGradeId, isBulkGrade11or12 ? bulkStream || undefined : undefined).length === 0}
                  className="gap-1.5 h-8 text-xs">
                  {bulkLoading ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Registering...</> : <><Users className="h-3.5 w-3.5" />Register All</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>

      {/* ID Settings Dialog */}
      <Dialog open={showIdSettings} onOpenChange={setShowIdSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Student ID Format Settings</DialogTitle>
            <DialogDescription>Configure how student IDs are generated</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="prefix">Prefix</Label>
              <Input
                id="prefix"
                value={tempIdConfig.prefix}
                onChange={(e) => setTempIdConfig((prev) => ({ ...prev, prefix: e.target.value }))}
                placeholder="S"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="separator">Separator</Label>
              <Select
                value={tempIdConfig.separator}
                onValueChange={(v) => setTempIdConfig((prev) => ({ ...prev, separator: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select separator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="-">Dash (-)</SelectItem>
                  <SelectItem value="_">Underscore (_)</SelectItem>
                  <SelectItem value="/">Slash (/)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="digits">Number of Digits</Label>
              <Select
                value={tempIdConfig.digits.toString()}
                onValueChange={(v) => setTempIdConfig((prev) => ({ ...prev, digits: Number.parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select number of digits" />
                </SelectTrigger>
                <SelectContent>
                  {[4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} digits
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Preview:</p>
              <code className="text-lg font-mono">
                {tempIdConfig.prefix}
                {tempIdConfig.separator === "none" ? "" : tempIdConfig.separator}
                {"0".repeat(tempIdConfig.digits)}
              </code>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIdSettings(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveIdConfig}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}