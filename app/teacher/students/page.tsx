"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import jsPDF from "jspdf"
import * as XLSX from "xlsx"
import { format } from "date-fns"

import { Search, ChevronLeft, ChevronRight, Users, Download, FileSpreadsheet, FileIcon } from "lucide-react"
import { getTeacherDataFromCookie } from "@/utils/teacherCookie"
import { supabase } from "@/lib/supabaseClient"

const STUDENTS_PER_PAGE = 10

interface Student {
  id: string
  student_id: string
  name: string
  father_name: string
  grandfather_name: string
  section: string
  gender: string
  grade_id: number
  stream?: string
  grades?: {
    grade_name: string
  }
}

const getGradeLevel = (gradeName: string | undefined): number => {
  if (!gradeName) return 0
  const gradeNum = Number.parseInt(gradeName.replace(/\D/g, ""))
  return gradeNum
}

const isHigherGrade = (gradeName: string | undefined): boolean => {
  const gradeLevel = getGradeLevel(gradeName)
  return gradeLevel >= 11
}

const getDepartmentStream = (department: string | undefined): string => {
  if (!department) return "Common"
  
  if (department.includes('Science') || 
      department.includes('Engineering') ||
      department.includes('Technology')) {
    return 'Natural'
  } else if (department.includes('Social') || 
             department.includes('Business') ||
             department.includes('Arts')) {
    return 'Social'
  }
  return 'Common'
}

