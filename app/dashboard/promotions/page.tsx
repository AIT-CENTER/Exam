"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Loader2, Search, Lock } from "lucide-react";
import { StudentSelectionPanel } from "@/components/promotions/StudentSelectionPanel";
import { PromotionDialogModal } from "@/components/promotions/PromotionDialogModal";
import { usePromotionState, GradeInfo } from "@/hooks/usePromotionState";
import { useStudentFetching } from "@/hooks/useStudentFetching";
import { usePromotionFeature } from "@/hooks/usePromotionFeature";

export default function PromotionsPage() {
  const promotionState = usePromotionState();
  const studentFetching = useStudentFetching();
  const promotionFeature = usePromotionFeature();

  // Grades state
  const [grades, setGrades] = useState<GradeInfo[]>([]);
  const [gradesLoading, setGradesLoading] = useState(true);

  // Filter state
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [sectionFilter, setSectionFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Dialog state
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);

  // Fetch grades on mount
  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const response = await fetch("/api/admin/promotions/grades", {
          cache: "no-store",
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch grades");
        }

        const data = await response.json();
        setGrades(data.data || []);
      } catch (err) {
        console.error("Failed to load grades:", err);
      } finally {
        setGradesLoading(false);
      }
    };

    if (promotionFeature.canAccess) {
      fetchGrades();
    }
  }, [promotionFeature.canAccess]);

  // Fetch students with filters
  useEffect(() => {
    if (!promotionFeature.canAccess) return;

    const params: Record<string, string | number> = {
      page: studentFetching.state.page,
      limit: 20,
    };

    if (searchQuery) params.search = searchQuery;
    if (gradeFilter) params.grade = gradeFilter;

    studentFetching.fetchStudents(params);
  }, [
    studentFetching.state.page,
    searchQuery,
    gradeFilter,
    promotionFeature.canAccess,
  ]);

  // Get available sections from all students (use all loaded students)
  const availableSections = useMemo(() => {
    const sections = new Set<string>();
    studentFetching.state.students.forEach((s) => {
      if (s.section) sections.add(s.section);
    });
    return Array.from(sections).sort();
  }, [studentFetching.state.students]);

  // Filter students by section (client-side filtering)
  const filteredStudents = useMemo(() => {
    if (!sectionFilter) return studentFetching.state.students;
    return studentFetching.state.students.filter((s) => s.section === sectionFilter);
  }, [studentFetching.state.students, sectionFilter]);

  // Paginate filtered results
  const itemsPerPage = 20;
  const totalFilteredItems = filteredStudents.length;
  const totalFilteredPages = Math.ceil(totalFilteredItems / itemsPerPage);

  const paginatedStudents = useMemo(() => {
    const startIdx = (studentFetching.state.page - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    return filteredStudents.slice(startIdx, endIdx);
  }, [filteredStudents, studentFetching.state.page]);

  const selectedCount = promotionState.state.selectedStudentIds.size;

  const handleToggleStudent = (studentId: number) => {
    promotionState.toggleStudentSelection(studentId);
  };

  const handleSelectAll = () => {
    promotionState.selectAllStudents(paginatedStudents.map((s) => s.id));
  };

  const handleDeselectAll = () => {
    promotionState.deselectAllStudents();
  };

  const handleResetFilters = () => {
    setGradeFilter("");
    setSectionFilter("");
    setSearchQuery("");
    studentFetching.setState({
      ...studentFetching.state,
      page: 1,
    });
  };

  const handlePromoteClick = () => {
    if (selectedCount === 0) {
      toast.error("Please select at least one student");
      return;
    }
    setShowPromotionDialog(true);
  };

  // Show loading state
  if (promotionFeature.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
          <p className="text-sm text-zinc-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show access denied if not super admin
  if (!promotionFeature.isSuperAdmin) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Student Promotions</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Manage student grade advancements
          </p>
        </div>

        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardContent className="flex items-start gap-3 pt-6">
            <Lock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                Access Restricted
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Student promotion features are exclusively accessible to Super Administrators.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show feature disabled if promotion feature is not enabled
  if (!promotionFeature.isPromotionEnabled) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Student Promotions</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Manage student grade advancements
          </p>
        </div>

        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                Feature Disabled
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                The promotion feature is currently disabled by the Super Administrator. 
                Contact your system administrator to enable it.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main content - Super Admin with feature enabled
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Student Promotions</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Select students to advance to the next grade level
        </p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Search Input */}
            <div className="space-y-2">
              <Label htmlFor="search" className="text-sm">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="search"
                  placeholder="Name or ID..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    studentFetching.setState({
                      ...studentFetching.state,
                      page: 1,
                    });
                  }}
                  disabled={studentFetching.state.loading}
                />
              </div>
            </div>

            {/* Grade Filter */}
            <div className="space-y-2">
              <Label htmlFor="grade-filter" className="text-sm">
                Grade
              </Label>
              <Select
                value={gradeFilter}
                onValueChange={(value) => {
                  setGradeFilter(value);
                  studentFetching.setState({
                    ...studentFetching.state,
                    page: 1,
                  });
                }}
              >
                <SelectTrigger
                  id="grade-filter"
                  disabled={studentFetching.state.loading || gradesLoading}
                >
                  <SelectValue placeholder="All grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All grades</SelectItem>
                  {grades.map((grade) => (
                    <SelectItem key={grade.id} value={String(grade.id)}>
                      {grade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section Filter */}
            <div className="space-y-2">
              <Label htmlFor="section-filter" className="text-sm">
                Section
              </Label>
              <Select
                value={sectionFilter}
                onValueChange={setSectionFilter}
              >
                <SelectTrigger
                  id="section-filter"
                  disabled={
                    studentFetching.state.loading || availableSections.length === 0
                  }
                >
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All sections</SelectItem>
                  {availableSections.map((section) => (
                    <SelectItem key={section} value={section}>
                      {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reset Button */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleResetFilters}
                disabled={studentFetching.state.loading}
                className="w-full"
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student Selection Table */}
      <StudentSelectionPanel
        students={paginatedStudents}
        loading={studentFetching.state.loading}
        selectedStudentIds={promotionState.state.selectedStudentIds}
        page={studentFetching.state.page}
        totalPages={totalFilteredPages}
        onToggleStudent={handleToggleStudent}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onPageChange={(page) =>
          studentFetching.setState({
            ...studentFetching.state,
            page,
          })
        }
        selectedCount={selectedCount}
      />

      {/* Error Message */}
      {studentFetching.state.error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100">Error</h3>
              <p className="text-sm text-red-800 dark:text-red-200">
                {studentFetching.state.error}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Students Message */}
      {!studentFetching.state.loading &&
        paginatedStudents.length === 0 &&
        !studentFetching.state.error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
              <AlertCircle className="h-10 w-10 text-zinc-400" />
              <p className="text-zinc-600 dark:text-zinc-400">
                No students found matching your filters
              </p>
            </CardContent>
          </Card>
        )}

      {/* Promotion Action Bar */}
      {selectedCount > 0 && !studentFetching.state.loading && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 sticky bottom-6">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6">
            <div className="flex-1">
              <p className="font-semibold text-blue-900 dark:text-blue-100">
                {selectedCount} student{selectedCount !== 1 ? "s" : ""} selected
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Click promote to advance to the next grade level
              </p>
            </div>
            <Button
              onClick={handlePromoteClick}
              disabled={selectedCount === 0}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            >
              Promote Selected
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Promotion Dialog Modal */}
      <PromotionDialogModal
        open={showPromotionDialog}
        onOpenChange={setShowPromotionDialog}
        selectedStudents={Array.from(
          studentFetching.state.students.filter((s) =>
            promotionState.state.selectedStudentIds.has(s.id)
          )
        )}
        grades={grades}
        onPromotionComplete={() => {
          setShowPromotionDialog(false);
          promotionState.deselectAllStudents();
          studentFetching.fetchStudents({
            page: studentFetching.state.page,
            limit: 20,
          });
          toast.success("Students promoted successfully");
        }}
      />
    </div>
  );
}
