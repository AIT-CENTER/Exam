"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Student } from "@/hooks/usePromotionState";

interface StudentSelectionPanelProps {
  students: Student[];
  loading: boolean;
  selectedStudentIds: Set<number>;
  page: number;
  totalPages: number;
  onToggleStudent: (studentId: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSearch?: (query: string) => void;
  onPageChange: (page: number) => void;
  selectedCount: number;
}

export function StudentSelectionPanel({
  students,
  loading,
  selectedStudentIds,
  page,
  totalPages,
  onToggleStudent,
  onSelectAll,
  onDeselectAll,
  onPageChange,
  selectedCount,
}: StudentSelectionPanelProps) {
  const isAllSelected = useMemo(
    () => students.length > 0 && students.every((s) => selectedStudentIds.has(s.id)),
    [students, selectedStudentIds]
  );

  const handleSelectAllChange = () => {
    if (isAllSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student List</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">

        {/* Students Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50 dark:bg-zinc-950">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAllChange}
                    disabled={loading || students.length === 0}
                    aria-label="Select all students on this page"
                  />
                </TableHead>
                <TableHead>Student ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="hidden sm:table-cell">Stream</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading students...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
                    No students found
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow
                    key={student.id}
                    className={`cursor-pointer transition-colors ${
                      selectedStudentIds.has(student.id)
                        ? "bg-blue-50 dark:bg-blue-950"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <TableCell onClick={() => onToggleStudent(student.id)}>
                      <Checkbox
                        checked={selectedStudentIds.has(student.id)}
                        onCheckedChange={() => onToggleStudent(student.id)}
                        aria-label={`Select ${student.name}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm">{student.student_id}</TableCell>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{student.grade_name}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{student.section}</TableCell>
                    <TableCell className="text-sm hidden sm:table-cell">
                      {student.stream ? (
                        <Badge variant="secondary" className="text-xs">{student.stream}</Badge>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!loading && students.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Page <span className="font-semibold">{page}</span> of{" "}
              <span className="font-semibold">{totalPages}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1 || loading}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages || loading}
                className="gap-1"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
