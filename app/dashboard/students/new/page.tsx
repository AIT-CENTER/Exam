"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
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
import {
  AlertCircle,
  ArrowLeft,
  UserPlus,
  Users,
  Settings,
  Plus,
  Trash2,
  Upload,
  RefreshCw,
  AlertTriangle,
  Download,
} from "lucide-react"
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
}

interface BulkStudent {
  id: string
  name: string
  father_name: string
  grandfather_name: string
  gender: string
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

export default function NewStudentPage() {
  const router = useRouter()

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
  const [gradesLoading, setGradesLoading] = useState(true)

  const streamOptions = ["Natural", "Social"]

  function createEmptyBulkStudent(): BulkStudent {
    return {
      id: crypto.randomUUID(),
      name: "",
      father_name: "",
      grandfather_name: "",
      gender: "male",
      grade_id: "",
      section: "",
      stream: "",
      email: "",
      student_id: "",
    }
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
        .from("sections")
        .select("id, section_name, grade_id")
        .eq("is_active", true)
        .order("section_name", { ascending: true })

      if (error) throw error
      setSections(data || [])
    } catch (error) {
      console.error("Error fetching sections:", error)
    }
  }

  const getSectionsForGrade = (gradeId: string) => {
    if (!gradeId) return []
    return sections.filter((s) => s.grade_id === Number.parseInt(gradeId))
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

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }

    if (name === "name" || name === "father_name" || name === "grandfather_name") {
      setDuplicateError(null)
    }
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

    const nameFields = [
      { value: formData.name, field: "Student Name", key: "name" },
      { value: formData.father_name, field: "Father's Name", key: "father_name" },
      { value: formData.grandfather_name, field: "Grandfather's Name", key: "grandfather_name" },
    ]

    nameFields.forEach(({ value, field, key }) => {
      const error = validateName(value, field)
      if (error) {
        newErrors[key] = error
      }
    })

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
      const text = await file.text()
      const lines = text.split("\n").filter((line) => line.trim())

      if (lines.length < 2) {
        toast.error("File must have at least a header row and one data row")
        return
      }

      // Parse header
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
      const nameIndex = header.findIndex((h) => h.includes("name") && !h.includes("father") && !h.includes("grand"))
      const fatherIndex = header.findIndex((h) => h.includes("father"))
      const grandfatherIndex = header.findIndex((h) => h.includes("grand"))
      const genderIndex = header.findIndex((h) => h.includes("gender") || h.includes("sex"))
      const emailIndex = header.findIndex((h) => h.includes("email"))

      if (nameIndex === -1) {
        toast.error("CSV must have a 'name' column")
        return
      }

      const importedStudents: BulkStudent[] = []

