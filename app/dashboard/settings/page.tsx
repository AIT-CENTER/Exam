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

interface Admin {
  id: string
  username: string
  full_name: string
  email: string
  phone_number?: string | null
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
  const [deleteAdminConfirmOpen, setDeleteAdminConfirmOpen] = useState(false)
  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null)
  const [deleteAdminLoading, setDeleteAdminLoading] = useState(false)
  const [confirmDeleteText, setConfirmDeleteText] = useState("")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Exam Sessions
  const [showDeleteSessionsDialog, setShowDeleteSessionsDialog] = useState(false)
  const [deletingSessionsLoading, setDeletingSessionsLoading] = useState(false)
  const [sessionStats, setSessionStats] = useState({ total: 0, inProgress: 0, submitted: 0 })

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
  const [showTablesList, setShowTablesList] = useState(true)

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
  const [isDragOver, setIsDragOver] = useState(false)

  const systemTables: TableInfo[] = [
    { name: "students", icon: User, description: "Student records and information", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    { name: "teacher", icon: Users, description: "Teacher accounts and details", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    { name: "grades", icon: GraduationCap, description: "Grade levels and classes", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    { name: "subjects", icon: Book, description: "Subjects taught in school", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    { name: "exams", icon: FileText, description: "Exams and test papers", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    { name: "questions", icon: CheckSquare, description: "Exam questions and answers", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    { name: "exam_sessions", icon: Layers, description: "Active exam sessions", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
    { name: "student_answers", icon: CheckSquare, description: "Student exam answers", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
    { name: "assign_exams", icon: ClipboardList, description: "Assigned exams to students", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
    { name: "results", icon: BarChart, description: "Exam results and grades", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
    { name: "grade_sections", icon: Grid, description: "Grade sections and divisions", color: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400" },
    { name: "grade_subjects", icon: BookOpen, description: "Subjects per grade", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    { name: "images", icon: Image, description: "Uploaded images and files", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
    { name: "settings", icon: Settings, description: "System settings and config", color: "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300" },
  ]

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

  // File preview processing
  const processFilePreview = async (file: File) => {
    try {
      const content = await file.text();
      let parsedData: Record<string, any>;

      if (file.name.endsWith(".csv")) {
        parsedData = parseCSVToJSON(content);
      } else {
        parsedData = JSON.parse(content);
      }

      const tables = Object.keys(parsedData).filter((k) => k !== "metadata");
      let totalRecords = 0;
      tables.forEach((t) => {
        if (Array.isArray(parsedData[t])) {
          totalRecords += parsedData[t].length;
        }
      });

      setImportPreview({ tables, recordCount: totalRecords });
    } catch (err) {
      toast.error("Invalid backup file format");
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
      fetchTableStats()
    } catch (err) {
      console.error("Error importing backup:", err)
      toast.error("Failed to import backup")
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

  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      const fetchCurrentUser = async () => {
        const { data } = await supabase.auth.getUser()
        setCurrentUserId(data.user?.id || null)
      }
      await Promise.all([
        fetchCurrentUser(),
        fetchAdmins(),
        fetchSessionStats(),
        fetchTableStats()
      ]);
      setLoading(false);
    }
    loadAllData()
  }, [])

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
    setDeletingSessionsLoading(true);
    try {
      console.log("Deleting all exam session data...");
      
      // First delete student_answers table
      console.log("Deleting student_answers...");
      const { error: answersError } = await supabase
        .from('student_answers')
        .delete()
        .not('id', 'is', null);
      
      if (answersError) {
        console.error("Error deleting student_answers:", answersError);
        toast.error("Failed to delete student answers: " + answersError.message);
        setDeletingSessionsLoading(false);
        return;
      }
      
      console.log("Student answers deleted successfully");
      
      // Then delete exam_sessions table
      console.log("Deleting exam_sessions...");
      const { error: sessionsError } = await supabase
        .from('exam_sessions')
        .delete()
        .not('id', 'is', null);
      
      if (sessionsError) {
        console.error("Error deleting exam_sessions:", sessionsError);
        toast.error("Failed to delete exam sessions: " + sessionsError.message);
        setDeletingSessionsLoading(false);
        return;
      }
      
      console.log("Exam sessions deleted successfully");
      
      toast.success("All exam session data deleted successfully!");
      setShowDeleteSessionsDialog(false);
      fetchSessionStats();
      fetchTableStats();
    } catch (err) {
      console.error("Error deleting sessions:", err);
      toast.error("Failed to delete exam sessions: " + (err as Error).message);
    } finally {
      setDeletingSessionsLoading(false);
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

  // Calculate total selected records
  const totalSelectedRecords = selectedTables.reduce((total, tableName) => {
    return total + (tableStats[tableName] || 0)
  }, 0)

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

          {/* Database Tables Card */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TableIcon className="h-5 w-5 text-indigo-600" />
                    Database Tables
                  </CardTitle>
                  <CardDescription>Select and manage multiple tables at once</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTablesList(!showTablesList)}
                    className="gap-2"
                  >
                    {showTablesList ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Hide List
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Show List
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="gap-2"
                  >
                    {selectAllTables ? (
                      <>
                        <X className="h-4 w-4" />
                        Deselect All
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Select All
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Selection Summary */}
              <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-indigo-900 dark:text-indigo-300">Selection Summary</h3>
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-indigo-600 dark:bg-indigo-400"></div>
                        <span className="text-sm text-indigo-700 dark:text-indigo-400">
                          {selectedTables.length} table{selectedTables.length !== 1 ? 's' : ''} selected
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-green-600 dark:bg-green-400"></div>
                        <span className="text-sm text-green-700 dark:text-green-400">
                          {totalSelectedRecords.toLocaleString()} total records
                        </span>
                      </div>
                    </div>
                    {selectedTables.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">Selected tables:</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedTables.map(tableName => (
                            <Badge key={tableName} variant="outline" className="bg-white dark:bg-zinc-900">
                              {tableName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:items-end gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (selectedTables.length === 0) {
                          toast.error("Please select at least one table")
                        } else {
                          setShowDeleteMultipleDialog(true)
                        }
                      }}
                      disabled={selectedTables.length === 0}
                      className="gap-2 whitespace-nowrap"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Selected ({selectedTables.length})
                    </Button>
                    <p className="text-xs text-gray-500 text-center sm:text-right">
                      {selectedTables.length === 0 ? "Select tables to enable deletion" : "Will delete all data from selected tables"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tables List */}
              {showTablesList && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tables.map((table) => (
                      <div
                        key={table.name}
                        className={`p-4 rounded-lg border ${table.selected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-zinc-900 border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/80'} transition-all cursor-pointer`}
                        onClick={() => handleTableSelect(table.name)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${table.color}`}>
                              <table.icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{table.name}</h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{table.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`h-4 w-4 rounded-full border-2 ${table.selected ? 'bg-indigo-600 border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500' : 'border-gray-300 dark:border-zinc-700'}`}>
                              {table.selected && <Check className="h-3 w-3 text-white" />}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <Badge variant="outline" className={table.count === 0 ? "text-gray-500 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"}>
                            {table.count.toLocaleString()} records
                          </Badge>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTableClick(table);
                              }}
                              disabled={table.count === 0}
                              className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <Badge variant="outline" className="text-xs">
                              {table.name === "admin" ? "Protected" : "System"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800 dark:text-amber-300">
                        <p className="font-semibold">Important Notes:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Click on any table to select/deselect it</li>
                          <li>Deleting data from tables is permanent and cannot be undone</li>
                          <li>Admin table deletion will preserve your current account</li>
                          <li>Some tables may have foreign key constraints</li>
                          <li>Always backup before deleting large amounts of data</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {admins.map((admin) => (
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAdmin(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAdmin} disabled={!newAdminUsername || !newAdminFullName || !newAdminEmail || !newAdminPassword}>
              Add Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
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
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-500 mt-0.5 flex-shrink-0" />
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
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
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
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-500 mt-0.5 flex-shrink-0" />
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