"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Student } from "@/hooks/usePromotionState";

interface ConfirmationDialogProps {
  isOpen: boolean;
  isLoading: boolean;
  selectedStudents: Student[];
  targetGradeName: string | null;
  getStreamForStudent: (studentId: number) => string | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function ConfirmationDialog({
  isOpen,
  isLoading,
  selectedStudents,
  targetGradeName,
  getStreamForStudent,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Review Promotions</DialogTitle>
          <DialogDescription>
            Please review the following promotion details before confirming. This action cannot be undone easily.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4">
          {/* Summary */}
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
              <CheckCircle2 className="h-4 w-4" />
              Promotion Summary
            </div>
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p>
                You are about to promote <Badge variant="secondary">{selectedStudents.length}</Badge> student(s) to{" "}
                <Badge variant="secondary">{targetGradeName || "Unknown"}</Badge>
              </p>
            </div>
          </div>

          {/* Data Persistence Notice */}
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-semibold mb-1">Important Notice</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>Student grade levels will be updated immediately</li>
                  <li>Previous exam results remain in original grade records</li>
                  <li>Historical data is preserved for audit purposes</li>
                  <li>All changes will be logged in the system audit trail</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Students Table */}
          <div className="border rounded-lg">
            <ScrollArea className="h-96">
              <Table>
                <TableHeader className="sticky top-0 bg-zinc-50 dark:bg-zinc-950">
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Current Grade</TableHead>
                    <TableHead>Target Grade</TableHead>
                    <TableHead>Stream</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedStudents.map((student, idx) => (
                    <TableRow key={student.id}>
                      <TableCell className="text-xs text-zinc-500">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{student.student_id}</TableCell>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{student.grade_name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge>{targetGradeName}</Badge>
                      </TableCell>
                      <TableCell>
                        {getStreamForStudent(student.id) ? (
                          <Badge variant="secondary">{getStreamForStudent(student.id)}</Badge>
                        ) : (
                          <span className="text-zinc-400 text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || selectedStudents.length === 0}
            className="gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? "Promoting..." : "Confirm Promotions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
