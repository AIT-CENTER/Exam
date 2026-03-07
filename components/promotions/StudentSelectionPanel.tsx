"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Student } from "@/hooks/usePromotionState";

interface StudentSelectionPanelProps {
  students: Student[];
  loading: boolean;
  selectedStudentIds: Set<number>;
  page: number;
  totalPages: number;
  onToggleStudent: (studentId: number) => void;
  onSelectAll: (studentIds: number[]) => void;
  onDeselectAll: () => void;
  onSearch: (query: string) => void;
  onPageChange: (page: number) => void;
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
  onSearch,
  onPageChange,
}: StudentSelectionPanelProps) {
  const isAllSelected = useMemo(
    () => students.length > 0 && students.every((s) => selectedStudentIds.has(s.id)),
    [students, selectedStudentIds]
  );

  const handleSelectAllChange = () => {
    if (isAllSelected) {
      onDeselectAll();
    } else {
      onSelectAll(students.map((s) => s.id));
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle>Student Selection</CardTitle>
        <CardDescription>
          Select students for promotion ({selectedStudentIds.size} selected)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 flex-1">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search by name or student ID..."
            className="pl-10"
            onChange={(e) => onSearch(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Students Table */}
        <div className="flex-1 overflow-auto border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-zinc-50 dark:bg-zinc-950">
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
                <TableHead>Current Grade</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Stream</TableHead>
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
                    className={selectedStudentIds.has(student.id) ? "bg-blue-50 dark:bg-blue-950" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedStudentIds.has(student.id)}
                        onCheckedChange={() => onToggleStudent(student.id)}
                        aria-label={`Select ${student.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm">{student.student_id}</TableCell>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{student.grade_name}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{student.section}</TableCell>
                    <TableCell className="text-sm">
                      {student.stream ? (
                        <Badge variant="secondary">{student.stream}</Badge>
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
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Page {page} of {totalPages}
            </div>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
