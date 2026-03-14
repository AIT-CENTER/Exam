"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  UserPlus,
  Edit,
  Trash2,
  Key,
  Users,
  Search,
  MoreHorizontal,
  Settings,
  Eye,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import bcrypt from "bcryptjs"

const USERS_PER_PAGE = 10

interface Grade {
  id: string
  name: string
}

interface Subject {
  id: string
  name: string
  stream: string | null
}

interface Section {
  id: string
  name: string
  stream: string | null
}

interface Teacher {
  id: string
  user_id: string
  username: string
  fullName: string
  email: string
  phone: string
  role: string
  stream: string
  assignedGrade: string
  assignedSubject: string
  assignedSections: string[]
  created_at: string
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

export default function TeacherManagementPage() {
  const router = useRouter()
  const [users, setUsers] = useState<Teacher[]>([])
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  // grade_id -> stream -> subject_ids (stream: Common | Natural | Social)
  const [gradeSubjects, setGradeSubjects] = useState<Record<string, Record<string, string[]>>>({})
  // grade_id -> sections (each section has stream for G11/12)
  const [gradeSections, setGradeSections] = useState<Record<string, Section[]>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<Teacher | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ username: "", fullName: "", email: "", phone: "", password: "" })
  const [editForm, setEditForm] = useState({ username: "", fullName: "", email: "", phone: "" })
  const [assignForm, setAssignForm] = useState({
    stream: "",
    assignedGrade: "",
    assignedSubject: "", // Single subject instead of array
    assignedSections: [] as string[],
  })
  const [resetPasswordForm, setResetPasswordForm] = useState({ newPassword: "", confirmPassword: "" })
  const [loading, setLoading] = useState(true)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)
  const [canCreateTeacher, setCanCreateTeacher] = useState(true)

  const handleInputChange = (formSetter: any, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    formSetter((prev: any) => ({ ...prev, [name]: value }))
  }

  const safeFormatDate = (dateString: string | null, pattern = "MMM dd, yyyy HH:mm") => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "Invalid Date"
    return format(date, pattern)
  }

  const hashPassword = async (password: string) => {
    const saltRounds = 12
    return await bcrypt.hash(password, saltRounds)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: teachersData, error: teachersError } = await supabase.from("teacher").select("*")
      if (teachersError) throw teachersError

      const { data: gradesData, error: gradesError } = await supabase.from("grades").select("id, grade_name")
      if (gradesError) throw gradesError

      const { data: subjectsData, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, subject_name, stream")
      if (subjectsError) throw subjectsError

      const { data: gradeSubjectsData, error: gradeSubjectsError } = await supabase
        .from("grade_subjects")
        .select("grade_id, subject_id, stream")
      if (gradeSubjectsError) {
        console.warn("grade_subjects table may not exist yet")
      }

      const { data: sectionsData, error: sectionsError } = await supabase
        .from("grade_sections")
        .select("id, grade_id, section_name, stream")
      if (sectionsError) {
        console.warn("grade_sections table may not exist yet")
      }

      const processedTeachers = (teachersData || []).map((u: any) => ({
        id: u.id,
        user_id: u.id.slice(0, 8).toUpperCase(),
        username: u.username,
        fullName: u.full_name,
        email: u.email,
        phone: u.phone_number || "",
        role: "Teacher",
        stream: u.stream || "",
        assignedGrade: u.grade_id ? u.grade_id.toString() : "",
        assignedSubject: u.subject_id ? u.subject_id.toString() : "",
        assignedSections: u.section ? u.section.split(",").filter(Boolean) : [],
        created_at: u.created_at,
      }))

      setUsers(processedTeachers)
      setAllTeachers(processedTeachers)
      setGrades((gradesData || []).map((g: any) => ({ id: g.id.toString(), name: g.grade_name })))
      setSubjects(
        (subjectsData || []).map((s: any) => ({ id: s.id.toString(), name: s.subject_name, stream: s.stream })),
      )

      const subjectsByGradeAndStream: Record<string, Record<string, string[]>> = {}
      if (gradeSubjectsData) {
        gradeSubjectsData.forEach((gs: any) => {
          const gradeId = gs.grade_id.toString()
          const stream = gs.stream ?? "Common"
          if (!subjectsByGradeAndStream[gradeId]) {
            subjectsByGradeAndStream[gradeId] = { Common: [], Natural: [], Social: [] }
          }
          if (!subjectsByGradeAndStream[gradeId][stream]) {
            subjectsByGradeAndStream[gradeId][stream] = []
          }
          subjectsByGradeAndStream[gradeId][stream].push(gs.subject_id.toString())
        })
      }
      setGradeSubjects(subjectsByGradeAndStream)

      const sectionsByGrade: Record<string, Section[]> = {}
      if (sectionsData) {
        sectionsData.forEach((s: any) => {
          const gradeId = s.grade_id.toString()
          if (!sectionsByGrade[gradeId]) {
            sectionsByGrade[gradeId] = []
          }
          sectionsByGrade[gradeId].push({
            id: `${s.section_name}-${s.stream ?? ""}`,
            name: s.section_name,
            stream: s.stream ?? null,
          })
        })
      }
      if (Object.keys(sectionsByGrade).length === 0) {
        gradesData?.forEach((g: any) => {
          sectionsByGrade[g.id.toString()] = ["A", "B", "C", "D", "E"].map((sec) => ({
            id: sec,
            name: sec,
            stream: null,
          }))
        })
      }
      setGradeSections(sectionsByGrade)
    } catch (error) {
      console.error("Load data error:", error)
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    ;(async () => {
      try {
        const res = await fetch("/api/admin/page-permissions", { cache: "no-store" })
        if (res.ok) {
          const json = await res.json()
          const role = json.role as "super_admin" | "admin" | undefined
          // Hard-lock teacher creation for Admin role; other roles can create
          if (role === "admin") {
            setCanCreateTeacher(false)
          } else {
            setCanCreateTeacher(true)
          }
        }
      } catch {
        setCanCreateTeacher(true)
      }
    })()
  }, [])

  const isStreamedGradeName = (gradeName: string) =>
    gradeName.includes("11") || gradeName.includes("12")

  const filteredSubjectsByStreamAndGrade = useMemo(() => {
    if (!assignForm.stream || !assignForm.assignedGrade) return []
    const byStream = gradeSubjects[assignForm.assignedGrade] || { Common: [], Natural: [], Social: [] }
    const streamIds = byStream[assignForm.stream] || []
    const commonIds = byStream.Common || []
    const allowedIds = new Set([...streamIds, ...commonIds])
    return subjects.filter((s) => allowedIds.has(s.id))
  }, [subjects, assignForm.stream, assignForm.assignedGrade, gradeSubjects])

  const availableSections = useMemo(() => {
    if (!assignForm.assignedGrade) return []
    const grade = grades.find((g) => g.id === assignForm.assignedGrade)
    const list = gradeSections[assignForm.assignedGrade] || []
    if (grade && isStreamedGradeName(grade.name) && assignForm.stream) {
      return list.filter((s) => s.stream === assignForm.stream)
    }
    return list.filter((s) => s.stream == null)
  }, [assignForm.assignedGrade, assignForm.stream, gradeSections, grades])

  // すでに割り当てられている科目とセクションの組み合わせをチェック
  const getAssignedSubjectsForGradeAndSections = useMemo(() => {
    if (!assignForm.assignedGrade || assignForm.assignedSections.length === 0) return new Set<string>()

    const assigned = new Set<string>()
    allTeachers.forEach((teacher) => {
      // 編集中の現在のユーザーをスキップ
      if (selectedUser && teacher.id === selectedUser.id) return

      // 同じグレードに割り当てられているかチェック
      if (teacher.assignedGrade === assignForm.assignedGrade && teacher.assignedSubject) {
        // セクションの重複があるかチェック
        const hasOverlap = teacher.assignedSections.some((section) => 
          assignForm.assignedSections.includes(section)
        )
        if (hasOverlap) {
          assigned.add(teacher.assignedSubject)
        }
      }
    })
    return assigned
  }, [allTeachers, assignForm.assignedGrade, assignForm.assignedSections, selectedUser])

  const stats = useMemo(() => {
    const total = users.length
    const assigned = users.filter((u) => u.assignedSubject).length
    const unassigned = total - assigned
    return [
      { title: "Total Teachers", value: total, icon: Users },
      { title: "Assigned", value: assigned, icon: Users },
      { title: "Unassigned", value: unassigned, icon: Users },
    ]
  }, [users])

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.phone.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSearch
    })
  }, [users, searchQuery])

  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE)
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * USERS_PER_PAGE, currentPage * USERS_PER_PAGE)

  const handleCreateUser = async () => {
    if (!newUserForm.username || !newUserForm.fullName || !newUserForm.phone || !newUserForm.password) {
      toast.error("All fields are required")
      return
    }
    let email = newUserForm.email?.trim()
    if (!email) {
      email = `${newUserForm.phone.replace(/[^0-9]/g, "")}@jalqabeen.local`
    }
    try {
      const hashedPassword = await hashPassword(newUserForm.password)

      const { error: profileError } = await supabase.from("teacher").insert({
        username: newUserForm.username,
        full_name: newUserForm.fullName,
        email: email,
        phone_number: newUserForm.phone,
        password: hashedPassword,
        grade_id: null,
        subject_id: null,
        section: null,
        stream: null,
      })

      if (profileError) {
        toast.error(profileError.message || "Profile creation failed")
        return
      }

      toast.success(`Teacher created! Email: ${email}, Phone: ${newUserForm.phone}`)
      setIsCreateOpen(false)
      setNewUserForm({ username: "", fullName: "", email: "", phone: "", password: "" })
      loadData()
    } catch (error) {
      console.error("Create user error:", error)
      toast.error("Failed to create teacher")
    }
  }

  const handleEditUser = async () => {
    if (!editForm.username || !editForm.fullName || !editForm.phone) {
      toast.error("All fields are required")
      return
    }
    let email = editForm.email?.trim()
    if (!email) {
      email = `${editForm.phone.replace(/[^0-9]/g, "")}@jalqabeen.local`
    }
    try {
      const { error } = await supabase
        .from("teacher")
        .update({
          username: editForm.username,
          full_name: editForm.fullName,
          email: email,
          phone_number: editForm.phone,
        })
        .eq("id", selectedUser?.id)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success("Teacher updated")
      setIsEditOpen(false)
      loadData()
    } catch (error) {
      console.error("Edit user error:", error)
      toast.error("Failed to update teacher")
    }
  }

  const handleAssignUser = async () => {
    if (!assignForm.assignedGrade) {
      toast.error("Please select a grade")
      return
    }
    const grade = grades.find((g) => g.id === assignForm.assignedGrade)
    if (grade && isStreamedGradeName(grade.name) && !assignForm.stream) {
      toast.error("For Grade 11 and 12, please select a stream (Natural or Social)")
      return
    }
    if (assignForm.assignedSections.length === 0) {
      toast.error("Please select at least one section")
      return
    }
    if (!assignForm.assignedSubject) {
      toast.error("Please select a subject")
      return
    }

    const isAlreadyAssigned = Array.from(getAssignedSubjectsForGradeAndSections).some(
      (subjectId) => subjectId === assignForm.assignedSubject
    )
    if (isAlreadyAssigned) {
      toast.error("This subject is already assigned to another teacher for the selected sections")
      return
    }

    try {
      const { error } = await supabase
        .from("teacher")
        .update({
          stream: assignForm.stream || null,
          grade_id: Number.parseInt(assignForm.assignedGrade),
          subject_id: Number.parseInt(assignForm.assignedSubject),
          section: assignForm.assignedSections.join(","),
        })
        .eq("id", selectedUser?.id)
      if (error) {
        toast.error("Failed to assign: " + error.message)
        return
      }
      toast.success("Assignment updated successfully")
      setIsAssignOpen(false)
      setAssignmentError(null)
      loadData()
    } catch (error) {
      console.error("Assign error:", error)
      toast.error("Failed to update assignment")
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    try {
      const { error } = await supabase.from("teacher").delete().eq("id", selectedUser.id)
      if (error) throw error
      toast.success("Teacher deleted successfully")
      setIsDeleteOpen(false)
      loadData()
    } catch (error) {
      console.error("Delete user error:", error)
      toast.error("Failed to delete teacher")
    }
  }

  const handleResetPassword = async () => {
    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      toast.error("Passwords do not match")
      return
    }
    if (resetPasswordForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }
    try {
      const hashedPassword = await hashPassword(resetPasswordForm.newPassword)

      const { error } = await supabase.from("teacher").update({ password: hashedPassword }).eq("id", selectedUser?.id)
      if (error) throw error
      toast.success("Password reset successfully")
      setIsResetPasswordOpen(false)
      setResetPasswordForm({ newPassword: "", confirmPassword: "" })
    } catch (error) {
      console.error("Reset password error:", error)
      toast.error("Failed to reset password")
    }
  }

  const openCreate = () => {
    setNewUserForm({ username: "", fullName: "", email: "", phone: "", password: "" })
    setIsCreateOpen(true)
  }

  const openEdit = (user: Teacher) => {
    setSelectedUser(user)
    setEditForm({
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
    })
    setIsEditOpen(true)
  }

  const openAssign = (user: Teacher) => {
    setSelectedUser(user)
    setAssignForm({
      stream: user.stream || "",
      assignedGrade: user.assignedGrade || "",
      assignedSubject: user.assignedSubject || "",
      assignedSections: user.assignedSections || [],
    })
    setAssignmentError(null)
    setIsAssignOpen(true)
  }

  const openDelete = (user: Teacher) => {
    setSelectedUser(user)
    setIsDeleteOpen(true)
  }

  const openResetPassword = (user: Teacher) => {
    setSelectedUser(user)
    setResetPasswordForm({ newPassword: "", confirmPassword: "" })
    setIsResetPasswordOpen(true)
  }

  const openDetail = (user: Teacher) => {
    setSelectedUser(user)
    setIsDetailOpen(true)
  }

  const getAssignmentNames = (id: string | string[], items: { id: string; name: string }[], isArray = false) => {
    if (!id) return "None"
    if (isArray && Array.isArray(id)) {
      return id.map((itemId) => items.find((item) => item.id === itemId)?.name || itemId).join(", ")
    }
    return items.find((item) => item.id === id)?.name || id
  }

  // Truncate long text with ellipsis
  const truncateText = (text: string, maxLength: number = 25) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  if (loading) {
    return <PageSpinner />
  }

  return (
    <div className="flex-1 space-y-8 p-4 lg:p-8 bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Teacher Management</h1>
        </div>
        <Button onClick={openCreate} className="gap-2" disabled={!canCreateTeacher}>
          <UserPlus className="h-4 w-4" />
          {canCreateTeacher ? "Create Teacher" : "Create Teacher (locked)"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="shadow-sm hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
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
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, email, phone, or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Table */}
        <Card className="shadow-sm border border-muted/60">
          <div className="rounded-lg border border-muted/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Username</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Stream</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No teachers found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user, index) => (
                    <TableRow
                      key={user.id}
                      className={index % 2 === 0 ? "bg-muted/20" : ""}
                    >

                    <TableCell title={user.username}>{truncateText(user.username)}</TableCell>
                    <TableCell title={user.fullName}>{truncateText(user.fullName)}</TableCell>
                    <TableCell title={user.email}>{truncateText(user.email)}</TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell>
                      {user.stream ? (
                        <Badge variant={user.stream === "Natural" ? "default" : "secondary"}>{user.stream}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" title={getAssignmentNames(user.assignedSubject, subjects) || "Unassigned"}>
                        {truncateText(getAssignmentNames(user.assignedSubject, subjects) || "Unassigned", 15)}
                      </Badge>
                    </TableCell>
                    <TableCell>{safeFormatDate(user.created_at, "MMM dd, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openDetail(user)}>
                            <Eye className="mr-2 h-4 w-4" /> View Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAssign(user)}>
                            <Settings className="mr-2 h-4 w-4" /> Assign
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openResetPassword(user)}>
                            <Key className="mr-2 h-4 w-4" /> Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openDelete(user)} className="text-red-600 focus:bg-red-50 dark:focus:bg-red-950">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * USERS_PER_PAGE + 1} to{" "}
              {Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} teachers
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-md border px-3 py-1 text-sm bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                Prev
              </button>
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="inline-flex items-center rounded-md border px-3 py-1 text-sm bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Teacher</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                value={newUserForm.username}
                onChange={(e) => handleInputChange(setNewUserForm, e)}
                placeholder="Enter username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                name="fullName"
                value={newUserForm.fullName}
                onChange={(e) => handleInputChange(setNewUserForm, e)}
                placeholder="Enter full name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={newUserForm.email}
                onChange={(e) => handleInputChange(setNewUserForm, e)}
                placeholder="Enter email (optional)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="09xxxxxxxx"
                value={newUserForm.phone}
                onChange={(e) => handleInputChange(setNewUserForm, e)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={newUserForm.password}
                onChange={(e) => handleInputChange(setNewUserForm, e)}
                placeholder="Enter password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                value={editForm.username}
                onChange={(e) => handleInputChange(setEditForm, e)}
                placeholder="Enter username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                name="fullName"
                value={editForm.fullName}
                onChange={(e) => handleInputChange(setEditForm, e)}
                placeholder="Enter full name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={editForm.email}
                onChange={(e) => handleInputChange(setEditForm, e)}
                placeholder="Enter email (optional)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="09xxxxxxxx"
                value={editForm.phone}
                onChange={(e) => handleInputChange(setEditForm, e)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to {selectedUser?.fullName}</DialogTitle>
            <DialogDescription>
              Select grade first. For Grade 11 or 12, choose stream (Natural/Social); sections and subjects are then filtered by grade and stream.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Grade Selection first */}
            <div className="grid gap-2">
              <Label>Grade *</Label>
              <Select
                value={assignForm.assignedGrade}
                onValueChange={(value) =>
                  setAssignForm((prev) => ({
                    ...prev,
                    assignedGrade: value,
                    stream: "",
                    assignedSections: [],
                    assignedSubject: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((grade) => (
                    <SelectItem key={grade.id} value={grade.id}>
                      {grade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stream - required only for Grade 11 and 12 */}
            {assignForm.assignedGrade && (() => {
              const grade = grades.find((g) => g.id === assignForm.assignedGrade)
              return grade && isStreamedGradeName(grade.name)
            })() && (
              <div className="grid gap-2">
                <Label>Stream * (Natural or Social)</Label>
                <Select
                  value={assignForm.stream}
                  onValueChange={(value) =>
                    setAssignForm((prev) => ({
                      ...prev,
                      stream: value,
                      assignedSections: [],
                      assignedSubject: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stream" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Natural">Natural Science</SelectItem>
                    <SelectItem value="Social">Social Science</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Sections - filtered by grade and stream for G11/12 */}
            <div className="grid gap-2">
              <Label>Sections *</Label>
              <Select
                value=""
                onValueChange={(value) => {
                  if (value && !assignForm.assignedSections.includes(value)) {
                    setAssignForm((prev) => ({
                      ...prev,
                      assignedSections: [...prev.assignedSections, value],
                      assignedSubject: "",
                    }))
                  }
                }}
                disabled={
                  !assignForm.assignedGrade ||
                  (() => {
                    const grade = grades.find((g) => g.id === assignForm.assignedGrade)
                    return grade && isStreamedGradeName(grade.name) && !assignForm.stream
                  })()
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add sections" />
                </SelectTrigger>
                <SelectContent>
                  {availableSections.map((section) => (
                    <SelectItem
                      key={section.id}
                      value={section.name}
                      disabled={assignForm.assignedSections.includes(section.name)}
                    >
                      Section {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {assignForm.assignedSections.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {assignForm.assignedSections.map((sectionName) => (
                    <Badge key={sectionName} variant="secondary" className="flex items-center gap-1">
                      Section {sectionName}
                      <button
                        type="button"
                        onClick={() => {
                          setAssignForm((prev) => ({
                            ...prev,
                            assignedSections: prev.assignedSections.filter((s) => s !== sectionName),
                            assignedSubject: "",
                          }))
                        }}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {assignForm.assignedSections.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {!assignForm.assignedGrade
                    ? "Select a grade first"
                    : assignForm.assignedGrade && (() => {
                        const g = grades.find((x) => x.id === assignForm.assignedGrade)
                        return g && isStreamedGradeName(g.name) && !assignForm.stream
                      })()
                    ? "Select stream for Grade 11/12 to see sections"
                    : `${availableSections.length} section(s) available for this grade${assignForm.stream ? ` (${assignForm.stream})` : ""}`}
                </p>
              )}
            </div>

            {/* Single Subject Selection */}
            <div className="grid gap-2">
              <Label>Subject *</Label>
              <Select
                value={assignForm.assignedSubject}
                onValueChange={(value) => {
                  setAssignForm((prev) => ({ ...prev, assignedSubject: value }))
                }}
                disabled={
                  !assignForm.assignedGrade ||
                  assignForm.assignedSections.length === 0 ||
                  (() => {
                    const g = grades.find((x) => x.id === assignForm.assignedGrade)
                    return g && isStreamedGradeName(g.name) && !assignForm.stream
                  })()
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !assignForm.assignedGrade
                        ? "Select grade first"
                        : (() => {
                            const g = grades.find((x) => x.id === assignForm.assignedGrade)
                            if (g && isStreamedGradeName(g.name) && !assignForm.stream) return "Select stream first"
                            if (assignForm.assignedSections.length === 0) return "Select sections first"
                            return "Select subject"
                          })()
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubjectsByStreamAndGrade
                    .map((subject) => {
                      const isAlreadyAssigned = getAssignedSubjectsForGradeAndSections.has(subject.id)

                      // Skip subjects already assigned to other teachers for the same sections
                      if (isAlreadyAssigned) {
                        return null
                      }

                      return (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                          {subject.stream && ` (${subject.stream})`}
                        </SelectItem>
                      )
                    })
                    .filter(Boolean)}
                </SelectContent>
              </Select>

              {assignForm.assignedSubject && (
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="default" className="flex items-center gap-1">
                    {subjects.find((s) => s.id === assignForm.assignedSubject)?.name}
                    <button
                      type="button"
                      onClick={() => {
                        setAssignForm((prev) => ({
                          ...prev,
                          assignedSubject: "",
                        }))
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                </div>
              )}
            </div>

            {assignmentError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                <AlertCircle className="h-4 w-4" />
                {assignmentError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignUser}
              disabled={
                !assignForm.assignedGrade ||
                !assignForm.assignedSubject ||
                assignForm.assignedSections.length === 0 ||
                (() => {
                  const g = grades.find((x) => x.id === assignForm.assignedGrade)
                  return g && isStreamedGradeName(g.name) && !assignForm.stream
                })()
              }
            >
              Update Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Teacher?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedUser?.fullName}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Modal */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password for {selectedUser?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              Enter a new password for the teacher. Share it securely via phone.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                value={resetPasswordForm.newPassword}
                onChange={(e) => handleInputChange(setResetPasswordForm, e)}
                placeholder="Enter new password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={resetPasswordForm.confirmPassword}
                onChange={(e) => handleInputChange(setResetPasswordForm, e)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsResetPasswordOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword}>Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Teacher Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">User ID</Label>
                    <p className="font-medium">{selectedUser.user_id}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Username</Label>
                    <p className="font-medium">{selectedUser.username}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Full Name</Label>
                    <p className="font-medium">{selectedUser.fullName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Email</Label>
                    <p className="font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Phone</Label>
                    <p className="font-medium">{selectedUser.phone}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Stream</Label>
                    <p className="font-medium">
                      {selectedUser.stream ? (
                        <Badge variant={selectedUser.stream === "Natural" ? "default" : "secondary"}>
                          {selectedUser.stream}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Assigned Grade</Label>
                    <p className="font-medium">{getAssignmentNames(selectedUser.assignedGrade, grades) || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Assigned Subject</Label>
                    <p className="font-medium">{getAssignmentNames(selectedUser.assignedSubject, subjects) || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">Assigned Sections</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedUser.assignedSections.length > 0 ? (
                        selectedUser.assignedSections.map((s) => (
                          <Badge key={s} variant="outline">
                            Section {s}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Created At</Label>
                    <p className="font-medium">{safeFormatDate(selectedUser.created_at)}</p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}