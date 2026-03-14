"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
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
  Filter,
  X,
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
  comments: string
  created_at: string
  student_name: string
  student_student_id: string
  student_grade_id: number
  student_section: string
  student_gender: string
  student_stream: string
  exam_title: string
  exam_total_marks: number
  exam_subject_name: string
  exam_grade_name: string
  percentage?: number
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
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    checkTeacherAuthAndFetchData()
  }, [])

  const checkTeacherAuthAndFetchData = async () => {
    try {
      const teacher = await getTeacherDataFromCookie()

      if (!teacher || !teacher.teacherId) {
        toast.error("Please login as teacher to view results")
        router.push("/login/tech")
        return
      }

      await fetchTeacherExamsAndResults(teacher.teacherId)
    } catch (error) {
      console.error("Authentication error:", error)
      toast.error("Authentication error. Please login again.")
      router.push("/login/tech")
    }
  }

  const fetchTeacherExamsAndResults = async (teacherId: string) => {
    try {
      setLoading(true)
      setStatsLoading(true)

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
          subjects(subject_name),
          grades(grade_name)
        `)
        .eq("created_by", teacherId)
        .eq("exam_active", true)
        .order("created_at", { ascending: false })

      if (examsError) {
        console.error("Exams fetch error:", examsError)
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
        subject_name: exam.subjects?.subject_name || "Unknown",
        grade_name: exam.grades?.grade_name || "Unknown",
      }))

      setExams(formattedExams)

      if (formattedExams.length === 0) {
        setResults([])
        setLoading(false)
        setStatsLoading(false)
        return
      }

      const examIds = formattedExams.map((exam) => exam.id)

      const { data: examResults, error: resultsError } = await supabase
        .from("results")
        .select(`
          *,
          students!inner(
            name,
            student_id,
            grade_id,
            section,
            gender,
            stream
          ),
          exams!inner(
            title,
            total_marks,
            subjects!inner(subject_name),
            grades!inner(grade_name)
          )
        `)
        .in("exam_id", examIds)
        .order("created_at", { ascending: false })

      if (resultsError) {
        console.error("Results fetch error:", resultsError)
        toast.error("Failed to load results")
        return
      }

      const formattedResults: Result[] = (examResults || []).map((result: any) => {
        const percentage = result.exams?.total_marks
          ? Math.round((result.total_marks_obtained / result.exams.total_marks) * 100)
          : 0

        return {
          id: result.id,
          exam_id: result.exam_id,
          student_id: result.student_id,
          total_marks_obtained: result.total_marks_obtained,
          comments: result.comments || "",
          created_at: result.created_at,
          student_name: result.students?.name || "Unknown",
          student_student_id: result.students?.student_id || "Unknown",
          student_grade_id: result.students?.grade_id || 0,
          student_section: result.students?.section || "Unknown",
          student_gender: result.students?.gender || "Unknown",
          student_stream: result.students?.stream || "Unknown",
          exam_title: result.exams?.title || "Unknown Exam",
          exam_total_marks: result.exams?.total_marks || 0,
          exam_subject_name: result.exams?.subjects?.subject_name || "Unknown",
          exam_grade_name: result.exams?.grades?.grade_name || "Unknown",
          percentage: percentage
        }
      })

      setResults(formattedResults)
      toast.success(`Loaded ${formattedResults.length} results`)
    } catch (error) {
      console.error("Fetch error:", error)
      toast.error("Failed to load exam results")
    } finally {
      setLoading(false)
      setStatsLoading(false)
    }
  }

  const filteredResults = useMemo(() => {
    return results
      .filter((r) => {
        const matchesSearch =
          r.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.student_student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.exam_title.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesExam = examFilter === "all" || r.exam_id.toString() === examFilter
        const matchesSection = sectionFilter === "all" || r.student_section === sectionFilter

        return matchesSearch && matchesExam && matchesSection
      })
      .sort((a, b) => {
        if (a.student_name !== b.student_name) {
          return a.student_name.localeCompare(b.student_name)
        }
        return a.exam_title.localeCompare(b.exam_title)
      })
  }, [results, searchQuery, examFilter, sectionFilter])

  const totalPages = Math.ceil(filteredResults.length / RESULTS_PER_PAGE)
  const paginatedResults = filteredResults.slice((currentPage - 1) * RESULTS_PER_PAGE, currentPage * RESULTS_PER_PAGE)

  const availableSections = useMemo(() => {
    return [...new Set(results.map((r) => r.student_section))].filter(Boolean).sort()
  }, [results])

  const stats = useMemo(() => {
    if (filteredResults.length === 0) {
      return {
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        totalResults: 0,
        totalMarks: 0
      }
    }

    const percentages = filteredResults.map(r => r.percentage || 0)
    const averageScore = Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
    const highestScore = Math.max(...percentages)
    const lowestScore = Math.min(...percentages)
    const totalMarks = filteredResults.reduce((sum, r) => sum + r.total_marks_obtained, 0)

    return {
      averageScore,
      highestScore,
      lowestScore,
      totalResults: filteredResults.length,
      totalMarks
    }
  }, [filteredResults])

  const clearFilters = () => {
    setSearchQuery("")
    setExamFilter("all")
    setSectionFilter("all")
    setCurrentPage(1)
  }

  const exportToPDF = () => {
    if (filteredResults.length === 0) {
      toast.error("No results to export")
      return
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    })

    // School header
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text("KUMSA MORODA SECONDARY SCHOOL", 148, 15, { align: "center" })

    doc.setFontSize(14)
    doc.text("GRADE 12 SECTION B STUDENT MARK LIST", 148, 22, { align: "center" })

    doc.setFontSize(12)
    doc.text("SUBJECT: ______", 148, 29, { align: "center" })

    // Academic year
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.text("2018 E.C", 270, 15, { align: "right" })

    // Table headers matching the image
    const headers = [
      ["No", "Name", "F.Name", "G.F.Name", "Sex", "Age", "SEC", "10%", "20%", "50%", "Final 50%", "Total 100%"]
    ]

    // Prepare data rows
    const tableData = filteredResults.map((result, index) => {
      return [
        (index + 1).toString(),
        result.student_name.split(' ')[0] || "",
        result.student_name.split(' ')[1] || "",
        result.student_name.split(' ')[2] || "",
        result.student_gender.substring(0, 1),
        "18", // Default age since we don't have it in the data
        result.student_section,
        "", // 10% - empty as in image
        "", // 20% - empty as in image
        "", // 50% - empty as in image
        result.total_marks_obtained.toString(), // Final 50%
        result.total_marks_obtained.toString() // Total 100%
      ]
    })

    // Generate table
    autoTable(doc, {
      head: headers,
      body: tableData,
      startY: 35,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      bodyStyles: {
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 10 }, // No
        1: { cellWidth: 25 }, // Name
        2: { cellWidth: 25 }, // F.Name
        3: { cellWidth: 25 }, // G.F.Name
        4: { cellWidth: 10 }, // Sex
        5: { cellWidth: 10 }, // Age
        6: { cellWidth: 10 }, // SEC
        7: { cellWidth: 15 }, // 10%
        8: { cellWidth: 15 }, // 20%
        9: { cellWidth: 15 }, // 50%
        10: { cellWidth: 20 }, // Final 50%
        11: { cellWidth: 20 }, // Total 100%
      },
      margin: { left: 10, right: 10 },
    })

    doc.save(`student_mark_list_${format(new Date(), "yyyy-MM-dd")}.pdf`)
    toast.success("Exported to PDF successfully")
  }

  const exportToExcel = () => {
    if (filteredResults.length === 0) {
      toast.error("No results to export")
      return
    }

    const data = filteredResults.map((r, i) => ({
      "No": i + 1,
      "Name": r.student_name.split(' ')[0] || "",
      "F.Name": r.student_name.split(' ')[1] || "",
      "G.F.Name": r.student_name.split(' ')[2] || "",
      "Sex": r.student_gender.substring(0, 1),
      "Age": 18,
      "SEC": r.student_section,
      "10%": "",
      "20%": "",
      "50%": "",
      "Final 50%": r.total_marks_obtained,
      "Total 100%": r.total_marks_obtained
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)

    // Add title
    XLSX.utils.sheet_add_aoa(ws, [
      ["KUMSA MORODA SECONDARY SCHOOL"],
      ["GRADE 12 SECTION B STUDENT MARK LIST"],
      ["SUBJECT: __________________"],
      ["2018 E.C"],
      []
    ], { origin: "A1" })

    const wscols = [
      { wch: 5 },  // No
      { wch: 15 }, // Name
      { wch: 15 }, // F.Name
      { wch: 15 }, // G.F.Name
      { wch: 5 },  // Sex
      { wch: 5 },  // Age
      { wch: 5 },  // SEC
      { wch: 8 },  // 10%
      { wch: 8 },  // 20%
      { wch: 8 },  // 50%
      { wch: 10 }, // Final 50%
      { wch: 10 }  // Total 100%
    ]
    ws['!cols'] = wscols

    XLSX.utils.book_append_sheet(wb, ws, "Mark List")
    XLSX.writeFile(wb, `student_mark_list_${format(new Date(), "yyyy-MM-dd")}.xlsx`)
    toast.success("Exported to Excel successfully")
  }

  const exportToWord = () => {
    if (filteredResults.length === 0) {
      toast.error("No results to export")
      return
    }

    const tableRows = filteredResults.map((r, i) => `
      <tr>
        <td style="border: 1px solid black; padding: 4px; text-align: center;">${i + 1}</td>
        <td style="border: 1px solid black; padding: 4px;">${r.student_name.split(' ')[0] || ""}</td>
        <td style="border: 1px solid black; padding: 4px;">${r.student_name.split(' ')[1] || ""}</td>
        <td style="border: 1px solid black; padding: 4px;">${r.student_name.split(' ')[2] || ""}</td>
        <td style="border: 1px solid black; padding: 4px; text-align: center;">${r.student_gender.substring(0, 1)}</td>
        <td style="border: 1px solid black; padding: 4px; text-align: center;">18</td>
        <td style="border: 1px solid black; padding: 4px; text-align: center;">${r.student_section}</td>
        <td style="border: 1px solid black; padding: 4px; text-align: center;"></td>
        <td style="border: 1px solid black; padding: 4px; text-align: center;"></td>
        <td style="border: 1px solid black; padding: 4px; text-align: center;"></td>
        <td style="border: 1px solid black; padding: 4px; text-align: center;">${r.total_marks_obtained}</td>
        <td style="border: 1px solid black; padding: 4px; text-align: center;">${r.total_marks_obtained}</td>
      </tr>
    `).join("")

    const content = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Student Mark List</title>
          <style>
            body { font-family: 'Times New Roman', serif; margin: 30px; }
            h1, h2, h3 { text-align: center; margin: 5px 0; }
            h1 { font-size: 18px; }
            h2 { font-size: 16px; }
            h3 { font-size: 14px; }
            .year { text-align: right; font-size: 12px; margin-bottom: 20px; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid black; padding: 4px; font-size: 10px; }
            th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
          </style>
        </head>
        <body>
          <h1>KUMSA MORODA SECONDARY SCHOOL</h1>
          <h2>GRADE 12 SECTION B STUDENT MARK LIST</h2>
          <h3>SUBJECT: __________________</h3>
          <div class="year">2018 E.C</div>
          
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Name</th>
                <th>F.Name</th>
                <th>G.F.Name</th>
                <th>Sex</th>
                <th>Age</th>
                <th>SEC</th>
                <th>10%</th>
                <th>20%</th>
                <th>50%</th>
                <th>Final 50%</th>
                <th>Total 100%</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `

    const blob = new Blob([content], { type: "application/msword" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `student_mark_list_${format(new Date(), "yyyy-MM-dd")}.doc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success("Exported to Word successfully")
  }

  if (loading) {
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
    )
  }

  return (
    <div className="flex-1 space-y-6 pt-0 p-4 md:p-8 pb-24 bg-transparent min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Individual Exam Results</h1>
          <p className="text-muted-foreground mt-1 text-sm">View student exam performance by individual exam</p>
        </div>
        <Button variant="outline" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Results</CardTitle>
            <Award className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : stats.totalResults}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Average Score</CardTitle>
            <Award className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : `${stats.averageScore}%`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Highest Score</CardTitle>
            <Award className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : `${stats.highestScore}%`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Lowest Score</CardTitle>
            <Award className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : `${stats.lowestScore}%`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Exams</CardTitle>
            <Award className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : exams.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, or exam..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="pl-10 text-sm"
          />
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <Select value={examFilter} onValueChange={(value) => {
            setExamFilter(value)
            setCurrentPage(1)
          }}>
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

          <Select value={sectionFilter} onValueChange={(value) => {
            setSectionFilter(value)
            setCurrentPage(1)
          }}>
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

          {(searchQuery !== "" || examFilter !== "all" || sectionFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-2 h-10"
            >
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export Report</span>
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
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filteredResults.length}</span> results
          {(searchQuery || examFilter !== "all" || sectionFilter !== "all") && (
            <span className="ml-2">
              (filtered from <span className="font-semibold">{results.length}</span> total)
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
        </div>
      </div>

      {/* Table Section */}
      {filteredResults.length === 0 ? (
        <Card className="border shadow-sm overflow-hidden">
          <div className="p-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center mb-4">
              <Filter className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {results.length === 0
                ? "No exam results found"
                : "No matching results"}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {results.length === 0
                ? "Students need to complete your exams first. Results will appear here automatically."
                : "Try adjusting your search or filters to find what you're looking for."}
            </p>
            {results.length === 0 && exams.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                You have {exams.length} active exam(s). Make sure students have been assigned and completed them.
              </p>
            )}
          </div>
        </Card>
      ) : (
        <>
          <Card className="shadow-sm border border-muted/60 p-0">
            <div className="rounded-lg border border-muted/50 overflow-hidden p-0">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted/40">
                  <tr className="border-b dark:border-zinc-800">
                    <th className="w-12 text-xs font-medium text-center p-4 text-muted-foreground">#</th>
                    <th className="min-w-[120px] text-xs font-medium text-left p-4 text-muted-foreground">
                      Student ID
                    </th>
                    <th className="min-w-[180px] text-xs font-medium text-left p-4 text-muted-foreground">
                      Student Name
                    </th>
                    <th className="min-w-[200px] text-xs font-medium text-left p-4 text-muted-foreground">
                      Exam Name
                    </th>
                    <th className="min-w-[120px] text-xs font-medium text-left p-4 text-muted-foreground">
                      Subject
                    </th>
                    <th className="min-w-[100px] text-xs font-medium text-center p-4 text-muted-foreground">
                      Score
                    </th>
                    <th className="min-w-[80px] text-xs font-medium text-center p-4 text-muted-foreground">
                      Gender
                    </th>
                    <th className="min-w-[80px] text-xs font-medium text-center p-4 text-muted-foreground">
                      Stream
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedResults.map((result, index) => {
                    const getGenderColor = (gender: string) => {
                      switch (gender.toLowerCase()) {
                        case 'male': return 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                        case 'female': return 'bg-pink-50 dark:bg-pink-900/40 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800'
                        default: return 'bg-zinc-50 dark:bg-zinc-900/40 text-zinc-700 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                      }
                    }

                    const getStreamColor = (stream: string) => {
                      switch (stream) {
                        case 'Natural': return 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                        case 'Social': return 'bg-violet-50 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800'
                        case 'Common': return 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                        default: return 'bg-zinc-50 dark:bg-zinc-900/40 text-zinc-700 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                      }
                    }

                    return (
                      <tr
                        key={result.id}
                        className={index % 2 === 0 ? "bg-muted/20" : ""}
                      >
                        <td className="text-center text-xs font-medium p-4 text-foreground">
                          {(currentPage - 1) * RESULTS_PER_PAGE + index + 1}
                        </td>
                        <td className="p-4 text-sm font-mono font-medium">
                          {result.student_student_id}
                        </td>
                        <td className="p-4 text-sm font-medium truncate max-w-[150px]" title={result.student_name}>
                          {result.student_name}
                        </td>
                        <td className="p-4 text-sm">
                          <div className="truncate max-w-[180px]" title={result.exam_title}>
                            {result.exam_title}
                          </div>
                        </td>
                        <td className="p-4 text-sm truncate max-w-[100px]" title={result.exam_subject_name}>
                          {result.exam_subject_name}
                        </td>
                        <td className="p-4 text-sm text-center font-bold">
                          {result.total_marks_obtained}/{result.exam_total_marks}
                        </td>
                        <td className="p-4 text-sm text-center">
                          <Badge className={`${getGenderColor(result.student_gender)} text-xs font-bold px-3 py-1 truncate max-w-[80px]`}>
                            {result.student_gender}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-center">
                          <Badge className={`${getStreamColor(result.student_stream)} text-xs font-bold px-3 py-1 truncate max-w-[80px]`}>
                            {result.student_stream || 'N/A'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

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
        </>
      )}
    </div>
  )
}