      for (let i = 1; i < lines.length; i++) {
        setImportProgress(Math.round((i / (lines.length - 1)) * 100))

        const cols = lines[i].split(",").map((c) => c.trim())

        if (!cols[nameIndex]) continue

        const student = createEmptyBulkStudent()
        student.student_id = generateStudentIdWithConfig(idConfig)
        student.name = cols[nameIndex] || ""
        student.father_name = fatherIndex >= 0 ? cols[fatherIndex] || "" : ""
        student.grandfather_name = grandfatherIndex >= 0 ? cols[grandfatherIndex] || "" : ""
        student.gender = genderIndex >= 0 ? cols[genderIndex]?.toLowerCase() || "male" : "male"
        student.email = emailIndex >= 0 ? cols[emailIndex] || "" : ""

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
      "name,father_name,grandfather_name,gender,email\nJohn,Michael,David,male,john@example.com\nJane,Robert,James,female,jane@example.com"
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

      const fieldOrder: (keyof BulkStudent)[] = ["name", "father_name", "grandfather_name", "gender", "email"]

      setBulkStudents((prev) => {
        const newStudents = [...prev]
        parsedRows.forEach((cols, i) => {
          const targetIndex = rowIndex + i
          if (targetIndex < newStudents.length) {
            cols.forEach((value, colIndex) => {
              if (colIndex < fieldOrder.length) {
                newStudents[targetIndex] = {
                  ...newStudents[targetIndex],
                  [fieldOrder[colIndex]]: value,
                }
              }
            })
          } else {
            const newStudent = createEmptyBulkStudent()
            newStudent.student_id = generateStudentIdWithConfig(idConfig)
            cols.forEach((value, colIndex) => {
              if (colIndex < fieldOrder.length) {
                ;(newStudent as any)[fieldOrder[colIndex]] = value
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

      const nameError = validateName(student.name, "Name")
      if (nameError) studentErrors.name = nameError

      const fatherError = validateName(student.father_name, "Father's Name")
      if (fatherError) studentErrors.father_name = fatherError

      const grandfatherError = validateName(student.grandfather_name, "Grandfather's Name")
      if (grandfatherError) studentErrors.grandfather_name = grandfatherError

      if (!student.gender) studentErrors.gender = "Required"

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

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 bg-muted/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Register Students</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Add students individually or import multiple at once
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowIdSettings(true)} className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">ID Format</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
        </div>
      </div>

      {/* ID Format Preview */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Current ID Format:</span>
              <code className="px-2 py-1 bg-background rounded text-sm font-mono">
                {idConfig.prefix}
                {idConfig.separator === "none" ? "" : idConfig.separator}
                {"0".repeat(idConfig.digits)}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Example:</span>
              <code className="px-2 py-1 bg-background rounded text-sm font-mono text-primary">{studentId}</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Duplicate Warning Banner */}
      {duplicateError && duplicateError.exists && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-amber-800 font-medium">Duplicate Student Found</p>
              <p className="text-amber-700 text-sm">{duplicateError.message}</p>
              <p className="text-amber-600 text-xs mt-1">
                Cannot register duplicate student in same grade and section.
              </p>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="single" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="single" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Single Student
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-2">
            <Users className="h-4 w-4" />
            Bulk Import
          </TabsTrigger>
        </TabsList>

        {/* Single Student Tab */}
        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Register Single Student</CardTitle>
              <CardDescription>Fill in all required fields to register a new student</CardDescription>
            </CardHeader>
            <CardContent>
              {successMessage && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-green-800 text-sm">{successMessage}</p>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Student ID */}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label>Student ID</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Input value={studentId} readOnly className="bg-muted cursor-not-allowed font-mono" />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={async () => {
                          const newId = await generateUniqueStudentId()
                          setStudentId(newId)
                          toast.success("Generated new unique Student ID")
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Format: Sxxxxxx (auto-generated)</p>
                  </div>

                  {/* Name Fields */}
                  <div>
                    <Label htmlFor="name">Student Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`mt-1.5 ${isFieldError("name") ? "border-destructive ring-1 ring-destructive" : ""}`}
                      placeholder="Enter name"
                    />
                    {errors.name && (
                      <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="father_name">Father's Name *</Label>
                    <Input
                      id="father_name"
                      name="father_name"
                      value={formData.father_name}
                      onChange={handleInputChange}
                      className={`mt-1.5 ${isFieldError("father_name") ? "border-destructive ring-1 ring-destructive" : ""}`}
                      placeholder="Enter father's name"
                    />
                    {errors.father_name && (
                      <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.father_name}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="grandfather_name">Grandfather's Name *</Label>
                    <Input
                      id="grandfather_name"
                      name="grandfather_name"
                      value={formData.grandfather_name}
                      onChange={handleInputChange}
                      className={`mt-1.5 ${isFieldError("grandfather_name") ? "border-destructive ring-1 ring-destructive" : ""}`}
                      placeholder="Enter grandfather's name"
                    />
                    {errors.grandfather_name && (
                      <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.grandfather_name}
                      </p>
                    )}
                  </div>

                  {/* Gender */}
                  <div>
                    <Label>Gender *</Label>
                    <Select value={formData.gender} onValueChange={handleGenderChange}>
                      <SelectTrigger
                        className={`mt-1.5 ${isFieldError("gender") ? "border-destructive ring-1 ring-destructive" : ""}`}
                      >
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.gender && (
                      <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.gender}
                      </p>
                    )}
                  </div>

                  {/* Grade */}
                  <div>
                    <Label>Grade *</Label>
                    <Select value={formData.grade_id} onValueChange={handleGradeChange} disabled={gradesLoading}>
                      <SelectTrigger
                        className={`mt-1.5 ${isFieldError("grade_id") ? "border-destructive ring-1 ring-destructive" : ""}`}
                      >
                        <SelectValue placeholder={gradesLoading ? "Loading..." : "Select grade"} />
                      </SelectTrigger>
                      <SelectContent>
                        {grades.map((grade) => (
                          <SelectItem key={grade.id} value={grade.id.toString()}>
                            {grade.grade_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.grade_id && (
                      <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.grade_id}
                      </p>
                    )}
                  </div>

                  {/* Section */}
                  <div>
                    <Label>Section *</Label>
                    <Select value={formData.section} onValueChange={handleSectionChange} disabled={!formData.grade_id}>
                      <SelectTrigger
                        className={`mt-1.5 ${isFieldError("section") ? "border-destructive ring-1 ring-destructive" : ""}`}
                      >
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {getSectionsForGrade(formData.grade_id).length > 0
                          ? getSectionsForGrade(formData.grade_id).map((section) => (
                              <SelectItem key={section.id} value={section.section_name}>
                                Section {section.section_name}
                              </SelectItem>
                            ))
                          : ["A", "B", "C", "D", "E"].map((s) => (
                              <SelectItem key={s} value={s}>
                                Section {s}
                              </SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                    {errors.section && (
                      <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.section}
                      </p>
                    )}
                  </div>

                  {/* Stream (only for Grade 11/12) */}
                  {isGrade11or12 && (
                    <div>
                      <Label>Stream *</Label>
                      <Select value={formData.stream} onValueChange={handleStreamChange}>
                        <SelectTrigger
                          className={`mt-1.5 ${isFieldError("stream") ? "border-destructive ring-1 ring-destructive" : ""}`}
                        >
                          <SelectValue placeholder="Select stream" />
                        </SelectTrigger>
                        <SelectContent>
                          {streamOptions.map((stream) => (
                            <SelectItem key={stream} value={stream}>
                              {stream}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.stream && (
                        <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {errors.stream}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <Label htmlFor="email">Email (Optional)</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`mt-1.5 ${isFieldError("email") ? "border-destructive ring-1 ring-destructive" : ""}`}
                      placeholder="Enter email"
                    />
                    {errors.email && (
                      <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={loading} className="gap-2">
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        Register Student
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Import Tab */}
        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Bulk Import Students</CardTitle>
                  <CardDescription>Add multiple students at once or import from CSV file</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 bg-transparent">
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Import CSV
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Import Progress */}
              {isImporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Importing students...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="h-2" />
                </div>
              )}

              {/* Grade, Section, Stream Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label>Grade *</Label>
                  <Select
                    value={bulkGradeId}
                    onValueChange={(v) => {
                      setBulkGradeId(v)
                      setBulkSection("")
                      setBulkStream("")
                    }}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {grades.map((grade) => (
                        <SelectItem key={grade.id} value={grade.id.toString()}>
                          {grade.grade_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Section *</Label>
                  <Select value={bulkSection} onValueChange={setBulkSection} disabled={!bulkGradeId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSectionsForGrade(bulkGradeId).length > 0
                        ? getSectionsForGrade(bulkGradeId).map((section) => (
                            <SelectItem key={section.id} value={section.section_name}>
                              Section {section.section_name}
                            </SelectItem>
                          ))
                        : ["A", "B", "C", "D", "E"].map((s) => (
                            <SelectItem key={s} value={s}>
                              Section {s}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>
                {isBulkGrade11or12 && (
                  <div>
                    <Label>Stream *</Label>
                    <Select value={bulkStream} onValueChange={setBulkStream}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select stream" />
                      </SelectTrigger>
                      <SelectContent>
                        {streamOptions.map((stream) => (
                          <SelectItem key={stream} value={stream}>
                            {stream}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Bulk Actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={addBulkRow} className="gap-2 bg-transparent">
                  <Plus className="h-4 w-4" />
                  Add Row
                </Button>
                <Button variant="outline" size="sm" onClick={() => addMultipleBulkRows(5)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add 5 Rows
                </Button>
                <Button variant="outline" size="sm" onClick={() => addMultipleBulkRows(10)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add 10 Rows
                </Button>
                <Button variant="outline" size="sm" onClick={regenerateBulkIds} className="gap-2 bg-transparent">
                  <RefreshCw className="h-4 w-4" />
                  Regenerate IDs
                </Button>
              </div>

              {/* Student List */}
              <ScrollArea className="h-[400px] border rounded-lg">
                <div className="p-4 space-y-4">
                  {bulkStudents.map((student, index) => (
                    <div
                      key={student.id}
                      className={`p-4 border rounded-lg space-y-3 ${
                        bulkDuplicateErrors[student.id] ? "border-amber-500 bg-amber-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Student #{index + 1}</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded">{student.student_id}</code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeBulkRow(student.id)}
                            className="h-8 w-8 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {bulkDuplicateErrors[student.id] && (
                        <div className="flex items-center gap-2 text-amber-700 text-sm">
                          <AlertTriangle className="h-4 w-4" />
                          {bulkDuplicateErrors[student.id]}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div>
                          <Label className="text-xs">Name *</Label>
                          <Input
                            value={student.name}
                            onChange={(e) => handleBulkInputChange(student.id, "name", e.target.value)}
                            onPaste={(e) => handlePaste(e, index, "name")}
                            className={`mt-1 ${bulkErrors[student.id]?.name ? "border-destructive" : ""}`}
                            placeholder="Name"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Father's Name *</Label>
                          <Input
                            value={student.father_name}
                            onChange={(e) => handleBulkInputChange(student.id, "father_name", e.target.value)}
                            className={`mt-1 ${bulkErrors[student.id]?.father_name ? "border-destructive" : ""}`}
                            placeholder="Father's name"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Grandfather's Name *</Label>
                          <Input
                            value={student.grandfather_name}
                            onChange={(e) => handleBulkInputChange(student.id, "grandfather_name", e.target.value)}
                            className={`mt-1 ${bulkErrors[student.id]?.grandfather_name ? "border-destructive" : ""}`}
                            placeholder="Grandfather's name"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Gender *</Label>
                          <Select
                            value={student.gender}
                            onValueChange={(v) => handleBulkInputChange(student.id, "gender", v)}
                          >
                            <SelectTrigger
                              className={`mt-1 ${bulkErrors[student.id]?.gender ? "border-destructive" : ""}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Email</Label>
                          <Input
                            value={student.email}
                            onChange={(e) => handleBulkInputChange(student.id, "email", e.target.value)}
                            className={`mt-1 ${bulkErrors[student.id]?.email ? "border-destructive" : ""}`}
                            placeholder="Email (optional)"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Submit */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{bulkStudents.length} student(s) ready to register</p>
                <Button onClick={handleBulkSubmit} disabled={bulkLoading} className="gap-2">
                  {bulkLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4" />
                      Register All Students
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
