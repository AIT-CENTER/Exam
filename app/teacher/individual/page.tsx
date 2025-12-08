"use client"

import type React from "react"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { toast } from "sonner"
import jsPDF from "jspdf"
import "jspdf-autotable"
import * as XLSX from "xlsx"
import { Search, ArrowLeft, X, Check, Download, FileText, FileSpreadsheet, FileIcon } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { getTeacherDataFromCookie } from "@/utils/teacherCookie"

const RESULTS_PER_PAGE = 10

interface ExamInfo {
  id: number
  title: string
  totalMarks: number
}

interface StudentResultRow {
  studentId: string
  studentDatabaseId: number
  fullName: string
  section: string
  gradeId: number
  examResults: { [examId: number]: { score: number; resultId: number } }
  totalScore: number
}

export default function ExamResultsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [teacherData, setTeacherData] = useState<any>(null)
  const [studentResults, setStudentResults] = useState<StudentResultRow[]>([])
  const [allExams, setAllExams] = useState<ExamInfo[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [sectionFilter, setSectionFilter] = useState("all")

  // Double-click edit state
  const [editingCell, setEditingCell] = useState<{ studentId: number; examId: number } | null>(null)
  const [editValue, setEditValue] = useState<number>(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const initializeAndFetch = async () => {
      try {
        const teacher = await getTeacherDataFromCookie()

        if (!teacher || !teacher.teacherId) {
          toast.error("Please login as teacher")
          router.push("/teacher/login")
          return
        }

        setTeacherData(teacher)
        await fetchExamResults(teacher.teacherId)

        const resultsSubscription = supabase
          .channel("results-channel")
          .on("postgres_changes", { event: "*", schema: "public", table: "results" }, () => {
            fetchExamResults(teacher.teacherId)
          })
          .subscribe()

        return () => {
          supabase.removeChannel(resultsSubscription)
        }
      } catch (error) {
        toast.error("Authentication error")
        router.push("/teacher/login")
      }
    }

    initializeAndFetch()
  }, [])

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  const fetchExamResults = async (teacherId: string) => {
    try {
      setLoading(true)

      const { data: teacherExams, error: examsError } = await supabase
        .from("exams")
        .select("id, title, total_marks, section")
        .eq("created_by", teacherId)
        .order("created_at", { ascending: true })

      if (examsError) throw examsError

      if (!teacherExams || teacherExams.length === 0) {
        setLoading(false)
        setAllExams([])
        setStudentResults([])
        return
      }

      const examIds = teacherExams.map((e) => e.id)
      const examInfoMap: { [key: number]: ExamInfo } = {}
      teacherExams.forEach((e) => {
        examInfoMap[e.id] = { id: e.id, title: e.title, totalMarks: e.total_marks }
      })

      const { data: resultsData, error: resultsError } = await supabase
        .from("results")
        .select(`
          id,
          student_id,
          exam_id,
          total_marks_obtained,
          students (id, student_id, name, father_name, grandfather_name, section, grade_id)
        `)
        .in("exam_id", examIds)

      if (resultsError) throw resultsError

      if (!resultsData || resultsData.length === 0) {
        setLoading(false)
        setAllExams(Object.values(examInfoMap))
        setStudentResults([])
        return
      }

      const studentMap: { [key: number]: StudentResultRow } = {}
      ;(resultsData || []).forEach((result: any) => {
        const student = result.students
        if (!student) return

        const studentDbId = student.id
        const fullName = `${student.name} ${student.father_name} ${student.grandfather_name}`.trim()

        if (!studentMap[studentDbId]) {
          studentMap[studentDbId] = {
            studentId: student.student_id,
            studentDatabaseId: studentDbId,
            fullName: fullName,
            section: student.section,
            gradeId: student.grade_id,
            examResults: {},
            totalScore: 0,
          }
        }

        studentMap[studentDbId].examResults[result.exam_id] = {
          score: result.total_marks_obtained,
          resultId: result.id,
        }
      })

      Object.values(studentMap).forEach((student) => {
        student.totalScore = Object.values(student.examResults).reduce((sum, exam) => sum + exam.score, 0)
      })

      const studentList = Object.values(studentMap).sort((a, b) => a.fullName.localeCompare(b.fullName))

      setAllExams(Object.values(examInfoMap))
      setStudentResults(studentList)
    } catch (error) {
      toast.error("Failed to load exam results")
    } finally {
      setLoading(false)
    }
  }

  const filteredResults = useMemo(() => {
    return studentResults.filter((r) => {
      const matchesSearch =
        r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.studentId.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesSection = sectionFilter === "all" || r.section === sectionFilter
      return matchesSearch && matchesSection
    })
  }, [studentResults, searchQuery, sectionFilter])

  const totalPages = Math.ceil(filteredResults.length / RESULTS_PER_PAGE)
  const paginatedResults = filteredResults.slice((currentPage - 1) * RESULTS_PER_PAGE, currentPage * RESULTS_PER_PAGE)

  const uniqueSections = useMemo(() => {
    return [...new Set(studentResults.map((r) => r.section))].sort()
  }, [studentResults])

  const totalPossibleMarks = useMemo(() => {
    return allExams.reduce((sum, exam) => sum + exam.totalMarks, 0)
  }, [allExams])

  const isStudentFailing = (student: StudentResultRow) => {
    if (totalPossibleMarks === 0) return false
    const percentage = (student.totalScore / totalPossibleMarks) * 100
    return percentage < 50
  }

  // Double-click to edit handler
  const handleDoubleClick = (studentId: number, examId: number, currentScore: number) => {
    setEditingCell({ studentId, examId })
    setEditValue(currentScore)
  }

  // Save edit handler
  const handleSaveEdit = async () => {
    if (!editingCell) return

    const student = studentResults.find((s) => s.studentDatabaseId === editingCell.studentId)
    if (!student) return

    const examResult = student.examResults[editingCell.examId]
    if (!examResult) return

    const exam = allExams.find((e) => e.id === editingCell.examId)
    if (!exam) return

    // Validate value
    const newValue = Math.max(0, Math.min(editValue, exam.totalMarks))

    try {
      const { error } = await supabase
        .from("results")
        .update({ total_marks_obtained: newValue })
        .eq("id", examResult.resultId)

      if (error) throw error

      toast.success("Score updated successfully")
      setEditingCell(null)

      if (teacherData?.teacherId) {
        await fetchExamResults(teacherData.teacherId)
      }
    } catch (error) {
      toast.error("Failed to update score")
    }
  }

  // Cancel edit handler
  const handleCancelEdit = () => {
    setEditingCell(null)
    setEditValue(0)
  }

  // Handle key press in edit input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit()
    } else if (e.key === "Escape") {
      handleCancelEdit()
    }
  }

  const exportToPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text("Exam Results Report", 105, 15, { align: "center" })
    doc.setFontSize(10)
    doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 25)

    const headers = ["#", "Student ID", "Full Name", "Section", ...allExams.map((e) => e.title), "Total"]
    const tableData = paginatedResults.map((r, idx) => [
      idx + 1,
      r.studentId,
      r.fullName,
      r.section,
      ...allExams.map((e) => r.examResults[e.id]?.score || 0),
      r.totalScore,
    ])
    ;(doc as any).autoTable({
      head: [headers],
      body: tableData,
      startY: 35,
    })

    doc.save("exam_results.pdf")
    toast.success("Exported to PDF")
  }

  const exportToExcel = () => {
    const data = paginatedResults.map((r, idx) => {
      const row: any = {
        "#": idx + 1,
        "Student ID": r.studentId,
        "Full Name": r.fullName,
        Section: r.section,
      }
      allExams.forEach((e) => {
        row[`${e.title} (${e.totalMarks})`] = r.examResults[e.id]?.score || 0
      })
      row["Total"] = r.totalScore
      return row
    })

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Results")
    XLSX.writeFile(wb, "exam_results.xlsx")
    toast.success("Exported to Excel")
  }

  const exportToWord = () => {
    let html = "<html><body><h1>Exam Results Report</h1>"
    html += "<table border='1' cellpadding='5'><tr>"
    html += "<th>#</th><th>Student ID</th><th>Full Name</th><th>Section</th>"
    allExams.forEach((e) => {
      html += `<th>${e.title} (${e.totalMarks})</th>`
    })
    html += "<th>Total</th></tr>"

    paginatedResults.forEach((r, idx) => {
      html += `<tr><td>${idx + 1}</td><td>${r.studentId}</td><td>${r.fullName}</td><td>${r.section}</td>`
      allExams.forEach((e) => {
        html += `<td>${r.examResults[e.id]?.score || 0}</td>`
      })
      html += `<td><strong>${r.totalScore}</strong></td></tr>`
    })
    html += "</table></body></html>"

    const blob = new Blob([html], { type: "application/msword" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "exam_results.doc"
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
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Skeleton className="h-10 flex-1 max-w-md bg-gray-200 rounded animate-pulse" />
          <Skeleton className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
        </div>
        <Card>
          <div className="p-4 md:p-6 space-y-4">
            {[...Array(5)].map((_, rowIndex) => (
              <div key={rowIndex} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-8 bg-gray-200 rounded animate-pulse" />
                <Skeleton className="h-4 flex-1 bg-gray-200 rounded animate-pulse" />
                <Skeleton className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Exam Results</h1>
          <p className="text-muted-foreground mt-1 text-sm">View and manage student exam performance (double-click to edit)</p>
        </div>
        <Button variant="outline" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Filters */}
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
        <Select value={sectionFilter} onValueChange={setSectionFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sections</SelectItem>
            {uniqueSections.map((s) => (
              <SelectItem key={s} value={s}>
                Section {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 bg-transparent">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportToPDF} className="gap-2">
              <FileText className="h-4 w-4" />
              Export as PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToExcel} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Export as Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToWord} className="gap-2">
              <FileIcon className="h-4 w-4" />
              Export as Word
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Results Table with fixed columns and scrollable exams */}
      {filteredResults.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-muted-foreground">No exam results found</div>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden border shadow-sm">
            <div className="relative">
              <div className="overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-20 bg-gray-50">
                    <tr>
                      {/* Fixed columns - # only */}
                      <th className="sticky left-0 z-30 bg-gray-50 w-12 text-xs font-medium text-center p-3 border border-gray-200">
                        #
                      </th>
                      {/* Scrollable columns */}
                      <th className="min-w-[200px] text-xs font-medium text-left p-3 border border-gray-200 bg-gray-50">
                        Full Name
                      </th>
                      <th className="min-w-[100px] text-xs font-medium text-left p-3 border border-gray-200 bg-gray-50">
                        Section
                      </th>
                      {/* Exam columns */}
                      {allExams.map((exam) => (
                        <th
                          key={exam.id}
                          className="min-w-[120px] text-xs font-medium text-center p-3 border border-gray-200 bg-gray-50"
                        >
                          <div className="truncate max-w-[120px]" title={exam.title}>
                            {exam.title} ({exam.totalMarks})
                          </div>
                        </th>
                      ))}
                      <th className="min-w-[80px] text-xs font-medium text-center p-3 border border-gray-200 bg-gray-50">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResults.map((student, idx) => {
                      const isFailing = isStudentFailing(student)
                      return (
                        <tr key={student.studentDatabaseId} className={isFailing ? "bg-red-50" : "hover:bg-gray-50/50"}>
                          {/* Fixed column - # only */}
                          <td className="sticky left-0 z-10 bg-white text-xs font-medium text-center p-3 border border-gray-200">
                            {(currentPage - 1) * RESULTS_PER_PAGE + idx + 1}
                          </td>
                          
                          {/* Scrollable columns */}
                          <td className="bg-white p-3 border border-gray-200">
                            <div className="font-medium text-sm truncate max-w-[180px]" title={student.fullName}>
                              {student.fullName}
                            </div>
                          </td>
                          
                          <td className="bg-white p-3 border border-gray-200">
                            <Badge variant="outline" className="text-xs">
                              {student.section}
                            </Badge>
                          </td>

                          {/* Exam score columns */}
                          {allExams.map((exam) => {
                            const examResult = student.examResults[exam.id]
                            const currentScore = examResult?.score ?? null
                            const isEditing =
                              editingCell?.studentId === student.studentDatabaseId && editingCell?.examId === exam.id

                            return (
                              <td
                                key={exam.id}
                                className="text-center p-2 border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                                onDoubleClick={() =>
                                  currentScore !== null &&
                                  handleDoubleClick(student.studentDatabaseId, exam.id, currentScore)
                                }
                              >
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <Input
                                      ref={inputRef}
                                      type="number"
                                      value={editValue}
                                      onChange={(e) => setEditValue(Number.parseInt(e.target.value) || 0)}
                                      onKeyDown={handleKeyDown}
                                      className="w-16 h-7 text-center text-sm"
                                      min={0}
                                      max={exam.totalMarks}
                                    />
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSaveEdit}>
                                      <Check className="h-3 w-3 text-green-600" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={handleCancelEdit}
                                    >
                                      <X className="h-3 w-3 text-red-600" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span>{currentScore !== null ? `${currentScore}/${exam.totalMarks}` : "--"}</span>
                                )}
                              </td>
                            )
                          })}
                          
                          <td className="text-center p-3 border border-gray-200 text-sm font-bold text-primary bg-white">
                            {student.totalScore}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Showing {(currentPage - 1) * RESULTS_PER_PAGE + 1} to{" "}
                {Math.min(currentPage * RESULTS_PER_PAGE, filteredResults.length)} of {filteredResults.length} students
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
                  <span className="sr-only">Previous</span>
                  <ArrowLeft className="h-4 w-4" />
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
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <span className="sr-only">Next</span>
                  <ArrowLeft className="h-4 w-4 rotate-180" />
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