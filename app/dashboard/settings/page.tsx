"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Settings,
  Save,
  RotateCw,
  Key,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Database,
  RefreshCw,
  FileX,
  Download,
  HardDrive,
  FileJson,
  Table,
  Users,
  BookOpen,
  ClipboardList,
  Upload,
  FileSpreadsheet,
  Plus,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { format } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"

interface Admin {
  id: string
  username: string
  full_name: string
  email: string
  phone_number?: string | null
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Security Settings
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentEmail, setCurrentEmail] = useState<string | null>(null)

  // Admins Management
  const [admins, setAdmins] = useState<Admin[]>([])
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [newAdminUsername, setNewAdminUsername] = useState("")
  const [newAdminFullName, setNewAdminFullName] = useState("")
  const [newAdminEmail, setNewAdminEmail] = useState("")
  const [newAdminPhone, setNewAdminPhone] = useState("")
  const [newAdminPassword, setNewAdminPassword] = useState("")
  const [deleteAdminConfirmOpen, setDeleteAdminConfirmOpen] = useState(false)
  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null)

  // Exam Sessions
  const [showDeleteSessionsDialog, setShowDeleteSessionsDialog] = useState(false)
  const [deletingSessionsLoading, setDeletingSessionsLoading] = useState(false)
  const [sessionStats, setSessionStats] = useState({ total: 0, inProgress: 0, submitted: 0 })

  // Backup
  const [backupLoading, setBackupLoading] = useState(false)
  const [showBackupDialog, setShowBackupDialog] = useState(false)

  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json")
  const [estimatedSize, setEstimatedSize] = useState<string>("")
  const [exportProgress, setExportProgress] = useState(0)
  const [importProgress, setImportProgress] = useState(0)
  const [isImporting, setIsImporting] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<{ tables: string[]; recordCount: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const backupTables = [
    "admin",
    "assign_exams",
    "exam_sessions",
    "exams",
    "grade_subjects",
    "grades",
    "images",
    "questions",
    "results",
    "settings",
    "student_answers",
    "students",
    "subjects",
    "teacher",
  ]

  const calculateEstimatedSize = async () => {
    let totalSize = 0
    for (const tableId of backupTables) {
      try {
        const { data, error } = await supabase.from(tableId).select("*", { count: "exact", head: false })
        if (!error && data) {
          const jsonStr = JSON.stringify(data)
          totalSize += new Blob([jsonStr]).size
        }
      } catch {
        // Ignore errors for size estimation
      }
    }

    // Format size
    if (totalSize < 1024) {
      setEstimatedSize(`${totalSize} B`)
    } else if (totalSize < 1024 * 1024) {
      setEstimatedSize(`${(totalSize / 1024).toFixed(2)} KB`)
    } else {
      setEstimatedSize(`${(totalSize / (1024 * 1024)).toFixed(2)} MB`)
    }
  }

  useEffect(() => {
    if (showBackupDialog) {
      calculateEstimatedSize()
    }
  }, [showBackupDialog])

  const convertToCSV = (data: Record<string, any[]>): string => {
    let csvContent = ""

    for (const [tableName, rows] of Object.entries(data)) {
      if (tableName === "metadata" || !Array.isArray(rows) || rows.length === 0) continue

      csvContent += `### TABLE: ${tableName} ###\n`

      const headers = Object.keys(rows[0])
      csvContent += headers.join(",") + "\n"

      for (const row of rows) {
        const values = headers.map((header) => {
          const value = row[header]
          if (value === null || value === undefined) return ""
          if (typeof value === "object") return `"${JSON.stringify(value).replace(/"/g, '""')}"`
          if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return String(value)
        })
        csvContent += values.join(",") + "\n"
      }
      csvContent += "\n"
    }

    return csvContent
  }

  const parseCSVToJSON = (csvContent: string): Record<string, any[]> => {
    const result: Record<string, any[]> = {}
    const tableBlocks = csvContent.split(/### TABLE: (\w+) ###\n/).filter(Boolean)

    for (let i = 0; i < tableBlocks.length; i += 2) {
      const tableName = tableBlocks[i]
      const tableData = tableBlocks[i + 1]

      if (!tableData) continue

      const lines = tableData
        .trim()
        .split("\n")
        .filter((line) => line.trim())
      if (lines.length < 2) continue

      const headers = lines[0].split(",")
      const rows: any[] = []

      for (let j = 1; j < lines.length; j++) {
        const values = parseCSVLine(lines[j])
        const row: any = {}
        headers.forEach((header, index) => {
          let value = values[index] || ""
          // Try to parse JSON objects
          if (value.startsWith("{") || value.startsWith("[")) {
            try {
              value = JSON.parse(value)
            } catch {
              // Keep as string
            }
          }
          row[header] = value === "" ? null : value
        })
        rows.push(row)
      }

      result[tableName] = rows
    }

    return result
  }

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === "," && !inQuotes) {
        result.push(current)
        current = ""
      } else {
        current += char
      }
    }
    result.push(current)

    return result
  }

  const handleBackupData = async () => {
    setBackupLoading(true)
    setExportProgress(0)

    try {
      const backupData: Record<string, any> = {
        metadata: {
          created_at: new Date().toISOString(),
          tables: backupTables,
          version: "1.0",
          format: exportFormat,
        },
      }

      const totalTables = backupTables.length
      let completedTables = 0

      for (const tableId of backupTables) {
        const { data, error } = await supabase.from(tableId).select("*")

        if (error) {
          console.error(`Error backing up ${tableId}:`, error)
          continue
        }

        backupData[tableId] = data
        completedTables++
        setExportProgress(Math.round((completedTables / totalTables) * 100))

        // Small delay for visual feedback
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Create file based on format
      let blob: Blob
      let filename: string

      if (exportFormat === "csv") {
        const csvContent = convertToCSV(backupData)
        blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" })
        filename = `school_backup_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`
      } else {
        blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" })
        filename = `school_backup_${format(new Date(), "yyyy-MM-dd_HH-mm")}.json`
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const sizeBytes = blob.size
      const sizeStr =
        sizeBytes < 1024
          ? `${sizeBytes} B`
          : sizeBytes < 1024 * 1024
            ? `${(sizeBytes / 1024).toFixed(2)} KB`
            : `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`

      toast.success(`Backup created successfully! ${backupTables.length} tables exported (${sizeStr})`)
      setShowBackupDialog(false)
      setExportProgress(0)
    } catch (err) {
      console.error("Error creating backup:", err)
      toast.error("Failed to create backup")
    } finally {
      setBackupLoading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)

    try {
      const content = await file.text()
      let parsedData: Record<string, any>

      if (file.name.endsWith(".csv")) {
        parsedData = parseCSVToJSON(content)
      } else {
        parsedData = JSON.parse(content)
      }

      const tables = Object.keys(parsedData).filter((k) => k !== "metadata")
      let totalRecords = 0
      tables.forEach((t) => {
        if (Array.isArray(parsedData[t])) {
          totalRecords += parsedData[t].length
        }
      })

      setImportPreview({ tables, recordCount: totalRecords })
    } catch (err) {
      toast.error("Invalid backup file format")
      setImportFile(null)
      setImportPreview(null)
    }
  }

  const handleImportData = async () => {
    if (!importFile) {
      toast.error("Please select a backup file")
      return
    }

    setIsImporting(true)
    setImportProgress(0)

    try {
      const content = await importFile.text()
      let backupData: Record<string, any>

      if (importFile.name.endsWith(".csv")) {
        backupData = parseCSVToJSON(content)
      } else {
        backupData = JSON.parse(content)
      }

      const tables = Object.keys(backupData).filter((k) => k !== "metadata")
      const totalTables = tables.length
      let completedTables = 0
      let totalRecordsImported = 0

      for (const tableName of tables) {
        const tableData = backupData[tableName]
        if (!Array.isArray(tableData) || tableData.length === 0) {
          completedTables++
          setImportProgress(Math.round((completedTables / totalTables) * 100))
          continue
        }

        // Upsert data in batches
        const batchSize = 100
        for (let i = 0; i < tableData.length; i += batchSize) {
          const batch = tableData.slice(i, i + batchSize)

          const { error } = await supabase.from(tableName).upsert(batch, { onConflict: "id", ignoreDuplicates: false })

          if (error) {
            console.error(`Error importing ${tableName}:`, error)
          } else {
            totalRecordsImported += batch.length
          }
        }

        completedTables++
        setImportProgress(Math.round((completedTables / totalTables) * 100))
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      toast.success(`Import completed! ${totalRecordsImported} records restored across ${tables.length} tables.`)
      setShowImportDialog(false)
      setImportFile(null)
      setImportPreview(null)
      setImportProgress(0)

      // Refresh data
      fetchAdmins()
      fetchSessionStats()
    } catch (err) {
      console.error("Error importing backup:", err)
      toast.error("Failed to import backup")
    } finally {
      setIsImporting(false)
    }
  }

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data } = await supabase.auth.getUser()
      setCurrentUserId(data.user?.id || null)
      setCurrentEmail(data.user?.email || null)
    }
    fetchCurrentUser()
    fetchAdmins()
    fetchSessionStats()
    setLoading(false)
  }, [])

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase.from("admin").select("*")

      if (error) {
        console.error("Error fetching admins:", error)
        return
      }

      setAdmins(data || [])
    } catch (err) {
      console.error("Error fetching admins:", err)
    }
  }

  const fetchSessionStats = async () => {
    try {
      const { data, error } = await supabase.from("exam_sessions").select("id, status")

      if (error) {
        console.error("Error fetching session stats:", error)
        return
      }

      const total = data?.length || 0
      const inProgress = data?.filter((s) => s.status === "in_progress").length || 0
      const submitted = data?.filter((s) => s.status === "submitted").length || 0

      setSessionStats({ total, inProgress, submitted })
    } catch (err) {
      console.error("Error fetching session stats:", err)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All fields are required")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long")
      return
    }
    if (!currentEmail) {
      toast.error("Current user email not found")
      return
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      })

      if (signInError) {
        toast.error("Incorrect current password")
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        toast.error("Failed to change password: " + error.message)
        return
      }

      toast.success("Password changed successfully!")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      console.error("Unexpected error changing password:", err)
      toast.error("Unexpected error changing password")
    }
  }

  const handleAddAdmin = async () => {
    if (!newAdminUsername || !newAdminFullName || !newAdminEmail || !newAdminPassword) {
      toast.error("All required fields must be filled")
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: newAdminEmail,
        password: newAdminPassword,
      })

      if (error) {
        toast.error("Failed to create user: " + error.message)
        return
      }

      const user = data.user
      if (user) {
        const { error: insertError } = await supabase.from("admin").insert({
          id: user.id,
          username: newAdminUsername,
          full_name: newAdminFullName,
          email: newAdminEmail,
          phone_number: newAdminPhone || null,
        })

        if (insertError) {
          toast.error("Failed to add admin: " + insertError.message)
          // Optionally delete the auth user if insert fails
          return
        }

        toast.success("New admin added successfully!")
        setShowAddAdmin(false)
        setNewAdminUsername("")
        setNewAdminFullName("")
        setNewAdminEmail("")
        setNewAdminPhone("")
        setNewAdminPassword("")
        fetchAdmins()
      }
    } catch (err) {
      console.error("Error adding admin:", err)
      toast.error("Failed to add admin")
    }
  }

  const handleDeleteAdminClick = (admin: Admin) => {
    setAdminToDelete(admin)
    setDeleteAdminConfirmOpen(true)
  }

  const handleConfirmDeleteAdmin = async () => {
    if (!adminToDelete) return

    if (admins.length <= 1) {
      toast.error("Cannot delete the last admin")
      return
    }
    if (adminToDelete.id === currentUserId) {
      toast.error("Cannot delete your own account")
      return
    }

    try {
      const { error } = await supabase.from("admin").delete().eq("id", adminToDelete.id)

      if (error) {
        toast.error("Failed to delete admin: " + error.message)
        return
      }

      toast.success("Admin deleted successfully!")
      fetchAdmins()
    } catch (err) {
      console.error("Error deleting admin:", err)
      toast.error("Failed to delete admin")
    } finally {
      setDeleteAdminConfirmOpen(false)
      setAdminToDelete(null)
    }
  }

  const handleDeleteAllSessions = async () => {
    setDeletingSessionsLoading(true)
    try {
      const { error } = await supabase.rpc('delete_all_sessions')

      if (error) {
        toast.error("Failed to delete exam sessions: " + error.message)
        return
      }

      toast.success("All exam session data deleted successfully!")
      setShowDeleteSessionsDialog(false)
      fetchSessionStats()
    } catch (err) {
      console.error("Error deleting sessions:", err)
      toast.error("Failed to delete exam sessions")
    } finally {
      setDeletingSessionsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 space-y-8 p-4 md:p-8 bg-gray-50 min-h-screen">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-60" />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto lg:inline-flex gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-100 rounded-lg">
            <Settings className="h-8 w-8 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Settings</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Manage your school system preferences and configurations
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="system" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="system" className="gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">System</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-2">
            <HardDrive className="h-4 w-4" />
            <span className="hidden sm:inline">Backup</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="admins" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Admins</span>
          </TabsTrigger>
        </TabsList>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          {/* Exam Sessions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileX className="h-5 w-5 text-red-600" />
                Exam Session Data
              </CardTitle>
              <CardDescription>Manage exam session records and clean up old data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Session Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center">
                  <p className="text-3xl font-bold text-blue-600">{sessionStats.total}</p>
                  <p className="text-sm text-blue-700">Total Sessions</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center">
                  <p className="text-3xl font-bold text-amber-600">{sessionStats.inProgress}</p>
                  <p className="text-sm text-amber-700">In Progress</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center">
                  <p className="text-3xl font-bold text-green-600">{sessionStats.submitted}</p>
                  <p className="text-sm text-green-700">Submitted</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteSessionsDialog(true)}
                  className="gap-2"
                  disabled={sessionStats.total === 0}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete All Session Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-indigo-600" />
                Data Backup
              </CardTitle>
              <CardDescription>Export your school data as a JSON or CSV backup file for safekeeping</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-6 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-indigo-900">Create Full Backup</h3>
                    <p className="text-sm text-indigo-700 mt-1">Download all your school data as a JSON or CSV file</p>
                  </div>
                  <Button
                    onClick={() => setShowBackupDialog(true)}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Download className="h-4 w-4" />
                    Full Backup
                  </Button>
                </div>
              </div>

              <div className="p-6 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-emerald-900">Restore from Backup</h3>
                    <p className="text-sm text-emerald-700 mt-1">Import data from a previously exported backup file</p>
                  </div>
                  <Button
                    onClick={() => setShowImportDialog(true)}
                    variant="outline"
                    className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  >
                    <Upload className="h-4 w-4" />
                    Import Backup
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold">Backup Tips:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Create regular backups before major changes</li>
                      <li>Store backup files in a secure location</li>
                      <li>Backup before making significant updates</li>
                      <li>Include all tables for a complete backup</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-indigo-600" />
                Change Password
              </CardTitle>
              <CardDescription>Update your account password for security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
              <div className="flex justify-start pt-4">
                <Button onClick={handleChangePassword} className="gap-2">
                  <Key className="h-4 w-4" />
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admins Tab */}
        <TabsContent value="admins" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  Admin Management
                </CardTitle>
                <CardDescription>Manage admin accounts</CardDescription>
              </div>
              <Button onClick={() => setShowAddAdmin(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Admin
              </Button>
            </CardHeader>
            <CardContent>
              {admins.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Admins</h3>
                  <p className="text-gray-500 mb-4">Add a new admin</p>
                  <Button onClick={() => setShowAddAdmin(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Admin
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {admins.map((admin) => (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-white border-gray-200"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{admin.full_name}</p>
                        <p className="text-sm text-gray-500">{admin.username}</p>
                        <p className="text-sm text-gray-500">{admin.email}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteAdminClick(admin)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Admin Dialog */}
      <Dialog open={showAddAdmin} onOpenChange={setShowAddAdmin}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Admin</DialogTitle>
            <DialogDescription>Create a new admin account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={newAdminUsername}
                onChange={(e) => setNewAdminUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={newAdminFullName}
                onChange={(e) => setNewAdminFullName(e.target.value)}
                placeholder="Enter full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="Enter email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (optional)</Label>
              <Input
                id="phone"
                value={newAdminPhone}
                onChange={(e) => setNewAdminPhone(e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAdmin(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAdmin}>
              Add Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Admin Confirmation */}
      <Dialog open={deleteAdminConfirmOpen} onOpenChange={setDeleteAdminConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Admin
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete admin "{adminToDelete?.full_name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                Warning: Deleting this admin will remove their access.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAdminConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteAdmin} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Delete Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Sessions Dialog */}
      <Dialog open={showDeleteSessionsDialog} onOpenChange={setShowDeleteSessionsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete All Exam Sessions
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all exam session data including student answers.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
              <p className="text-sm text-red-800 font-semibold">This action will delete:</p>
              <ul className="text-sm text-red-800 list-disc list-inside">
                <li>{sessionStats.total} exam sessions</li>
                <li>All associated student answers</li>
                <li>Session progress data</li>
              </ul>
              <p className="text-sm text-red-800 font-semibold mt-2">Note: Results and grades will NOT be affected.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteSessionsDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAllSessions}
              disabled={deletingSessionsLoading}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {deletingSessionsLoading ? "Deleting..." : "Delete All Sessions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Confirmation Dialog */}
      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-indigo-600" />
              Export Backup
            </DialogTitle>
            <DialogDescription>Configure your backup export settings</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Export Format</Label>
              <RadioGroup
                value={exportFormat}
                onValueChange={(v) => setExportFormat(v as "json" | "csv")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="json" id="json" />
                  <Label htmlFor="json" className="flex items-center gap-2 cursor-pointer">
                    <FileJson className="h-4 w-4 text-blue-600" />
                    JSON
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    CSV
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Estimated Size */}
            {estimatedSize && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Database className="h-4 w-4" />
                <span>
                  Estimated size: <strong>{estimatedSize}</strong>
                </span>
              </div>
            )}

            {/* Progress Bar */}
            {backupLoading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Exporting data...</span>
                  <span className="font-medium">{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} className="h-2" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBackupDialog(false)} disabled={backupLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleBackupData}
              disabled={backupLoading}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {backupLoading ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download {exportFormat.toUpperCase()}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-emerald-600" />
              Import Backup
            </DialogTitle>
            <DialogDescription>
              Restore your school data from a backup file. Existing records will be updated.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* File Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Backup File</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {importFile ? (
                  <div className="flex items-center justify-center gap-2">
                    {importFile.name.endsWith(".csv") ? (
                      <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    ) : (
                      <FileJson className="h-8 w-8 text-blue-600" />
                    )}
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{importFile.name}</p>
                      <p className="text-sm text-gray-500">{(importFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Click to select or drag and drop</p>
                    <p className="text-xs text-gray-400 mt-1">Supports JSON and CSV formats</p>
                  </>
                )}
              </div>
            </div>

            {/* Import Preview */}
            {importPreview && (
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2">
                <p className="text-sm font-medium text-emerald-900">Backup Contents:</p>
                <div className="flex flex-wrap gap-2">
                  {importPreview.tables.map((tableName) => (
                    <Badge key={tableName} variant="secondary" className="bg-emerald-100">
                      {tableName}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-emerald-700">
                  Total records: <strong>{importPreview.recordCount.toLocaleString()}</strong>
                </p>
              </div>
            )}

            {/* Progress Bar */}
            {isImporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Importing data...</span>
                  <span className="font-medium">{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            )}

            {/* Warning */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  Importing will update existing records with matching IDs. Make sure to backup your current data before
                  proceeding.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false)
                setImportFile(null)
                setImportPreview(null)
              }}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportData}
              disabled={!importFile || isImporting}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {isImporting ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}