"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Download, Eye } from "lucide-react"

interface StudentDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: {
    id: string
    student_id: string
    student_name: string
    student_phone?: string
    exam_name: string
    exam_id: string
    score: number
    status: "passed" | "failed"
    submitted_at: string
    passing_score: number
  } | null
  onViewPDF?: (student: any) => void
  onDownloadPDF?: (student: any) => void
}

export function StudentDetailModal({ open, onOpenChange, student, onViewPDF, onDownloadPDF }: StudentDetailModalProps) {
  if (!student) return null

  const isPassed = student.status === "passed"
  const statusColor = isPassed
    ? "bg-green-100 text-green-700 border-green-200"
    : "bg-red-100 text-red-700 border-red-200"

  const statusBgColor = isPassed ? "bg-green-50" : "bg-red-50"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4 pb-6 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <DialogTitle className="text-2xl">Student Exam Details</DialogTitle>
              <DialogDescription>Complete submission and performance information</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Student Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Student Information
            </h3>
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="text-lg font-semibold">{student.student_name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-lg">{student.student_name}</p>
                <p className="text-sm text-muted-foreground">{student.student_id}</p>
              </div>
            </div>
            {student.student_phone && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{student.student_phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date Submitted</p>
                  <p className="font-medium">{new Date(student.submitted_at).toLocaleDateString()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Exam Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Exam Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/20">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Exam Name</p>
                <p className="font-semibold text-base">{student.exam_name}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/20">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Exam ID</p>
                <p className="font-mono text-base">{student.exam_id}</p>
              </div>
            </div>
          </div>

          {/* Score & Status Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Performance Metrics
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg ${statusBgColor}`}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Score</p>
                <p className="text-3xl font-bold">{student.score.toFixed(1)}%</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/20">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Passing Score</p>
                <p className="text-3xl font-bold">{student.passing_score}%</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/20 flex items-end">
                <Badge className={`${statusColor} border w-full justify-center py-2`}>
                  {student.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <span className="font-semibold">Certificate ID:</span> {student.id.substring(0, 12)}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
          {onViewPDF && (
            <Button variant="outline" className="flex-1 bg-transparent" onClick={() => onViewPDF(student)}>
              <Eye className="h-4 w-4 mr-2" />
              View Certificate
            </Button>
          )}
          {onDownloadPDF && (
            <Button variant="default" className="flex-1" onClick={() => onDownloadPDF(student)}>
              <Download className="h-4 w-4 mr-2" />
              Download Certificate
            </Button>
          )}
          <Button variant="ghost" className="flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
