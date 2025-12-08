"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { toast } from "sonner"
import jsPDF from "jspdf"
import "jspdf-autotable"
import * as XLSX from "xlsx"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Award,
  ArrowLeft,
  Download,
  FileText,
  FileSpreadsheet,
  FileIcon,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { getTeacherDataFromCookie } from "@/utils/teacherCookie"

const RESULTS_PER_PAGE = 10

interface Exam {
  id: string
  exam_code: string
  title: string
  subject_id: number
  grade_id: number
  section: string
  exam_date: string
  total_marks: number
  created_by: string
  exam_active: boolean
  subject_name?: string
  grade_name?: string
}

interface Result {
  id: number
  exam_id: number
  student_id: number
  total_marks_obtained: number
  grade: string
  comments: string
  created_at: string
  student_name: string
  student_student_id: string
  student_grade_id: number
  student_section: string
  exam_title: string
  exam_total_marks: number
  exam_subject_name: string
  exam_grade_name: string
}

export default function IndividualExamResultsPage() {
  const router = useRouter()
  const [results, setResults] = useState<Result[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [examFilter, setExamFilter] = useState("all")
  const [sectionFilter, setSectionFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    checkTeacherAuthAndFetchData()
  }, [])

  const checkTeacherAuthAndFetchData = async () => {
    try {
      const teacher = await getTeacherDataFromCookie()

      if (!teacher || !teacher.teacherId) {
        toast.error("Please login as teacher to view results")
        router.push("/teacher/login")
        return
      }

      await fetchTeacherExamsAndResults(teacher.teacherId)
    } catch (error) {
      toast.error("Authentication error. Please login again.")
      router.push("/teacher/login")
    }
  }

  const fetchTeacherExamsAndResults = async (teacherId: string) => {
    try {
      setLoading(true)

      const { data: teacherExams, error: examsError } = await supabase
        .from("exams")
        .select(`
          id,
          exam_code,
          title,
          subject_id,
          grade_id,
          section,
          exam_date,
          total_marks,
          created_by,
          exam_active,
          subjects!exams_subject_id_fkey(subject_name),
          grades!exams_grade_id_fkey(grade_name)
        `)
        .eq("created_by", teacherId)
        .eq("exam_active", true)

      if (examsError) {
        toast.error("Failed to load exams")
        return
      }

      const formattedExams: Exam[] = (teacherExams || []).map((exam: any) => ({
        id: exam.id.toString(),
        exam_code: exam.exam_code,
        title: exam.title,
        subject_id: exam.subject_id,
        grade_id: exam.grade_id,
        section: exam.section,
        exam_date: exam.exam_date,
        total_marks: exam.total_marks,
        created_by: exam.created_by,
        exam_active: exam.exam_active,
        subject_name: exam.subjects?.subject_name,
        grade_name: exam.grades?.grade_name,
      }))

      setExams(formattedExams)

      if (formattedExams.length === 0) {
        setLoading(false)
        return
      }

      const examIds = formattedExams.map((exam) => Number.parseInt(exam.id))

      const { data: examResults, error: resultsError } = await supabase
        .from("results")
        .select(`
          id,
          exam_id,
          student_id,
          total_marks_obtained,
          grade,
          comments,
          created_at,
          students!results_student_id_fkey(
            name,
            student_id,
            grade_id,
            section
          ),
          exams!results_exam_id_fkey(
            title,
            total_marks,
            subjects!exams_subject_id_fkey(subject_name),
            grades!exams_grade_id_fkey(grade_name)
        )
        `)
        .in("exam_id", examIds)

      if (resultsError) {
        toast.error("Failed to load results")
        return
      }

      const formattedResults: Result[] = (examResults || []).map((result: any) => ({
        id: result.id,
        exam_id: result.exam_id,
        student_id: result.student_id,
        total_marks_obtained: result.total_marks_obtained,
        grade: result.grade,
        comments: result.comments,
        created_at: result.created_at,
        student_name: result.students?.name || "Unknown",
        student_student_id: result.students?.student_id || "Unknown",
        student_grade_id: result.students?.grade_id || 0,
        student_section: result.students?.section || "Unknown",
        exam_title: result.exams?.title || "Unknown Exam",
        exam_total_marks: result.exams?.total_marks || 0,
        exam_subject_name: result.exams?.subjects?.subject_name || "Unknown",
        exam_grade_name: result.exams?.grades?.grade_name || "Unknown",
      }))

      setResults(formattedResults)
    } catch (error) {
      toast.error("Failed to load exam results")
    } finally {
      setLoading(false)
    }
  }

  const filteredResults = useMemo(() => {
    return results
      .filter((r) => {
        const matchesSearch =
          r.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.student_student_id.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesExam = examFilter === "all" || r.exam_id.toString() === examFilter
        const matchesSection = sectionFilter === "all" || r.student_section === sectionFilter
        return matchesSearch && matchesExam && matchesSection
      })
      .sort((a, b) => a.student_name.localeCompare(b.student_name))
  }, [results, searchQuery, examFilter, sectionFilter])

  const totalPages = Math.ceil(filteredResults.length / RESULTS_PER_PAGE)
  const paginatedResults = filteredResults.slice((currentPage - 1) * RESULTS_PER_PAGE, currentPage * RESULTS_PER_PAGE)

  const availableSections = useMemo(() => {
    return [...new Set(results.map((r) => r.student_section))].filter(Boolean).sort()
  }, [results])

  const averageScore = useMemo(() => {
    if (filteredResults.length === 0) return 0
    const totalScore = filteredResults.reduce((sum, r) => {
      const percentage = (r.total_marks_obtained / r.exam_total_marks) * 100
      return sum + percentage
    }, 0)
    return Math.round(totalScore / filteredResults.length)
  }, [filteredResults])

  const highestScore = useMemo(() => {
    if (filteredResults.length === 0) return 0
    return Math.max(...filteredResults.map((r) => Math.round((r.total_marks_obtained / r.exam_total_marks) * 100)))
  }, [filteredResults])

  const lowestScore = useMemo(() => {
    if (filteredResults.length === 0) return 0
    return Math.min(...filteredResults.map((r) => Math.round((r.total_marks_obtained / r.exam_total_marks) * 100)))
  }, [filteredResults])

  const exportToPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(20)
    doc.setTextColor(79, 70, 229)
    doc.text("Exam Results Report", 105, 20, { align: "center" })
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 35)
    doc.text(`Total Students: ${filteredResults.length}`, 14, 43)

    const headers = ["#", "Student ID", "Name", "Section", "Exam", "Score", "%"]
    const tableData = filteredResults.map((r, i) => {
      const percentage = Math.round((r.total_marks_obtained / r.exam_total_marks) * 100)
      return [
        i + 1,
        r.student_student_id,
        r.student_name,
        r.student_section,
        r.exam_title,
        `${r.total_marks_obtained}/${r.exam_total_marks}`,
        `${percentage}%`,
      ]
    })
    ;(doc as any).autoTable({
      head: [headers],
      body: tableData,
      startY: 55,
    })

    doc.save("individual_exam_results.pdf")
    toast.success("Exported to PDF")
  }

  const exportToExcel = () => {
    const data = filteredResults.map((r, i) => {
      const percentage = Math.round((r.total_marks_obtained / r.exam_total_marks) * 100)
      return {
        "#": i + 1,
        "Student ID": r.student_student_id,
        "Student Name": r.student_name,
        Section: r.student_section,
        "Exam Name": r.exam_title,
        Subject: r.exam_subject_name,
        Score: `${r.total_marks_obtained}/${r.exam_total_marks}`,
        Percentage: `${percentage}%`,
        "Submit Date": format(new Date(r.created_at), "MMM dd, yyyy"),
      }
    })

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Results")
    XLSX.writeFile(wb, `individual_exam_results_${format(new Date(), "yyyy-MM-dd")}.xlsx`)
    toast.success("Exported to Excel")
  }

  const exportToWord = () => {
    const tableHeader =
      '<table border="1" style="border-collapse: collapse; width:100%;"><tr style="background-color: #4F46E5; color: white;"><th>#</th><th>ID</th><th>Name</th><th>Section</th><th>Exam</th><th>Score</th><th>%</th><th>Date</th></tr>'
    const tableBody = filteredResults
      .map((r, i) => {
        const percentage = Math.round((r.total_marks_obtained / r.exam_total_marks) * 100)
        return `<tr style="${i % 2 === 0 ? "background-color: #EFF6FF;" : ""}">
        <td>${i + 1}</td>
        <td>${r.student_student_id}</td>
        <td>${r.student_name}</td>
        <td>${r.student_section}</td>
        <td>${r.exam_title}</td>
        <td>${r.total_marks_obtained}/${r.exam_total_marks}</td>
        <td>${percentage}%</td>
        <td>${format(new Date(r.created_at), "MMM dd, yyyy")}</td>
      </tr>`
      })
      .join("")

    const content = `<html><body><h1 style="color: #4F46E5;">Individual Exam Results</h1><p>Generated: ${format(new Date(), "PPP")}</p>${tableHeader}${tableBody}</table></body></html>`
    const blob = new Blob([content], { type: "application/msword" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `individual_exam_results_${format(new Date(), "yyyy-MM-dd")}.doc`
    a.click()
    toast.success("Exported to Word")
  }

  if (loading) {
    return (
      <div className="flex-1 space-y-8 p-4 md:p-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
            <Skeleton className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
          </div>
          <Skeleton className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pb-24 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Individual Exam Results</h1>
          <p className="text-muted-foreground mt-1 text-sm">View student exam performance by individual exam</p>
        </div>
        <Button variant="outline" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Results</CardTitle>
            <Award className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{filteredResults.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Average Score</CardTitle>
            <Award className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{averageScore}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Highest Score</CardTitle>
            <Award className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{highestScore}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Lowest Score</CardTitle>
            <Award className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{lowestScore}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 text-sm"
          />
        </div>

        <Select value={examFilter} onValueChange={setExamFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="All Exams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Exams</SelectItem>
            {exams.map((exam) => (
              <SelectItem key={exam.id} value={exam.id}>
                {exam.title} ({exam.subject_name})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sectionFilter} onValueChange={setSectionFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="All Sections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sections</SelectItem>
            {availableSections.map((section) => (
              <SelectItem key={section} value={section}>
                Section {section}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 bg-transparent">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportToPDF} className="gap-2" disabled={filteredResults.length === 0}>
              <FileText className="h-4 w-4" />
              Export as PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToExcel} className="gap-2" disabled={filteredResults.length === 0}>
              <FileSpreadsheet className="h-4 w-4" />
              Export as Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToWord} className="gap-2" disabled={filteredResults.length === 0}>
              <FileIcon className="h-4 w-4" />
              Export as Word
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table Section with fixed student name column */}
      {filteredResults.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-muted-foreground">
            {results.length === 0
              ? "No exam results found. Students need to take your exams first."
              : "No results match your current filters."}
          </div>
        </Card>
      ) : (
        <Card className="border shadow-sm overflow-hidden">
          <div className="relative">
            <div className="overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-20 bg-gray-50">
                  <tr>
                    <th className="w-12 text-xs font-medium text-center p-3 border border-gray-200">#</th>
                    {/* Fixed student name column */}
                    <th className="sticky left-0 z-30 bg-gray-50 min-w-[180px] text-xs font-medium text-left p-3 border border-gray-200">
                      Student Name
                    </th>
                    {/* Scrollable columns */}
                    <th className="min-w-[100px] text-xs font-medium text-left p-3 border border-gray-200 bg-gray-50">
                      Student ID
                    </th>
                    <th className="min-w-[80px] text-xs font-medium text-left p-3 border border-gray-200 bg-gray-50">
                      Grade
                    </th>
                    <th className="min-w-[120px] text-xs font-medium text-left p-3 border border-gray-200 bg-gray-50">
                      Exam
                    </th>
                    <th className="min-w-[100px] text-xs font-medium text-left p-3 border border-gray-200 bg-gray-50">
                      Subject
                    </th>
                    <th className="min-w-[140px] text-xs font-medium text-left p-3 border border-gray-200 bg-gray-50">
                      Score
                    </th>
                    <th className="min-w-[100px] text-xs font-medium text-left p-3 border border-gray-200 bg-gray-50">
                      Submit Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedResults.map((result, index) => {
                    const percentage = Math.round((result.total_marks_obtained / result.exam_total_marks) * 100)
                    return (
                      <tr key={result.id} className="hover:bg-muted/30 transition-colors">
                        <td className="text-center text-xs font-medium p-3 border border-gray-200">
                          {(currentPage - 1) * RESULTS_PER_PAGE + index + 1}
                        </td>
                        {/* Fixed student name column */}
                        <td className="sticky left-0 z-10 bg-white p-3 border border-gray-200">
                          <div className="font-medium text-sm truncate max-w-[180px]" title={result.student_name}>
                            {result.student_name}
                          </div>
                        </td>
                        {/* Scrollable columns */}
                        <td className="bg-white p-3 border border-gray-200 text-sm font-medium">
                          {result.student_student_id}
                        </td>
                        <td className="bg-white p-3 border border-gray-200 text-sm">
                          <Badge variant="outline" className="text-xs">
                            {result.exam_grade_name} ({result.student_section})
                          </Badge>
                        </td>
                        <td className="bg-white p-3 border border-gray-200 text-sm truncate max-w-[120px]" title={result.exam_title}>
                          {result.exam_title}
                        </td>
                        <td className="bg-white p-3 border truncate border-gray-200 text-sm truncate max-w-[120px]">{result.exam_subject_name}</td>
                        <td className="bg-white p-3 border border-gray-200 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs">
                              {result.total_marks_obtained}/{result.exam_total_marks}
                            </span>
                            <Progress value={percentage} className="w-12 h-1.5" />
                            <span className="text-xs text-muted-foreground">({percentage}%)</span>
                          </div>
                        </td>
                        <td className="bg-white p-3 border border-gray-200 text-sm">
                          {format(new Date(result.created_at), "MMM dd, yyyy")}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Showing {(currentPage - 1) * RESULTS_PER_PAGE + 1} to{" "}
            {Math.min(currentPage * RESULTS_PER_PAGE, filteredResults.length)} of {filteredResults.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0 text-xs"
            >
              «
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="h-8 w-8 p-0 text-xs"
                >
                  {pageNum}
                </Button>
              )
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0 text-xs"
            >
              »
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}