export default function StudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sectionFilter, setSectionFilter] = useState("all")
  const [streamFilter, setStreamFilter] = useState("all")
  const [genderFilter, setGenderFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [teacherData, setTeacherData] = useState<any>(null)

  useEffect(() => {
    const loadStudentsData = async () => {
      try {
        const teacher = await getTeacherDataFromCookie()

        if (!teacher) {
          router.push("/teacher/login")
          return
        }

        setTeacherData(teacher)

        let query = supabase
          .from("students")
          .select(`
            *,
            grades!students_grade_id_fkey (
              grade_name
            )
          `)
          .order("name")

        if (teacher.gradeId && teacher.sections && teacher.sections.length > 0) {
          query = query.eq("grade_id", teacher.gradeId).in("section", teacher.sections)
        }

        const { data: studentsData, error } = await query

        if (error) {
          toast.error("Failed to load students data")
          return
        }

        let filteredStudents = studentsData || []

        // Filter students based on grade level and teacher department
        const gradeLevel = getGradeLevel(teacher.gradeName)
        
        if (gradeLevel >= 11) {
          // Grades 11-12: Department-based filtering
          if (teacher.department) {
            const teacherStream = getDepartmentStream(teacher.department)
            
            if (teacherStream === 'Natural') {
              filteredStudents = filteredStudents.filter((student: Student) => 
                student.stream === 'Natural' || !student.stream
              )
            } else if (teacherStream === 'Social') {
              filteredStudents = filteredStudents.filter((student: Student) => 
                student.stream === 'Social' || !student.stream
              )
            }
            // If Common, show all students
          }
        } else {
          // Grades 9-10: Stream-based filtering
          if (teacher.department) {
            const teacherStream = getDepartmentStream(teacher.department)
            
            if (teacherStream) {
              filteredStudents = filteredStudents.filter((student: Student) => 
                student.stream === teacherStream
              )
            }
          }
        }

        setStudents(filteredStudents)
      } catch (error) {
        toast.error("Failed to load students data")
      } finally {
        setIsLoading(false)
      }
    }

    loadStudentsData()
  }, [router])

  const stats = useMemo(() => {
    const total = students.length
    const maleCount = students.filter((s) => s.gender === "male").length
    const femaleCount = students.filter((s) => s.gender === "female").length
    const otherCount = students.filter((s) => s.gender === "other").length

    return [
      { title: "Total Students", value: total, icon: Users },
      { title: "Male Students", value: maleCount, icon: Users },
      { title: "Female Students", value: femaleCount, icon: Users },
      { title: "Other", value: otherCount, icon: Users },
    ]
  }, [students])

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Search filter
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${s.name} ${s.father_name} ${s.grandfather_name}`.toLowerCase().includes(searchQuery.toLowerCase())

      // Section filter
      const matchesSection = sectionFilter === "all" || s.section === sectionFilter

      // Stream filter
      const matchesStream = streamFilter === "all" || s.stream === streamFilter

      // Gender filter
      const matchesGender = genderFilter === "all" || s.gender === genderFilter

      return matchesSearch && matchesSection && matchesStream && matchesGender
    })
  }, [students, searchQuery, sectionFilter, streamFilter, genderFilter])

  const teacherSections = useMemo(() => {
    return teacherData?.sections || []
  }, [teacherData])

  // Available streams in the filtered students
  const availableStreams = useMemo(() => {
    const streams = [...new Set(students.map((s) => s.stream).filter(Boolean))] as string[]
    return streams.sort()
  }, [students])

  const sectionOptions = useMemo(() => {
    const sections = [...new Set(students.map((s) => s.section))]
      .filter((section) => teacherSections.includes(section))
      .sort()
    return sections
  }, [students, teacherSections])

  const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE)
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * STUDENTS_PER_PAGE,
    currentPage * STUDENTS_PER_PAGE,
  )

  const exportToPDF = () => {
    if (filteredStudents.length === 0) {
      toast.error("No students to export")
      return
    }

    try {
      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.text("Students List", 14, 20)
      doc.setFontSize(12)
      doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 30)
      doc.text(`Total Records: ${filteredStudents.length}`, 14, 38)
      doc.text(`Grade: ${teacherData?.gradeName || "N/A"}`, 14, 46)
      doc.text(`Sections: ${teacherSections.join(", ")}`, 14, 54)
      
      const gradeLevel = getGradeLevel(teacherData?.gradeName)
      if (gradeLevel >= 11 && teacherData?.department) {
        doc.text(`Department: ${teacherData.department}`, 14, 62)
      } else if (teacherData?.department) {
        // For lower grades, show stream based on department
        const stream = getDepartmentStream(teacherData.department)
        doc.text(`Stream: ${stream}`, 14, 62)
      }

      let y = (gradeLevel >= 11 && teacherData?.department) ? 70 : 62
      const header = ["#", "Student ID", "Full Name", "Section", "Stream", "Gender"]
      doc.setFillColor(79, 70, 229)
      doc.rect(14, y, 190, 8, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(10)
      // Adjust column widths
      const columnPositions = [14, 30, 60, 110, 140, 170]
      header.forEach((h, i) => doc.text(h, columnPositions[i], y + 5))
      y += 8

      filteredStudents.forEach((s, i) => {
        const fullName = `${s.name} ${s.father_name} ${s.grandfather_name}`
        const row = [
          (i + 1).toString(),
          s.student_id,
          fullName,
          s.section,
          s.stream || "N/A",
          s.gender.charAt(0).toUpperCase() + s.gender.slice(1)
        ]
        if (i % 2 === 0) doc.setFillColor(248, 250, 252)
        else doc.setFillColor(255, 255, 255)
        doc.rect(14, y, 190, 6, "F")
        doc.setTextColor(0, 0, 0)
        row.forEach((cell, j) => doc.text(cell, columnPositions[j], y + 4))
        y += 6
        if (y > 280) {
          doc.addPage()
          y = 20
        }
      })

      doc.save("students_list.pdf")
      toast.success("Exported to PDF successfully")
    } catch (error) {
      console.error("PDF export error:", error)
      toast.error("Failed to export to PDF")
    }
  }

  const exportToExcel = () => {
    if (filteredStudents.length === 0) {
      toast.error("No students to export")
      return
    }

    try {
      const data = filteredStudents.map((s, index) => {
        return {
          "#": index + 1,
          "Student ID": s.student_id,
          "Full Name": `${s.name} ${s.father_name} ${s.grandfather_name}`,
          "Section": s.section,
          "Stream": s.stream || "N/A",
          "Gender": s.gender.charAt(0).toUpperCase() + s.gender.slice(1),
          "Grade": s.grades?.grade_name || "N/A",
        }
      })

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Students")
      XLSX.writeFile(wb, `students_${format(new Date(), "yyyy-MM-dd")}.xlsx`)
      toast.success("Exported to Excel successfully")
    } catch (error) {
      console.error("Excel export error:", error)
      toast.error("Failed to export to Excel")
    }
  }

  const exportToWord = () => {
    if (filteredStudents.length === 0) {
      toast.error("No students to export")
      return
    }

    try {
      const gradeLevel = getGradeLevel(teacherData?.gradeName)
      const tableHeader =
        '<table border="1" style="border-collapse: collapse; width:100%;"><tr style="background-color: #4F46E5; color: white;"><th>#</th><th>Student ID</th><th>Full Name</th><th>Section</th><th>Stream</th><th>Gender</th><th>Grade</th></tr>'
      const tableBody = filteredStudents
        .map((s, i) => {
          const fullName = `${s.name} ${s.father_name} ${s.grandfather_name}`
          return `<tr style="${i % 2 === 0 ? "background-color: #F8FAFC;" : ""}">
          <td>${i + 1}</td>
          <td>${s.student_id}</td>
          <td>${fullName}</td>
          <td>${s.section}</td>
          <td>${s.stream || "N/A"}</td>
          <td>${s.gender.charAt(0).toUpperCase() + s.gender.slice(1)}</td>
          <td>${s.grades?.grade_name || "N/A"}</td>
        </tr>`
        })
        .join("")

      const tableFooter = "</table>"
      const departmentInfo = teacherData?.department ? 
        `<p>${gradeLevel >= 11 ? 'Department' : 'Stream'}: ${teacherData.department} (${getDepartmentStream(teacherData.department)})</p>` : ""
      const content = `<html><body>
        <h1>Students List</h1>
        <p>Generated: ${format(new Date(), "PPP")}</p>
        <p>Total: ${filteredStudents.length}</p>
        <p>Grade: ${teacherData?.gradeName || "N/A"}</p>
        <p>Sections: ${teacherSections.join(", ")}</p>
        ${departmentInfo}
        ${tableHeader}${tableBody}${tableFooter}
      </body></html>`
      const blob = new Blob([content], { type: "application/msword" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `students_${format(new Date(), "yyyy-MM-dd")}.doc`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Exported to Word successfully")
    } catch (error) {
      console.error("Word export error:", error)
      toast.error("Failed to export to Word")
    }
  }

  if (isLoading) {
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

  const gradeLevel = getGradeLevel(teacherData?.gradeName)
  const teacherStream = getDepartmentStream(teacherData?.department)

  return (
    <div className="flex-1 space-y-8 bg-transparent p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Assigned Students</h1>
          <p className="text-muted-foreground mt-1">
            {teacherData?.gradeName && teacherSections.length > 0 ? (
              <>
                Students in {teacherData.gradeName} - Your Sections: {teacherSections.join(", ")}
                {teacherData?.department && (
                  <>
                    <Badge variant="outline" className="ml-2">
                      {gradeLevel >= 11 
                        ? `${teacherData.department} Department` 
                        : `${teacherStream} Stream`}
                    </Badge>
                  </>
                )}
              </>
            ) : (
              "List of assigned students with detailed information"
            )}
          </p>
        </div>
      </div>

      {/* Stats - Now showing 4 cards with Other gender */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by student ID, name, or full name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Section Filter */}
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {sectionOptions.map((section) => (
                <SelectItem key={section} value={section}>
                  Section {section}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Stream Filter - Only show if streams are available */}
          {availableStreams.length > 0 && (
            <Select value={streamFilter} onValueChange={setStreamFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Streams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Streams</SelectItem>
                {availableStreams.map((stream) => (
                  <SelectItem key={stream} value={stream}>
                    {stream}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Gender Filter */}
          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Genders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genders</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={exportToPDF}>
                <FileIcon className="mr-2 h-4 w-4" /> PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportToExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportToWord}>
                <FileIcon className="mr-2 h-4 w-4" /> Word
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Active Filters */}
        <div className="flex flex-wrap gap-2">
          {sectionFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Section: {sectionFilter}
              <button
                onClick={() => setSectionFilter("all")}
                className="ml-1 hover:text-red-500"
              >
                ×
              </button>
            </Badge>
          )}
          {streamFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Stream: {streamFilter}
              <button
                onClick={() => setStreamFilter("all")}
                className="ml-1 hover:text-red-500"
              >
                ×
              </button>
            </Badge>
          )}
          {genderFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Gender: {genderFilter}
              <button
                onClick={() => setGenderFilter("all")}
                className="ml-1 hover:text-red-500"
              >
                ×
              </button>
            </Badge>
          )}
        </div>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="border-b dark:border-zinc-800">
                <TableHead className="text-muted-foreground">#</TableHead>
                <TableHead className="text-muted-foreground">Student ID</TableHead>
                <TableHead className="text-muted-foreground">Full Name</TableHead>
                <TableHead className="text-muted-foreground">Section</TableHead>
                <TableHead className="text-muted-foreground">Stream</TableHead>
                <TableHead className="text-muted-foreground">Gender</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {students.length === 0
                      ? teacherData?.gradeId
                        ? "No students found in your assigned sections."
                        : "You are not assigned to any classes yet."
                      : "No students match your search criteria."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedStudents.map((student, index) => (
                  <TableRow key={student.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <TableCell className="font-medium text-foreground">{(currentPage - 1) * STUDENTS_PER_PAGE + index + 1}</TableCell>
                    <TableCell className="font-medium text-foreground">{student.student_id}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {student.name} {student.father_name} {student.grandfather_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800">
                        {student.section}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {student.stream ? (
                        <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                          {student.stream}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          student.gender === "male" ? "default" : 
                          student.gender === "female" ? "secondary" : 
                          "outline"
                        }
                        className={
                          student.gender === "male" ? "" :
                          student.gender === "female" ? "bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/40" :
                          "bg-gray-100 text-gray-800 border-gray-300 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                        }
                      >
                        {student.gender.charAt(0).toUpperCase() + student.gender.slice(1)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * STUDENTS_PER_PAGE + 1} to{" "}
              {Math.min(currentPage * STUDENTS_PER_PAGE, filteredStudents.length)} of {filteredStudents.length} students
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}