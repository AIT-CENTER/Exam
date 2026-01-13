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
        router.push("/teacher/login")
        return
      }

      await fetchTeacherExamsAndResults(teacher.teacherId)
    } catch (error) {
      console.error("Authentication error:", error)
      toast.error("Authentication error. Please login again.")
      router.push("/teacher/login")
    }
  }

  const fetchTeacherExamsAndResults = async (teacherId: string) => {
    try {
      setLoading(true)
      setStatsLoading(true)

      // Fetch teacher's exams
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

      // Get exam IDs
      const examIds = formattedExams.map((exam) => exam.id)

      // Fetch results for these exams with proper joins
      const { data: examResults, error: resultsError } = await supabase
        .from("results")
        .select(`
          *,
          students!inner(
            name,
            student_id,
            grade_id,
            section
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

      // Format results properly
      const formattedResults: Result[] = (examResults || []).map((result: any) => {
        const percentage = result.exams?.total_marks 
          ? Math.round((result.total_marks_obtained / result.exams.total_marks) * 100) 
          : 0
        
        return {
          id: result.id,
          exam_id: result.exam_id,
          student_id: result.student_id,
          total_marks_obtained: result.total_marks_obtained,
          grade: result.grade || calculateGrade(percentage),
          comments: result.comments || "",
          created_at: result.created_at,
          student_name: result.students?.name || "Unknown",
          student_student_id: result.students?.student_id || "Unknown",
          student_grade_id: result.students?.grade_id || 0,
          student_section: result.students?.section || "Unknown",
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

  const calculateGrade = (percentage: number): string => {
    if (percentage >= 90) return "A+"
    if (percentage >= 80) return "A"
    if (percentage >= 70) return "B"
    if (percentage >= 60) return "C"
    if (percentage >= 50) return "D"
    return "F"
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
        // Sort by student name, then by exam title
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

  // Statistics calculations
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
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // Add header with styling
    doc.setFillColor(79, 70, 229)
    doc.roundedRect(10, 10, 190, 20, 3, 3, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.text("Individual Exam Results Report", 105, 22, { align: "center" })

    // Add report details
    doc.setTextColor(50, 50, 50)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Generated: ${format(new Date(), "PPPP")}`, 15, 35)
    doc.text(`Total Students: ${filteredResults.length}`, 15, 40)
    doc.text(`Average Score: ${stats.averageScore}%`, 15, 45)

    // Add teacher info if available
    const teacher = getTeacherDataFromCookie()
    if (teacher) {
      doc.text(`Teacher: ${teacher.fullName || teacher.username}`, 15, 50)
    }

    // Create table with only required columns
    const headers = [
      ["#", "Student ID", "Student Name", "Exam Name", "Subject", "Score", "Grade"]
    ]

    const tableData = filteredResults.map((r, i) => {
      return [
        (i + 1).toString(),
        r.student_student_id,
        r.student_name,
        r.exam_title.substring(0, 25) + (r.exam_title.length > 25 ? '...' : ''),
        r.exam_subject_name,
        `${r.total_marks_obtained}/${r.exam_total_marks}`,
        calculateGrade(r.percentage || Math.round((r.total_marks_obtained / r.exam_total_marks) * 100))
      ]
    })

    // Add table with styling
    autoTable(doc, {
      head: headers,
      body: tableData,
      startY: 60,
      theme: 'striped',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 3,
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 40, halign: 'left' },
        3: { cellWidth: 50, halign: 'left' },
        4: { cellWidth: 30, halign: 'left' },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 15, halign: 'center' }
      },
      margin: { left: 10, right: 10 },
      tableLineColor: [200, 200, 200],
      tableLineWidth: 0.1,
      didDrawPage: function (data) {
        // Add page numbers
        const pageCount = doc.internal.getNumberOfPages()
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 10
        )
      }
    })

    doc.save(`exam_results_${format(new Date(), "yyyy-MM-dd_HH-mm")}.pdf`)
    toast.success("Exported to PDF successfully")
  }

  const exportToExcel = () => {
    if (filteredResults.length === 0) {
      toast.error("No results to export")
      return
    }

    const data = filteredResults.map((r, i) => {
      const percentage = r.percentage || Math.round((r.total_marks_obtained / r.exam_total_marks) * 100)
      return {
        "#": i + 1,
        "Student ID": r.student_student_id,
        "Student Name": r.student_name,
        "Exam Name": r.exam_title,
        "Subject": r.exam_subject_name,
        "Score Obtained": r.total_marks_obtained,
        "Total Marks": r.exam_total_marks,
        "Score": `${r.total_marks_obtained}/${r.exam_total_marks}`,
        "Grade": calculateGrade(percentage)
      }
    })

    // Add summary statistics
    const summaryData = {
      "#": "SUMMARY",
      "Student ID": `Total Results: ${filteredResults.length}`,
      "Student Name": `Average Score: ${stats.averageScore}%`,
      "Exam Name": `Highest: ${stats.highestScore}%`,
      "Subject": `Lowest: ${stats.lowestScore}%`,
      "Score Obtained": `Total Marks: ${stats.totalMarks}`,
      "Total Marks": `Generated: ${format(new Date(), "PPPP")}`
    }

    // Create workbook with multiple sheets
    const wb = XLSX.utils.book_new()
    
    // Main results sheet
    const ws = XLSX.utils.json_to_sheet(data)
    
    // Add summary row at the beginning
    XLSX.utils.sheet_add_json(ws, [summaryData], { skipHeader: true, origin: "A1" })
    
    // Style column widths
    const wscols = [
      { wch: 5 },   // #
      { wch: 15 },  // Student ID
      { wch: 25 },  // Student Name
      { wch: 40 },  // Exam Name
      { wch: 20 },  // Subject
      { wch: 15 },  // Score Obtained
      { wch: 12 },  // Total Marks
      { wch: 15 },  // Score
      { wch: 8 }    // Grade
    ]
    ws['!cols'] = wscols

    XLSX.utils.book_append_sheet(wb, ws, "Exam Results")
    
    // Add statistics sheet
    const statsData = [
      ["Exam Results Statistics", ""],
      ["Total Results", filteredResults.length],
      ["Average Score", `${stats.averageScore}%`],
      ["Highest Score", `${stats.highestScore}%`],
      ["Lowest Score", `${stats.lowestScore}%`],
      ["Total Marks Obtained", stats.totalMarks],
      ["Date Generated", format(new Date(), "PPPP")]
    ]
    const statsWs = XLSX.utils.aoa_to_sheet(statsData)
    XLSX.utils.book_append_sheet(wb, statsWs, "Statistics")

    XLSX.writeFile(wb, `exam_results_${format(new Date(), "yyyy-MM-dd")}.xlsx`)
    toast.success("Exported to Excel successfully")
  }

  const exportToWord = () => {
    if (filteredResults.length === 0) {
      toast.error("No results to export")
      return
    }

    const tableHeader = `
      <table border="1" style="border-collapse: collapse; width:100%; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; font-weight: bold;">
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">#</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">Student ID</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Student Name</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Exam Name</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Subject</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">Score</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">Grade</th>
          </tr>
        </thead>
        <tbody>`

    const tableBody = filteredResults
      .map((r, i) => {
        const percentage = r.percentage || Math.round((r.total_marks_obtained / r.exam_total_marks) * 100)
        const grade = calculateGrade(percentage)
        const gradeColor = grade === 'A+' ? '#10B981' : 
                          grade === 'A' ? '#3B82F6' : 
                          grade === 'B' ? '#8B5CF6' : 
                          grade === 'C' ? '#F59E0B' : 
                          grade === 'D' ? '#EF4444' : '#6B7280'
        
        return `
          <tr style="${i % 2 === 0 ? 'background-color: #F8FAFC;' : 'background-color: #FFFFFF;'}">
            <td style="padding: 10px; border: 1px solid #E5E7EB; text-align: center; font-weight: 500;">${i + 1}</td>
            <td style="padding: 10px; border: 1px solid #E5E7EB; text-align: center; font-family: 'Courier New', monospace;">${r.student_student_id}</td>
            <td style="padding: 10px; border: 1px solid #E5E7EB; text-align: left;">${r.student_name}</td>
            <td style="padding: 10px; border: 1px solid #E5E7EB; text-align: left; max-width: 200px;">${r.exam_title}</td>
            <td style="padding: 10px; border: 1px solid #E5E7EB; text-align: left;">${r.exam_subject_name}</td>
            <td style="padding: 10px; border: 1px solid #E5E7EB; text-align: center; font-weight: 600;">
              ${r.total_marks_obtained}/${r.exam_total_marks}
            </td>
            <td style="padding: 10px; border: 1px solid #E5E7EB; text-align: center;">
              <span style="color: ${gradeColor}; font-weight: bold; padding: 4px 8px; border-radius: 4px; background-color: ${gradeColor}15;">
                ${grade}
              </span>
            </td>
          </tr>`
      })
      .join("")

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Exam Results Report</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 40px; 
              color: #1F2937;
              line-height: 1.6;
            }
            .header { 
              background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
              color: white; 
              padding: 30px; 
              border-radius: 12px;
              margin-bottom: 30px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .stats { 
              background-color: #F3F4F6; 
              padding: 20px; 
              border-radius: 8px; 
              margin-bottom: 25px;
              border-left: 4px solid #4F46E5;
            }
            .footer { 
              margin-top: 40px; 
              padding-top: 20px; 
              border-top: 2px solid #E5E7EB; 
              color: #6B7280; 
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">Exam Results Report</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 16px;">
              Individual Student Performance Analysis
            </p>
          </div>
          
          <div class="stats">
            <h3 style="margin-top: 0; color: #4F46E5;">Report Summary</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 20px;">
              <div style="min-width: 150px;">
                <div style="font-size: 12px; color: #6B7280;">Total Results</div>
                <div style="font-size: 24px; font-weight: bold; color: #1F2937;">${filteredResults.length}</div>
              </div>
              <div style="min-width: 150px;">
                <div style="font-size: 12px; color: #6B7280;">Average Score</div>
                <div style="font-size: 24px; font-weight: bold; color: #10B981;">${stats.averageScore}%</div>
              </div>
              <div style="min-width: 150px;">
                <div style="font-size: 12px; color: #6B7280;">Highest Score</div>
                <div style="font-size: 24px; font-weight: bold; color: #3B82F6;">${stats.highestScore}%</div>
              </div>
              <div style="min-width: 150px;">
                <div style="font-size: 12px; color: #6B7280;">Lowest Score</div>
                <div style="font-size: 24px; font-weight: bold; color: #EF4444;">${stats.lowestScore}%</div>
              </div>
            </div>
          </div>
          
          <div>
            <h3 style="color: #4F46E5; margin-bottom: 15px;">Student Results</h3>
            ${tableHeader}${tableBody}</tbody></table>
          </div>
          
          <div class="footer">
            <p>Generated on: ${format(new Date(), "PPPP 'at' HH:mm")}</p>
            <p>© ${new Date().getFullYear()} Exam Management System. All rights reserved.</p>
          </div>
        </body>
      </html>`

    const blob = new Blob([content], { type: "application/msword" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `exam_results_${format(new Date(), "yyyy-MM-dd")}.doc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success("Exported to Word successfully")
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

          {/* Export Dropdown */}
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
          Showing <span className="font-semibold text-gray-900">{filteredResults.length}</span> results
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

      {/* Table Section - Displaying only required columns */}
      {filteredResults.length === 0 ? (
        <Card className="border shadow-sm overflow-hidden">
          <div className="p-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Filter className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
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
          <Card className="border shadow-sm overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-12 text-xs font-medium text-center p-4 border border-gray-200">#</th>
                    <th className="min-w-[120px] text-xs font-medium text-left p-4 border border-gray-200">
                      Student ID
                    </th>
                    <th className="min-w-[180px] text-xs font-medium text-left p-4 border border-gray-200">
                      Student Name
                    </th>
                    <th className="min-w-[200px] text-xs font-medium text-left p-4 border border-gray-200">
                      Exam Name
                    </th>
                    <th className="min-w-[120px] text-xs font-medium text-left p-4 border border-gray-200">
                      Subject
                    </th>
                    <th className="min-w-[100px] text-xs font-medium text-center p-4 border border-gray-200">
                      Score
                    </th>
                    <th className="min-w-[80px] text-xs font-medium text-center p-4 border border-gray-200">
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedResults.map((result, index) => {
                    const percentage = result.percentage || Math.round((result.total_marks_obtained / result.exam_total_marks) * 100)
                    const grade = calculateGrade(percentage)
                    const getGradeColor = (grade: string) => {
                      switch(grade) {
                        case 'A+': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        case 'A': return 'bg-blue-50 text-blue-700 border-blue-200'
                        case 'B': return 'bg-violet-50 text-violet-700 border-violet-200'
                        case 'C': return 'bg-amber-50 text-amber-700 border-amber-200'
                        case 'D': return 'bg-red-50 text-red-700 border-red-200'
                        default: return 'bg-gray-50 text-gray-700 border-gray-200'
                      }
                    }
                    
                    return (
                      <tr key={result.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
                        <td className="text-center text-xs font-medium p-4">
                          {(currentPage - 1) * RESULTS_PER_PAGE + index + 1}
                        </td>
                        <td className="p-4 text-sm font-mono font-medium">
                          {result.student_student_id}
                        </td>
                        <td className="p-4 text-sm font-medium">
                          {result.student_name}
                        </td>
                        <td className="p-4 text-sm">
                          <div className="truncate max-w-[200px]" title={result.exam_title}>
                            {result.exam_title}
                          </div>
                        </td>
                        <td className="p-4 text-sm">
                          {result.exam_subject_name}
                        </td>
                        <td className="p-4 text-sm text-center font-bold">
                          {result.total_marks_obtained}/{result.exam_total_marks}
                        </td>
                        <td className="p-4 text-sm text-center">
                          <Badge className={`${getGradeColor(grade)} text-xs font-bold px-3 py-1`}>
                            {grade}
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