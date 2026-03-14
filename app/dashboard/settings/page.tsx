"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
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
import { Switch } from "@/components/ui/switch"
import {
  Settings,
  RotateCw,
  Key,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Database,
  FileX,
  Download,
  HardDrive,
  FileJson,
  TableIcon,
  Users,
  BookOpen,
  ClipboardList,
  Upload,
  FileSpreadsheet,
  Plus,
  Shield,
  ShieldAlert,
  Info,
  Book,
  User,
  FileText,
  Image,
  Grid,
  BarChart,
  CheckSquare,
  GraduationCap,
  Layers,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { format } from "date-fns"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer"

interface Admin {
  id: string
  username: string
  full_name: string
  email: string
  phone_number?: string | null
  role?: "super_admin" | "admin" | null
}

interface TableInfo {
  name: string
  count: number
  icon: any
  description: string
  color: string
  selected?: boolean
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

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  // Security Settings
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Admins Management
  const [admins, setAdmins] = useState<Admin[]>([])
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [newAdminUsername, setNewAdminUsername] = useState("")
  const [newAdminFullName, setNewAdminFullName] = useState("")
  const [newAdminEmail, setNewAdminEmail] = useState("")
  const [newAdminPhone, setNewAdminPhone] = useState("")
  const [newAdminPassword, setNewAdminPassword] = useState("")
  const [newAdminRole, setNewAdminRole] = useState<"super_admin" | "admin">("admin")
  const [deleteAdminConfirmOpen, setDeleteAdminConfirmOpen] = useState(false)
  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null)
  const [deleteAdminLoading, setDeleteAdminLoading] = useState(false)
  const [confirmDeleteText, setConfirmDeleteText] = useState("")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<"super_admin" | "admin" | null>(null)

  // Exam Sessions
  const [showDeleteSessionsDialog, setShowDeleteSessionsDialog] = useState(false)
  const [deletingSessionsLoading, setDeletingSessionsLoading] = useState(false)
  const [sessionStats, setSessionStats] = useState({ total: 0, inProgress: 0, submitted: 0 })

  // Risk & Time Control (system_settings)
  const [maxRiskBeforeSubmit, setMaxRiskBeforeSubmit] = useState(7)
  const [maxTimeExtensionMinutes, setMaxTimeExtensionMinutes] = useState(30)
  const [savingSystemSettings, setSavingSystemSettings] = useState(false)

  // Feature flags + academic term boundaries (system_settings)
  const [enableResultsArchive, setEnableResultsArchive] = useState(false)
  const [enableStudentResultsPortal, setEnableStudentResultsPortal] = useState(false)
  const [enableStudentTeacherChat, setEnableStudentTeacherChat] = useState(false)
  const [enableRealtimeFeatures, setEnableRealtimeFeatures] = useState(false)
  const [currentAcademicYear, setCurrentAcademicYear] = useState<string>("")
  const [studentCurrentResultsMode, setStudentCurrentResultsMode] = useState<"semester_1" | "full_year">("semester_1")

  // Table Management
  const [tables, setTables] = useState<TableInfo[]>([])
  const [tableStats, setTableStats] = useState<Record<string, number>>({})
  const [showDeleteTableDialog, setShowDeleteTableDialog] = useState(false)
  const [tableToDelete, setTableToDelete] = useState<TableInfo | null>(null)
  const [deletingTableLoading, setDeletingTableLoading] = useState(false)
  const [confirmDeleteTableText, setConfirmDeleteTableText] = useState("")
  
  // Multiple Tables Selection
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [showDeleteMultipleDialog, setShowDeleteMultipleDialog] = useState(false)
  const [deletingMultipleLoading, setDeletingMultipleLoading] = useState(false)
  const [selectAllTables, setSelectAllTables] = useState(false)
  // Start with the tables list hidden so "Hide List" behavior is effectively active
  const [showTablesList, setShowTablesList] = useState(false)

  // Backup
  const [backupLoading, setBackupLoading] = useState(false)
  const [showBackupDialog, setShowBackupDialog] = useState(false)

  const [exportFormat, setExportFormat] = useState<"json" | "csv">("csv")
  const [estimatedSize, setEstimatedSize] = useState<string>("")
  const [exportProgress, setExportProgress] = useState(0)
  const [importProgress, setImportProgress] = useState(0)
  const [isImporting, setIsImporting] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<{ tables: string[]; recordCount: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Derived: total records in all selected tables (for summary in dialogs)
  const totalSelectedRecords = selectedTables.reduce((total, tableName) => {
    return total + (tableStats[tableName] || 0)
  }, 0)

  // Individual table export (multiple tables allowed, CSV default)
  const [exportTableSelection, setExportTableSelection] = useState<string[]>([])
  const [showExportTablesDialog, setShowExportTablesDialog] = useState(false)
  const [exportTablesLoading, setExportTablesLoading] = useState(false)
  const [exportTablesFormat, setExportTablesFormat] = useState<"json" | "csv">("csv")

  const systemTables: TableInfo[] = [
    { name: "admin", icon: Shield, description: "Admin accounts", color: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400" },
    { name: "students", icon: User, description: "Student records and information", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    { name: "teacher", icon: Users, description: "Teacher accounts and details", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    { name: "grades", icon: GraduationCap, description: "Grade levels and classes", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    { name: "subjects", icon: Book, description: "Subjects taught in school", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    { name: "grade_sections", icon: Grid, description: "Grade sections and divisions", color: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400" },
    { name: "grade_subjects", icon: BookOpen, description: "Subjects per grade", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    { name: "exams", icon: FileText, description: "Exams and test papers", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    { name: "questions", icon: CheckSquare, description: "Exam questions and answers", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    { name: "assign_exams", icon: ClipboardList, description: "Assigned exams to students", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
    { name: "exam_sessions", icon: Layers, description: "Active exam sessions", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
    { name: "session_security", icon: ShieldAlert, description: "Session device security", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
    { name: "student_answers", icon: CheckSquare, description: "Student exam answers", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
    { name: "results", icon: BarChart, description: "Exam results and grades", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
    { name: "activity_logs", icon: Database, description: "Security activity events", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    { name: "audit_logs", icon: FileText, description: "Admin and teacher audit trail", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
    { name: "images", icon: Image, description: "Uploaded images and files", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
    { name: "settings", icon: Settings, description: "System settings and config", color: "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300" },
  ]

  // Import order respects foreign keys (parents before children)
  const IMPORT_INSERT_ORDER = [
    "admin", "grades", "subjects", "teacher", "students", "grade_sections", "grade_subjects",
    "exams", "assign_exams", "exam_sessions", "session_security", "questions", "results",
    "student_answers", "activity_logs", "audit_logs", "images", "settings",
  ]
  // Tables that use composite unique for upsert (others use "id")
  const TABLE_CONFLICT_KEYS: Record<string, string> = {
    results: "exam_id,student_id",
    assign_exams: "exam_id,student_id",
  }

  const ADMIN_PAGE_KEY_LABELS: Record<string, string> = {
    dashboard_home: "Dashboard home",
    analytics: "Analytics",
    settings_system: "System settings",
    teachers_page: "Teachers page",
    teachers_create: "Create teachers",
    students_page: "Students page",
    students_create: "Create students",
    students_promotions: "Promote students (grade upgrade)",
    results_archive: "Results archive & transcripts",
    grades_page: "Grades page",
    grades_create: "Create grades",
    subjects_page: "Subjects page",
    subjects_create: "Create subjects",
  }

  const backupTables = systemTables.map(t => t.name)

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Validate file
      const validation = validateFile(file);
      if (!validation.isValid) {
        toast.error(validation.message || "Invalid file");
        return;
      }
      
      setImportFile(file);
      processFilePreview(file);
    }
  };

  // File validation function
  const validateFile = (file: File): { isValid: boolean; message?: string } => {
    const allowedExtensions = ['.json', '.csv'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedExtensions.includes(extension)) {
      return { 
        isValid: false, 
        message: "Only JSON (.json) and CSV (.csv) files are allowed" 
      };
    }
    
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return { 
        isValid: false, 
        message: "File size must be less than 50MB" 
      };
    }
    
    if (file.size === 0) {
      return { 
        isValid: false, 
        message: "File is empty" 
      };
    }
    
    return { isValid: true };
  };

  // Sanitize row for Supabase: remove undefined (Postgres/API reject it), keep null and other values
  const sanitizeRow = (row: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v === undefined) continue;
      out[k] = v;
    }
    return out;
  };

  // File preview processing
  const processFilePreview = async (file: File) => {
    try {
      const content = await file.text();
      let parsedData: Record<string, unknown>;

      if (file.name.endsWith(".csv")) {
        parsedData = parseCSVToJSON(content) as Record<string, unknown>;
      } else {
        try {
          parsedData = JSON.parse(content) as Record<string, unknown>;
        } catch (parseErr) {
          const msg = parseErr instanceof Error ? parseErr.message : "Invalid JSON";
          toast.error(`Invalid JSON: ${msg}`);
          setImportFile(null);
          setImportPreview(null);
          return;
        }
      }

      if (typeof parsedData !== "object" || parsedData === null || Array.isArray(parsedData)) {
        toast.error("Backup file must map table names to arrays of rows (JSON or CSV).");
        setImportFile(null);
        setImportPreview(null);
        return;
      }

      const tables = Object.keys(parsedData).filter((k) => k !== "metadata");
      let totalRecords = 0;
      tables.forEach((t) => {
        const arr = parsedData[t];
        if (Array.isArray(arr)) totalRecords += arr.length;
      });

      setImportPreview({ tables, recordCount: totalRecords });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid backup file format");
      setImportFile(null);
      setImportPreview(null);
    }
  };

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
    // Split includes captures: [prefix, name1, data1, name2, data2, ...]
    const parts = csvContent.split(/### TABLE: (\w+) ###\n/)
    for (let i = 1; i < parts.length - 1; i += 2) {
      const tableName = parts[i]?.trim()
      const tableData = parts[i + 1]
      if (!tableName || !tableData) continue

      const lines = tableData
        .trim()
        .split("\n")
        .filter((line) => line.trim())
      if (lines.length < 2) continue

      const headers = parseCSVLine(lines[0])
      const rows: any[] = []

      for (let j = 1; j < lines.length; j++) {
        const values = parseCSVLine(lines[j])
        const row: Record<string, unknown> = {}
        headers.forEach((header, index) => {
          let value: unknown = values[index] ?? ""
          if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
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

  const handleExportSelectedTables = async () => {
    if (exportTableSelection.length === 0) {
      toast.error("Select at least one table to export")
      return
    }
    setExportTablesLoading(true)
    setExportProgress(0)
    try {
      const backupData: Record<string, any> = {
        metadata: {
          created_at: new Date().toISOString(),
          tables: exportTableSelection,
          version: "1.0",
          format: exportTablesFormat,
        },
      }
      const totalTables = exportTableSelection.length
      let completedTables = 0
      for (const tableId of exportTableSelection) {
        const { data, error } = await supabase.from(tableId).select("*")
        if (error) {
          console.error(`Error exporting ${tableId}:`, error)
          toast.error(`Failed to export table: ${tableId}`)
          setExportTablesLoading(false)
          return
        }
        backupData[tableId] = data ?? []
        completedTables++
        setExportProgress(Math.round((completedTables / totalTables) * 100))
        await new Promise((r) => setTimeout(r, 50))
      }
      let blob: Blob
      let filename: string
      if (exportTablesFormat === "csv") {
        const csvContent = convertToCSV(backupData)
        blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" })
        filename = `tables_export_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`
      } else {
        blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" })
        filename = `tables_export_${format(new Date(), "yyyy-MM-dd_HH-mm")}.json`
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Exported ${exportTableSelection.length} table(s) as ${exportTablesFormat.toUpperCase()}`)
      setShowExportTablesDialog(false)
      setExportTableSelection([])
      setExportProgress(0)
    } catch (err) {
      console.error("Error exporting tables:", err)
      toast.error("Failed to export tables")
    } finally {
      setExportTablesLoading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateFile(file);
    if (!validation.isValid) {
      toast.error(validation.message || "Invalid file");
      return;
    }

    setImportFile(file)
    processFilePreview(file)
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
      let backupData: Record<string, unknown>

      if (importFile.name.endsWith(".csv")) {
        backupData = parseCSVToJSON(content) as Record<string, unknown>
      } else {
        try {
          backupData = JSON.parse(content) as Record<string, unknown>
        } catch (parseErr) {
          const msg = parseErr instanceof Error ? parseErr.message : "Invalid JSON"
          toast.error(`Invalid JSON: ${msg}`)
          setIsImporting(false)
          return
        }
      }

      if (typeof backupData !== "object" || backupData === null || Array.isArray(backupData)) {
        toast.error("Backup file must map table names to arrays of rows (JSON or CSV).")
        setIsImporting(false)
        return
      }

      // Process in dependency order so foreign keys exist
      const tablesToImport = IMPORT_INSERT_ORDER.filter((t) => {
        const val = backupData[t]
        return Array.isArray(val) && val.length > 0
      })
      const totalTables = tablesToImport.length
      let completedTables = 0
      let totalRecordsImported = 0

      for (const tableName of tablesToImport) {
        const rawTableData = backupData[tableName]
        if (!Array.isArray(rawTableData) || rawTableData.length === 0) {
          completedTables++
          setImportProgress(Math.round((completedTables / totalTables) * 100))
          continue
        }

        const batchSize = 50
        const onConflict = TABLE_CONFLICT_KEYS[tableName] ?? "id"

        for (let i = 0; i < rawTableData.length; i += batchSize) {
          const batch = rawTableData
            .slice(i, i + batchSize)
            .map((row) => sanitizeRow(row as Record<string, unknown>) as Record<string, unknown>)

          const { error } = await supabase
            .from(tableName)
            .upsert(batch, { onConflict, ignoreDuplicates: false })

          if (error) {
            console.error(`Error importing ${tableName}:`, error)
            toast.error(`Import error in ${tableName}: ${error.message}`)
          } else {
            totalRecordsImported += batch.length
          }
        }

        completedTables++
        setImportProgress(Math.round((completedTables / totalTables) * 100))
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      toast.success(`Import completed! ${totalRecordsImported} records restored across ${tablesToImport.length} tables.`)
      setShowImportDialog(false)
      setImportFile(null)
      setImportPreview(null)
      setImportProgress(0)

      fetchAdmins()
      fetchSessionStats()
      fetchTableStats()
    } catch (err) {
      console.error("Error importing backup:", err)
      toast.error(err instanceof Error ? err.message : "Failed to import backup")
    } finally {
      setIsImporting(false)
    }
  }

  const fetchTableStats = async () => {
    try {
      const stats: Record<string, number> = {}
      const tableList = systemTables.map(t => t.name)
      
      for (const tableName of tableList) {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
        
        if (error) {
          console.error(`Error fetching count for ${tableName}:`, error)
          stats[tableName] = 0
        } else {
          stats[tableName] = count || 0
        }
      }
      
      setTableStats(stats)
      
      // Update tables with counts and selection state
      const updatedTables = systemTables.map(table => ({
        ...table,
        count: stats[table.name] || 0,
        selected: selectedTables.includes(table.name)
      }))
      setTables(updatedTables)
    } catch (err) {
      console.error("Error fetching table stats:", err)
    }
  }

  const fetchSystemSettings = async () => {
    try {
      const res = await fetch("/api/admin/system-settings")
      const data = await res.json()
      setMaxRiskBeforeSubmit(data.max_risk_before_submit ?? 7)
      setMaxTimeExtensionMinutes(data.max_time_extension_minutes ?? 30)
      setEnableResultsArchive(Boolean(data.enable_results_archive))
      setEnableStudentResultsPortal(Boolean(data.enable_student_results_portal))
      setEnableStudentTeacherChat(Boolean(data.enable_student_teacher_chat))
      setEnableRealtimeFeatures(Boolean(data.enable_realtime_features))
      setCurrentAcademicYear(data.current_academic_year ? String(data.current_academic_year) : "")
      setStudentCurrentResultsMode(data.student_current_results_mode === "full_year" ? "full_year" : "semester_1")
    } catch { /* use defaults */ }
  }

  // Keep system_settings-driven controls (current year, flags) in sync in real time
  // so that changes from other admin screens (e.g. results archive) or from this
  // page are reflected without a manual refresh.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    try {
      channel = supabase
        .channel("system-settings-admin")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "system_settings",
            filter: "id=eq.1",
          },
          (payload: any) => {
            const row = payload?.new as any
            if (!row) return
            setMaxRiskBeforeSubmit(row.max_risk_before_submit ?? 7)
            setMaxTimeExtensionMinutes(row.max_time_extension_minutes ?? 30)
            setEnableResultsArchive(Boolean(row.enable_results_archive))
            setEnableStudentResultsPortal(Boolean(row.enable_student_results_portal))
            setEnableStudentTeacherChat(Boolean(row.enable_student_teacher_chat))
            setEnableRealtimeFeatures(Boolean(row.enable_realtime_features))
            setCurrentAcademicYear(row.current_academic_year ? String(row.current_academic_year) : "")
            setStudentCurrentResultsMode(
              row.student_current_results_mode === "full_year" ? "full_year" : "semester_1"
            )
          }
        )
        .subscribe()
    } catch {
      // ignore realtime wiring errors and fall back to initial fetch
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      const fetchCurrentUser = async () => {
        const { data } = await supabase.auth.getUser()
        const userId = data.user?.id || null
        setCurrentUserId(userId)

        if (userId) {
          const { data: adminRow } = await supabase
            .from("admin")
            .select("id, role")
            .eq("id", userId)
            .maybeSingle()
          const role = (adminRow?.role as ("super_admin" | "admin" | null) | undefined) ?? "super_admin"
          setCurrentUserRole(role)
          return role
        }
        return null
      }
      const fetchAccessConfig = async () => {
        try {
          const res = await fetch("/api/admin/page-permissions", { cache: "no-store" })
  if (res.ok) {
  const json = await res.json()
  const role = (json.role as "super_admin" | "admin" | undefined) ?? "super_admin"
  setCurrentUserRole(role)
  return role
          }
        } catch {
          /* ignore; fall back to super_admin UX */
        }
        return null
      }
      const roleFromUser = await fetchCurrentUser()
      const roleFromAccess = await fetchAccessConfig()
      const role = roleFromAccess ?? roleFromUser ?? "super_admin"

      // Admins may access Settings only to change password (Security tab)
      if (role === "admin") {
        setLoading(false)
        return
      }

      await Promise.all([
        fetchAdmins(),
        fetchSessionStats(),
        fetchTableStats(),
        fetchSystemSettings(),
      ])
      setLoading(false);
    }
    loadAllData()
  }, [router])

  // Update tables when selectedTables changes
  useEffect(() => {
    const updatedTables = tables.map(table => ({
      ...table,
      selected: selectedTables.includes(table.name)
    }))
    setTables(updatedTables)
  }, [selectedTables])

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase.from("admin").select("*")

      if (error) {
        console.error("Error fetching admins:", error)
        return
      }

      const withRoles = (data || []).map((a) => ({
        ...a,
        role: (a.role as "super_admin" | "admin" | undefined) ?? "super_admin",
      }))
      setAdmins(withRoles)
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

  // Handle single table selection
  const handleTableSelect = (tableName: string) => {
    if (selectedTables.includes(tableName)) {
      setSelectedTables(selectedTables.filter(name => name !== tableName))
    } else {
      setSelectedTables([...selectedTables, tableName])
    }
  }

  // Handle select all/none
  const handleSelectAll = () => {
    if (selectAllTables) {
      setSelectedTables([])
      setSelectAllTables(false)
    } else {
      const allTableNames = tables.map(t => t.name)
      setSelectedTables(allTableNames)
      setSelectAllTables(true)
    }
  }

  // Handle delete multiple tables
  const handleDeleteMultipleTables = async () => {
    if (selectedTables.length === 0) {
      toast.error("Please select at least one table to delete")
      return
    }

    setDeletingMultipleLoading(true)

    try {
      const totalRecordsToDelete = selectedTables.reduce((total, tableName) => {
        return total + (tableStats[tableName] || 0)
      }, 0)

      let successCount = 0
      let errorCount = 0

      for (const tableName of selectedTables) {
        try {
          if (tableName === "admin") {
            // For admin table, delete all except current user
            const { error } = await supabase
              .from("admin")
              .delete()
              .neq("id", currentUserId)
            
            if (error) {
              console.error(`Error deleting admin data:`, error)
              errorCount++
            } else {
              successCount++
            }
          } else {
            // For other tables, delete all data
            const { error } = await supabase
              .from(tableName)
              .delete()
              .not('id', 'is', null)
            
            if (error) {
              console.error(`Error deleting ${tableName} data:`, error)
              errorCount++
            } else {
              successCount++
            }
          }
        } catch (err) {
          console.error(`Error processing ${tableName}:`, err)
          errorCount++
        }
      }

      // Refresh data
      fetchTableStats()
      if (selectedTables.includes("exam_sessions") || selectedTables.includes("student_answers")) {
        fetchSessionStats()
      }
      if (selectedTables.includes("admin")) {
        fetchAdmins()
      }

      // Clear selection
      setSelectedTables([])
      setSelectAllTables(false)

      // Show results
      if (errorCount === 0) {
        toast.success(`Successfully deleted ${successCount} table${successCount > 1 ? 's' : ''} with ${totalRecordsToDelete} records`)
      } else if (successCount > 0) {
        toast.warning(`Partially completed: ${successCount} successful, ${errorCount} failed`)
      } else {
        toast.error(`Failed to delete any tables`)
      }

      setShowDeleteMultipleDialog(false)
    } catch (err) {
      console.error("Error deleting multiple tables:", err)
      toast.error("Failed to delete tables: " + (err as Error).message)
    } finally {
      setDeletingMultipleLoading(false)
    }
  }

  const handleDeleteTable = async () => {
    if (!tableToDelete) return;

    // Check confirmation text
    if (confirmDeleteTableText !== `DELETE-${tableToDelete.name.toUpperCase()}`) {
      toast.error(`Please type 'DELETE-${tableToDelete.name.toUpperCase()}' to confirm`);
      return;
    }

    setDeletingTableLoading(true);

    try {
      console.log(`Deleting all data from ${tableToDelete.name}...`);
      
      if (tableToDelete.name === "admin") {
        // Check if trying to delete all admins
        if (admins.length <= 1) {
          toast.error("Cannot delete admin table - at least one admin must remain");
          setDeletingTableLoading(false);
          return;
        }
        
        // For admin table, delete all except current user
        const { error } = await supabase
          .from("admin")
          .delete()
          .neq("id", currentUserId);
        
        if (error) {
          toast.error("Failed to delete admin data: " + error.message);
          return;
        }
        
        toast.success(`Admin data deleted successfully! Current admin preserved.`);
      } else {
        // For other tables, delete all data
        const { error } = await supabase
          .from(tableToDelete.name)
          .delete()
          .not('id', 'is', null);
        
        if (error) {
          toast.error(`Failed to delete ${tableToDelete.name} data: ` + error.message);
          return;
        }
        
        toast.success(`All data from ${tableToDelete.name} deleted successfully!`);
      }
      
      // Refresh data
      fetchTableStats();
      if (tableToDelete.name === "exam_sessions" || tableToDelete.name === "student_answers") {
        fetchSessionStats();
      }
      if (tableToDelete.name === "admin") {
        fetchAdmins();
      }
      
      // Close dialog and reset
      setShowDeleteTableDialog(false);
      setTableToDelete(null);
      setConfirmDeleteTableText("");
      
    } catch (err) {
      console.error("Error deleting table data:", err);
      toast.error("Failed to delete table data: " + (err as Error).message);
    } finally {
      setDeletingTableLoading(false);
    }
  }

  const handleDeleteTableClick = (table: TableInfo) => {
    setTableToDelete(table);
    setShowDeleteTableDialog(true);
    setConfirmDeleteTableText("");
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

    try {
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
          role: newAdminRole,
        })

        if (insertError) {
          toast.error("Failed to add admin: " + insertError.message)
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
    setAdminToDelete(admin);
    setDeleteAdminConfirmOpen(true);
    setConfirmDeleteText("");
  }

  const handleConfirmDeleteAdmin = async () => {
    if (!adminToDelete) return;

    // Check confirmation text
    if (confirmDeleteText !== "DELETE") {
      toast.error("Please type 'DELETE' to confirm deletion");
      return;
    }

    // Check if it's the last admin
    if (admins.length <= 1) {
      toast.error("Cannot delete the last admin");
      setDeleteAdminConfirmOpen(false);
      setAdminToDelete(null);
      return;
    }

    // Check if trying to delete own account
    if (adminToDelete.id === currentUserId) {
      toast.error("Cannot delete your own account");
      setDeleteAdminConfirmOpen(false);
      setAdminToDelete(null);
      return;
    }

    setDeleteAdminLoading(true);

    try {
      // Simple direct deletion from admin table
      const { error } = await supabase
        .from("admin")
        .delete()
        .eq("id", adminToDelete.id);

      if (error) {
        toast.error("Failed to delete admin: " + error.message);
        return;
      }

      toast.success(`Admin "${adminToDelete.full_name}" deleted successfully!`);
      
      // Refresh admin list
      fetchAdmins();
      
      // Close dialog and reset
      setDeleteAdminConfirmOpen(false);
      setAdminToDelete(null);
      setConfirmDeleteText("");
      
    } catch (err) {
      console.error("Error deleting admin:", err);
      toast.error("Failed to delete admin");
    } finally {
      setDeleteAdminLoading(false);
    }
  }

  const handleDeleteAllSessions = async () => {
    setDeletingSessionsLoading(true)
    try {
      const { error } = await supabase
        .from("exam_sessions")
        .delete()
        .not("id", "is", null)

      if (error) {
        toast.error("Failed to delete exam sessions: " + error.message)
        return
      }

      toast.success("All exam session data deleted successfully!")
      setShowDeleteSessionsDialog(false)
      fetchSessionStats()
    } catch (err) {
      console.error("Error deleting sessions:", err)
      toast.error("Failed to delete exam sessions: " + (err as Error).message)
    } finally {
      setDeletingSessionsLoading(false)
    }
  }

  const handlePagePermissionToggle = async (pageKey: string, allowed: boolean) => {
    setSavingPagePermission(pageKey)
    try {
      const res = await fetch("/api/admin/page-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey, allowed }),
      })

      if (res.ok) {
        setAdminRolePermissions((prev) => ({ ...prev, [pageKey]: allowed }))
        toast.success(allowed ? "Access enabled for admins" : "Access disabled for admins")
        return
      }

      // More helpful error messages based on status
      if (res.status === 401) {
        toast.error("You are not signed in as an admin.")
      } else if (res.status === 403) {
        toast.error("Only super admin can change page access.")
      } else {
        toast.error("Failed to update page access.")
      }
    } catch {
      toast.error("Failed to update page access.")
    } finally {
      setSavingPagePermission(null)
    }
  }

  // Check if current user has permission to delete
  const canDeleteAdmin = (admin: Admin) => {
    // Cannot delete yourself
    if (admin.id === currentUserId) return false;
    
    // Cannot delete if only one admin remains
    if (admins.length <= 1) return false;
    
    return true;
  };

  const handleSaveSystemSettings = async () => {
    setSavingSystemSettings(true)
    try {
      const res = await fetch("/api/admin/system-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_risk_before_submit: maxRiskBeforeSubmit,
          max_time_extension_minutes: maxTimeExtensionMinutes,
          enable_results_archive: enableResultsArchive,
          enable_student_results_portal: enableStudentResultsPortal,
          enable_student_teacher_chat: enableStudentTeacherChat,
          enable_realtime_features: enableRealtimeFeatures,
          student_current_results_mode: studentCurrentResultsMode,
        }),
      })
      if (res.ok) toast.success("Settings saved")
      else toast.error("Failed to save")
    } catch {
      toast.error("Failed to save")
    } finally {
      setSavingSystemSettings(false)
    }
  }

  if (loading) {
    return <PageSpinner />
  }

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 bg-transparent">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-3">
            <Settings className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Manage your school system preferences and configurations
            </p>
          </div>
        </div>
        {currentUserId && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
            <Shield className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-medium">
              {admins.find(a => a.id === currentUserId)?.username || "Admin"}
            </span>
            <Badge variant="outline" className="ml-2">
              Admin
            </Badge>
          </div>
        )}
      </div>

      {loading ? (
        <PageSpinner />
      ) : (
      <Tabs
        defaultValue={
          currentUserRole === "admin"
            ? "security"
            : "system"
        }
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto lg:inline-flex">
          {currentUserRole !== "admin" && (
            <>
              <TabsTrigger value="system" className="gap-2">
                <Database className="h-4 w-4" />
                <span className="hidden sm:inline">System</span>
              </TabsTrigger>
              <TabsTrigger value="backup" className="gap-2">
                <HardDrive className="h-4 w-4" />
                <span className="hidden sm:inline">Backup</span>
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="security" className="gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          {currentUserRole === "super_admin" && (
            <TabsTrigger value="admins" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Admins</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* System Tab */}
        {currentUserRole !== "admin" && (
        <TabsContent value="system" className="space-y-6">
          {/* Risk & Time Control Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                Risk & Time Control
              </CardTitle>
              <CardDescription>
                Configure max tab switches before auto-submit and max time extension teachers can add.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="maxRisk">Max risk count before auto-submit</Label>
                  <Input
                    id="maxRisk"
                    type="number"
                    min={1}
                    max={20}
                    value={maxRiskBeforeSubmit}
                    onChange={(e) => setMaxRiskBeforeSubmit(parseInt(e.target.value, 10) || 7)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Each tab switch increments risk_count. When it reaches this value, exam auto-submits. (Default: 7)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTimeExt">Max time extension (minutes)</Label>
                  <Input
                    id="maxTimeExt"
                    type="number"
                    min={0}
                    max={120}
                    value={maxTimeExtensionMinutes}
                    onChange={(e) => setMaxTimeExtensionMinutes(parseInt(e.target.value, 10) || 30)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Teachers cannot add more than this total per student. (Default: 30)
                  </p>
                </div>
              </div>
              <Button onClick={handleSaveSystemSettings} disabled={savingSystemSettings}>
                Save settings
              </Button>
            </CardContent>
          </Card>

          {/* Results + Student Features Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-600" />
                Results & Student Features
              </CardTitle>
              <CardDescription>
                Enable archived results/transcripts and the student results portal. Control which current results students can see.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Results archive</p>
                    <p className="text-xs text-muted-foreground">Store year/semester snapshots & generate transcripts</p>
                  </div>
                  <Switch checked={enableResultsArchive} onCheckedChange={setEnableResultsArchive} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Student results portal</p>
                    <p className="text-xs text-muted-foreground">Students can view end-of-term/year results</p>
                  </div>
                  <Switch checked={enableStudentResultsPortal} onCheckedChange={setEnableStudentResultsPortal} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Current academic year</p>
                    <p className="text-xs text-muted-foreground">Read-only (locked)</p>
                  </div>
                  <Input className="w-32" value={currentAcademicYear || "—"} disabled />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Real-time mode</p>
                    <p className="text-xs text-muted-foreground">Archive, portal, and chat update live</p>
                  </div>
                  <Switch checked={enableRealtimeFeatures} onCheckedChange={setEnableRealtimeFeatures} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Show full year results to students</p>
                  <p className="text-xs text-muted-foreground">
                    Off: First semester only • On: Full year (includes first semester)
                  </p>
                </div>
                <Switch
                  checked={studentCurrentResultsMode === "full_year"}
                  onCheckedChange={(v) => setStudentCurrentResultsMode(v ? "full_year" : "semester_1")}
                />
              </div>

              <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
                <p className="text-xs text-muted-foreground">
                  Changes to these options affect what students can see in portals and transcripts.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveSystemSettings}
                  disabled={savingSystemSettings}
                  className="whitespace-nowrap"
                >
                  Save results settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Exam Session Data Card */}
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
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-center">
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{sessionStats.total}</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">Total Sessions</p>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-center">
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{sessionStats.inProgress}</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">In Progress</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-center">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">{sessionStats.submitted}</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Submitted</p>
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

          {/* Database tables management has been removed to keep focus on exam session data. */}
        </TabsContent>
        )}

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
              <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-300">Create Full Backup</h3>
                    <p className="text-sm text-indigo-700 dark:text-indigo-400 mt-1">Download all your school data as a JSON or CSV file</p>
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

              <div className="p-6 bg-slate-50 dark:bg-slate-900/10 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-300">Export Tables</h3>
                    <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">Export one or more database tables as CSV (default) or JSON</p>
                  </div>
                  <Button
                    onClick={() => setShowExportTablesDialog(true)}
                    variant="outline"
                    className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <TableIcon className="h-4 w-4" />
                    Export selected tables
                  </Button>
                </div>
              </div>

              <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-300">Restore from Backup</h3>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">Import data from a previously exported backup file</p>
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

              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-300">
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

        {/* Admins Tab (super admin only) */}
        {currentUserRole === "super_admin" && (
        <TabsContent value="admins" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  Admin Management
                </CardTitle>
                <CardDescription>Manage admin accounts and access</CardDescription>
              </div>
              <Button onClick={() => setShowAddAdmin(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Admin
              </Button>
            </CardHeader>
            <CardContent>
              {admins.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-zinc-900/50 rounded-lg border border-dashed border-gray-300 dark:border-zinc-700">
                  <Users className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Admins</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">Add a new admin</p>
                  <Button onClick={() => setShowAddAdmin(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Admin
                  </Button>
                </div>
              ) : (
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-muted-foreground">Super Admins</h3>
                      <Badge variant="secondary" className="text-xs">
                        {admins.filter((a) => (a.role ?? "super_admin") === "super_admin").length}
                      </Badge>
                    </div>
                    {admins.filter((a) => (a.role ?? "super_admin") === "super_admin").length === 0 ? (
                      <p className="text-xs text-muted-foreground">No super admin accounts.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {admins
                          .filter((admin) => (admin.role ?? "super_admin") === "super_admin")
                          .map((admin) => (
                            <div
                              key={admin.id}
                              className={`flex items-center justify-between p-4 rounded-lg border ${
                                admin.id === currentUserId 
                                  ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800' 
                                  : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800'
                              }`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium">{admin.full_name}</p>
                                  {admin.id === currentUserId && (
                                    <Badge variant="outline" className="text-xs">
                                      You
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">{admin.username}</p>
                                <p className="text-sm text-gray-500 truncate">{admin.email}</p>
                                {admin.phone_number && (
                                  <p className="text-xs text-gray-400 mt-1">{admin.phone_number}</p>
                                )}
                              </div>
                              {canDeleteAdmin(admin) ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteAdminClick(admin)}
                                  title="Delete admin"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : (
                                <div 
                                  className="h-8 w-8 flex items-center justify-center text-gray-400"
                                  title={
                                    admin.id === currentUserId 
                                      ? "Cannot delete your own account" 
                                      : "Cannot delete the last admin"
                                  }
                                >
                                  <ShieldAlert className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-muted-foreground">Admins</h3>
                      <Badge variant="outline" className="text-xs">
                        {admins.filter((a) => (a.role ?? "super_admin") === "admin").length}
                      </Badge>
                    </div>
                    {admins.filter((a) => (a.role ?? "super_admin") === "admin").length === 0 ? (
                      <p className="text-xs text-muted-foreground">No admin accounts.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {admins
                          .filter((admin) => (admin.role ?? "super_admin") === "admin")
                          .map((admin) => (
                            <div
                              key={admin.id}
                              className={`flex items-center justify-between p-4 rounded-lg border ${
                                admin.id === currentUserId 
                                  ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800' 
                                  : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800'
                              }`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium">{admin.full_name}</p>
                                  {admin.id === currentUserId && (
                                    <Badge variant="outline" className="text-xs">
                                      You
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">{admin.username}</p>
                                <p className="text-sm text-gray-500 truncate">{admin.email}</p>
                                {admin.phone_number && (
                                  <p className="text-xs text-gray-400 mt-1">{admin.phone_number}</p>
                                )}
                              </div>
                              {canDeleteAdmin(admin) ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteAdminClick(admin)}
                                  title="Delete admin"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : (
                                <div 
                                  className="h-8 w-8 flex items-center justify-center text-gray-400"
                                  title={
                                    admin.id === currentUserId 
                                      ? "Cannot delete your own account" 
                                      : "Cannot delete the last admin"
                                  }
                                >
                                  <ShieldAlert className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>


        </TabsContent>
        )}
      </Tabs>
      )}

      {/* Add Admin Drawer */}
      <Drawer open={showAddAdmin} onOpenChange={setShowAddAdmin}>
        <DrawerContent className="data-[vaul-drawer-direction=right]:sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>Add New Admin</DrawerTitle>
            <DrawerDescription>Create a new admin or super admin account</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[calc(100vh-8rem)]">
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={newAdminUsername}
                onChange={(e) => setNewAdminUsername(e.target.value)}
                placeholder="Enter username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={newAdminFullName}
                onChange={(e) => setNewAdminFullName(e.target.value)}
                placeholder="Enter full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="Enter email"
                required
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
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
              <p className="text-xs text-gray-500">Password must be at least 6 characters</p>
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <RadioGroup
                value={newAdminRole}
                onValueChange={(value) => setNewAdminRole(value as "super_admin" | "admin")}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <div className="flex items-center space-x-2 rounded-md border p-3">
                  <RadioGroupItem value="admin" id="role-admin" />
                  <div className="space-y-1">
                    <Label htmlFor="role-admin" className="text-sm font-medium">
                      Admin
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Limited access. Cannot open Dashboard Home, Settings, or Teacher Create, but can use other pages.
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 rounded-md border p-3">
                  <RadioGroupItem value="super_admin" id="role-super-admin" />
                  <div className="space-y-1">
                    <Label htmlFor="role-super-admin" className="text-sm font-medium">
                      Super Admin
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Full access to all admin features, including managing other admins.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DrawerFooter className="border-t">
            <DrawerClose asChild>
              <Button variant="outline">
                Cancel
              </Button>
            </DrawerClose>
            <Button
              onClick={handleAddAdmin}
              disabled={
                !newAdminUsername ||
                !newAdminFullName ||
                !newAdminEmail ||
                !newAdminPassword
              }
            >
              Add Admin
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Delete Admin Confirmation */}
      <Dialog open={deleteAdminConfirmOpen} onOpenChange={setDeleteAdminConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Admin
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete admin "{adminToDelete?.full_name}"?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            
            {/* Admin Info */}
            {adminToDelete && (
              <div className="p-3 bg-gray-50 dark:bg-zinc-900/50 rounded-lg border border-gray-200 dark:border-zinc-800">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Admin Details:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Name:</p>
                    <p className="font-medium">{adminToDelete.full_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Username:</p>
                    <p className="font-medium">{adminToDelete.username}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Email:</p>
                    <p className="font-medium">{adminToDelete.email}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Confirmation Input */}
            <div className="space-y-2">
              <Label htmlFor="confirm-delete" className="text-sm font-medium">
                Type <span className="font-bold text-red-600">DELETE</span> to confirm:
              </Label>
              <Input
                id="confirm-delete"
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value.toUpperCase())}
                placeholder="Type DELETE"
                className="border-red-200 focus:border-red-500 uppercase"
                autoComplete="off"
              />
              <p className="text-xs text-gray-500">
                This extra step prevents accidental deletions
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteAdminConfirmOpen(false);
                setAdminToDelete(null);
                setConfirmDeleteText("");
              }}
              disabled={deleteAdminLoading}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDeleteAdmin} 
              disabled={
                deleteAdminLoading || 
                confirmDeleteText !== "DELETE"
              }
              className="gap-2 min-w-[140px]"
            >
              {deleteAdminLoading ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Admin
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Table Dialog */}
      <Dialog open={showDeleteTableDialog} onOpenChange={setShowDeleteTableDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Table Data
            </DialogTitle>
            <DialogDescription>
              Delete all data from "{tableToDelete?.name}" table
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            
            {/* Table Info */}
            {tableToDelete && (
              <div className="p-3 bg-gray-50 dark:bg-zinc-900/50 rounded-lg border border-gray-200 dark:border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${tableToDelete.color}`}>
                    <tableToDelete.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">{tableToDelete.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{tableToDelete.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Records:</p>
                    <p className="font-medium">{tableToDelete.count.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status:</p>
                    <p className="font-medium">
                      {tableToDelete.name === "admin" ? "Protected" : "System Table"}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Special note for admin table */}
            {tableToDelete?.name === "admin" && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-semibold">Note:</p>
                    <p>Your current admin account will be preserved. Only other admin accounts will be deleted.</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Warning */}
            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-500 mt-0.5 shrink-0" />
                <div className="text-sm text-red-800 dark:text-red-300">
                  <p className="font-semibold">Warning:</p>
                  <p>This action is permanent and cannot be undone. All data in this table will be deleted.</p>
                </div>
              </div>
            </div>
            
            {/* Confirmation Input */}
            <div className="space-y-2">
              <Label htmlFor="confirm-delete-table" className="text-sm font-medium">
                Type <span className="font-bold text-red-600">DELETE-{tableToDelete?.name.toUpperCase()}</span> to confirm:
              </Label>
              <Input
                id="confirm-delete-table"
                value={confirmDeleteTableText}
                onChange={(e) => setConfirmDeleteTableText(e.target.value.toUpperCase())}
                placeholder={`Type DELETE-${tableToDelete?.name.toUpperCase()}`}
                className="border-red-200 focus:border-red-500 uppercase"
                autoComplete="off"
              />
              <p className="text-xs text-gray-500">
                This extra step prevents accidental deletions
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteTableDialog(false);
                setTableToDelete(null);
                setConfirmDeleteTableText("");
              }}
              disabled={deletingTableLoading}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteTable} 
              disabled={
                deletingTableLoading || 
                confirmDeleteTableText !== `DELETE-${tableToDelete?.name.toUpperCase()}`
              }
              className="gap-2 min-w-[140px]"
            >
              {deletingTableLoading ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete All Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Multiple Tables Dialog */}
      <Dialog open={showDeleteMultipleDialog} onOpenChange={setShowDeleteMultipleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Multiple Tables Data
            </DialogTitle>
            <DialogDescription>
              Delete all data from {selectedTables.length} selected table{selectedTables.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            
            {/* Selection Info */}
            <div className="p-3 bg-gray-50 dark:bg-zinc-900/50 rounded-lg border border-gray-200 dark:border-zinc-800">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Selected Tables:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-500">Tables:</p>
                  <p className="font-medium">{selectedTables.length}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total Records:</p>
                  <p className="font-medium">{totalSelectedRecords.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1">Tables list:</p>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1">
                  {selectedTables.map(tableName => (
                    <Badge key={tableName} variant="outline" className="bg-white dark:bg-zinc-900 text-xs">
                      {tableName}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Special note if admin table is selected */}
            {selectedTables.includes("admin") && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-semibold">Note:</p>
                    <p>Your current admin account will be preserved. Only other admin accounts will be deleted.</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Warning */}
            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-500 mt-0.5 shrink-0" />
                <div className="text-sm text-red-800 dark:text-red-300">
                  <p className="font-semibold">Warning:</p>
                  <p>This action is permanent and cannot be undone. All data in selected tables will be deleted.</p>
                </div>
              </div>
            </div>
            
            {/* Confirmation Input */}
            <div className="space-y-2">
              <Label htmlFor="confirm-delete-multiple" className="text-sm font-medium">
                Type <span className="font-bold text-red-600">DELETE-ALL</span> to confirm:
              </Label>
              <Input
                id="confirm-delete-multiple"
                value={confirmDeleteTableText}
                onChange={(e) => setConfirmDeleteTableText(e.target.value.toUpperCase())}
                placeholder="Type DELETE-ALL"
                className="border-red-200 focus:border-red-500 uppercase"
                autoComplete="off"
              />
              <p className="text-xs text-gray-500">
                This extra step prevents accidental mass deletions
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteMultipleDialog(false);
                setConfirmDeleteTableText("");
              }}
              disabled={deletingMultipleLoading}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteMultipleTables} 
              disabled={
                deletingMultipleLoading || 
                confirmDeleteTableText !== "DELETE-ALL"
              }
              className="gap-2 min-w-[140px]"
            >
              {deletingMultipleLoading ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete {selectedTables.length} Table{selectedTables.length !== 1 ? 's' : ''}
                </>
              )}
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
            <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg space-y-2">
              <p className="text-sm text-red-800 dark:text-red-300 font-semibold">This action will delete:</p>
              <ul className="text-sm text-red-800 dark:text-red-300 list-disc list-inside">
                <li>{sessionStats.total} exam sessions</li>
                <li>All associated student answers</li>
                <li>Session progress data</li>
              </ul>
              <p className="text-sm text-red-800 dark:text-red-300 font-semibold mt-2">Note: Results and grades will NOT be affected.</p>
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

      {/* Export selected tables Dialog */}
      <Dialog open={showExportTablesDialog} onOpenChange={setShowExportTablesDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TableIcon className="h-5 w-5 text-indigo-600" />
              Export tables
            </DialogTitle>
            <DialogDescription>
              Select one or more tables to export. Default format is CSV.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Format</Label>
              <RadioGroup
                value={exportTablesFormat}
                onValueChange={(v) => setExportTablesFormat(v as "json" | "csv")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="export-tables-csv" />
                  <Label htmlFor="export-tables-csv" className="flex items-center gap-2 cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    CSV (default)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="json" id="export-tables-json" />
                  <Label htmlFor="export-tables-json" className="flex items-center gap-2 cursor-pointer">
                    <FileJson className="h-4 w-4 text-blue-600" />
                    JSON
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tables to export</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-md border p-3 bg-muted/30">
                {tables.map((table) => (
                  <div
                    key={table.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setExportTableSelection((prev) =>
                        prev.includes(table.name)
                          ? prev.filter((t) => t !== table.name)
                          : [...prev, table.name]
                      )
                    }}
                    onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLElement).click()}
                    className={`
                      flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors
                      ${exportTableSelection.includes(table.name)
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                        : "border-border hover:bg-muted/50"
                      }
                    `}
                  >
                    <div className={`shrink-0 p-1.5 rounded ${table.color}`}>
                      <table.icon className="h-4 w-4" aria-hidden />
                    </div>
                    <span className="text-sm font-medium truncate">{table.name}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto tabular-nums">
                      {table.count}
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {exportTableSelection.length} table(s) selected
              </p>
            </div>
            {exportTablesLoading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Exporting...</span>
                  <span className="font-medium">{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} className="h-2" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExportTablesDialog(false)}
              disabled={exportTablesLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExportSelectedTables}
              disabled={exportTablesLoading || exportTableSelection.length === 0}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {exportTablesLoading ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export {exportTableSelection.length} table(s) as {exportTablesFormat.toUpperCase()}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Backup Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
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
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${isDragOver 
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-2' 
                    : importFile 
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10' 
                      : 'border-gray-300 dark:border-zinc-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {importFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className={`p-2 rounded-full ${importFile.name.endsWith(".csv") ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                      {importFile.name.endsWith(".csv") ? (
                        <FileSpreadsheet className="h-6 w-6 text-green-600 dark:text-green-400" />
                      ) : (
                        <FileJson className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{importFile.name}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{(importFile.size / 1024).toFixed(2)} KB</span>
                        <span>•</span>
                        <span>{importFile.type || 'Backup file'}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImportFile(null);
                        setImportPreview(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3">
                      {isDragOver ? (
                        <Upload className="h-10 w-10 text-emerald-500 mx-auto animate-pulse" />
                      ) : (
                        <>
                          <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 mb-1">
                            <span className="font-medium text-emerald-600">Click to select</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-400">JSON or CSV files up to 50MB</p>
                        </>
                      )}
                    </div>
                    {isDragOver && (
                      <p className="text-emerald-600 text-sm font-medium animate-pulse">
                        Drop your file here...
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              {/* File format info */}
              {!importFile && !isDragOver && (
                <div className="flex items-center justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <FileJson className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-gray-500">JSON</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-gray-500">CSV</span>
                  </div>
                </div>
              )}
            </div>

            {/* Import Preview */}
            {importPreview && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-200 dark:border-emerald-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-300">Backup Contents Preview</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white dark:bg-zinc-900 p-3 rounded border dark:border-zinc-800">
                    <p className="text-xs text-gray-500">Tables</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{importPreview.tables.length}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-3 rounded border dark:border-zinc-800">
                    <p className="text-xs text-gray-500">Records</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{importPreview.recordCount.toLocaleString()}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-gray-500 mb-2">Included Tables:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {importPreview.tables.slice(0, 8).map((tableName) => (
                      <Badge key={tableName} variant="outline" className="bg-white dark:bg-zinc-900 text-xs">
                        {tableName}
                      </Badge>
                    ))}
                    {importPreview.tables.length > 8 && (
                      <Badge variant="outline" className="bg-white dark:bg-zinc-900 text-xs">
                        +{importPreview.tables.length - 8} more
                      </Badge>
                    )}
                  </div>
                </div>
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
                <p className="text-xs text-gray-500 text-center">
                  Please don't close this window during import
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false);
                setImportFile(null);
                setImportPreview(null);
                setIsDragOver(false);
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
                  Importing... ({importProgress}%)
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
