"use client"

import type React from "react"

import { useState, useMemo, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
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
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  UserPlus,
  Edit,
  Trash2,
  Key,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Settings,
  Eye,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import bcrypt from "bcryptjs"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

export default function TeacherManagementPage() {
  const router = useRouter()
  const [users, setUsers] = useState<Teacher[]>([])
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [gradeSubjects, setGradeSubjects] = useState<Record<string, string[]>>({}) // grade_id -> subject_ids
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

      // グレードに割り当てられた科目を取得
      const { data: gradeSubjectsData, error: gradeSubjectsError } = await supabase
        .from("grade_subjects")
        .select("grade_id, subject_id")
      
      if (gradeSubjectsError) {
        console.warn("grade_subjects table may not exist yet")
      }

      const { data: sectionsData, error: sectionsError } = await supabase
        .from("grade_sections")
        .select("id, grade_id, section_name")
      if (sectionsError) {
        console.warn("grade_sections table may not exist yet, using default sections")
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

      // グレードごとに割り当てられた科目をグループ化
      const subjectsByGrade: Record<string, string[]> = {}
      if (gradeSubjectsData) {
        gradeSubjectsData.forEach((gs: any) => {
          const gradeId = gs.grade_id.toString()
          if (!subjectsByGrade[gradeId]) {
            subjectsByGrade[gradeId] = []
          }
          subjectsByGrade[gradeId].push(gs.subject_id.toString())
        })
      }
      setGradeSubjects(subjectsByGrade)

      // グレードごとにセクションをグループ化
      const sectionsByGrade: Record<string, Section[]> = {}
      if (sectionsData) {
        sectionsData.forEach((s: any) => {
          const gradeId = s.grade_id.toString()
          if (!sectionsByGrade[gradeId]) {
            sectionsByGrade[gradeId] = []
          }
          sectionsByGrade[gradeId].push({ id: s.section_name, name: s.section_name })
        })
      }
      // DBにセクションがない場合はデフォルトのA-Eを使用
      if (Object.keys(sectionsByGrade).length === 0) {
        gradesData?.forEach((g: any) => {
          sectionsByGrade[g.id.toString()] = ["A", "B", "C", "D", "E"].map((s) => ({ id: s, name: s }))
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
  }, [])

  // 選択されたグレードに割り当てられている科目だけをフィルタリング
  const filteredSubjectsByStreamAndGrade = useMemo(() => {
    if (!assignForm.stream) return []
    
    if (!assignForm.assignedGrade) {
      // グレードが選択されていない場合は、ストリームに基づいてフィルタリング
      return subjects.filter((s) => 
        s.stream === assignForm.stream || 
        s.stream === "Common" || 
        !s.stream
      )
    }
    
    // グレードが選択されている場合は、そのグレードに割り当てられている科目だけを表示
    const gradeSubjectIds = gradeSubjects[assignForm.assignedGrade] || []
    const gradeSubjectsList = subjects.filter((s) => 
      gradeSubjectIds.includes(s.id) && 
      (s.stream === assignForm.stream || s.stream === "Common" || !s.stream)
    )
    
    return gradeSubjectsList
  }, [subjects, assignForm.stream, assignForm.assignedGrade, gradeSubjects])

  // 選択されたグレードに割り当てられているセクションだけを取得
  const availableSections = useMemo(() => {
    if (!assignForm.assignedGrade) return []
    return gradeSections[assignForm.assignedGrade] || []
  }, [assignForm.assignedGrade, gradeSections])

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
    if (!assignForm.stream) {
      toast.error("Please select a stream first")
      return
    }
    if (!assignForm.assignedGrade) {
      toast.error("Please select a grade")
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
          stream: assignForm.stream,
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
    return (
      <div className="flex-1 space-y-8 p-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
            <Skeleton className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
          </div>
          <Skeleton className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <Skeleton className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                {[...Array(8)].map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {[...Array(8)].map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-8 p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Teacher Management</h1>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Create Teacher
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <Card key={i}>
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
              placeholder="Search by name, ID, email, phone, or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No teachers found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((user) => (
                  <TableRow key={user.id}>

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
                          <DropdownMenuItem onClick={() => openDelete(user)} className="text-red-600">
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
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * USERS_PER_PAGE + 1} to{" "}
              {Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} teachers
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
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
              Select stream first, then grade, then sections, and finally one subject.
              <br />
              Only subjects assigned to the selected grade will be shown.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Stream Selection - Must be first */}
            <div className="grid gap-2">
              <Label>Stream *</Label>
              <Select
                value={assignForm.stream}
                onValueChange={(value) =>
                  setAssignForm((prev) => ({
                    ...prev,
                    stream: value,
                    assignedGrade: "",
                    assignedSubject: "",
                    assignedSections: [],
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

            {/* Grade Selection */}
            <div className="grid gap-2">
              <Label>Grade *</Label>
              <Select
                value={assignForm.assignedGrade}
                onValueChange={(value) =>
                  setAssignForm((prev) => ({
                    ...prev,
                    assignedGrade: value,
                    assignedSections: [],
                    assignedSubject: "",
                  }))
                }
                disabled={!assignForm.stream}
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

            {/* Sections Selection */}
            <div className="grid gap-2">
              <Label>Sections *</Label>
              <Select
                value=""
                onValueChange={(value) => {
                  if (value && !assignForm.assignedSections.includes(value)) {
                    setAssignForm((prev) => ({
                      ...prev,
                      assignedSections: [...prev.assignedSections, value],
                      assignedSubject: "", // Reset subject when sections change
                    }))
                  }
                }}
                disabled={!assignForm.assignedGrade}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add sections" />
                </SelectTrigger>
                <SelectContent>
                  {availableSections.map((section) => (
                    <SelectItem
                      key={section.id}
                      value={section.id}
                      disabled={assignForm.assignedSections.includes(section.id)}
                    >
                      Section {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Display selected sections as badges */}
              {assignForm.assignedSections.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {assignForm.assignedSections.map((sectionId) => {
                    const section = availableSections.find((s) => s.id === sectionId)
                    return (
                      <Badge key={sectionId} variant="secondary" className="flex items-center gap-1">
                        Section {section?.name}
                        <button
                          type="button"
                          onClick={() => {
                            setAssignForm((prev) => ({
                              ...prev,
                              assignedSections: prev.assignedSections.filter((id) => id !== sectionId),
                              assignedSubject: "", // Reset subject when section is removed
                            }))
                          }}
                          className="ml-1 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}

              {assignForm.assignedSections.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {assignForm.assignedGrade 
                    ? `Select sections from this grade (${availableSections.length} available)`
                    : "Select a grade first to see available sections"}
                </p>
              )}
            </div>

            {/* Single Subject Selection */}
            <div className="grid gap-2">
              <Label>Subject *</Label>
              <Select
                value={assignForm.assignedSubject}
                onValueChange={(value) => {
                  setAssignForm((prev) => ({
                    ...prev,
                    assignedSubject: value,
                  }))
                }}
                disabled={!assignForm.stream || !assignForm.assignedGrade || assignForm.assignedSections.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !assignForm.stream 
                      ? "Select stream first" 
                      : !assignForm.assignedGrade 
                      ? "Select grade first"
                      : assignForm.assignedSections.length === 0
                      ? "Select sections first"
                      : "Select subject"
                  } />
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
              disabled={!assignForm.stream || !assignForm.assignedGrade || !assignForm.assignedSubject || assignForm.assignedSections.length === 0}
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
            <AlertDialogAction onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-700">
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