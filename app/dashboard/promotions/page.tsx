"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { AlertCircle, Loader2, Search, ChevronLeft, ChevronRight, ArrowUp } from "lucide-react";
import { StudentSelectionPanel } from "@/components/promotions/StudentSelectionPanel";
import { PromotionDialogModal } from "@/components/promotions/PromotionDialogModal";
import { usePromotionState, GradeInfo } from "@/hooks/usePromotionState";
import { useStudentFetching } from "@/hooks/useStudentFetching";

interface SuperAdminSettings {
  promotionEnabled: boolean;
}

export default function PromotionsPage() {
  const router = useRouter();
  const promotion = usePromotionState();
  const students = useStudentFetching();

  // State for feature flags and settings
  const [superAdminSettings, setSuperAdminSettings] = useState<SuperAdminSettings | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Grades state
  const [grades, setGrades] = useState<GradeInfo[]>([]);
  const [gradesLoading, setGradesLoading] = useState(true);

  // Filter state
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [sectionFilter, setSectionFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Dialog state
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);

  // Check if user is super admin and fetch settings
  useEffect(() => {
    const checkSuperAdminStatus = async () => {
      try {
        const response = await fetch("/api/admin/super-admin-settings", {
          cache: "no-store",
        });

        if (response.ok) {
          const data = await response.json();
          setIsSuperAdmin(true);
          setSuperAdminSettings(data);
        } else {
          setIsSuperAdmin(false);
        }
      } catch (err) {
        console.error("Failed to check super admin status:", err);
        setIsSuperAdmin(false);
      } finally {
        setSettingsLoading(false);
      }
    };

    checkSuperAdminStatus();
  }, []);

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
        toast.error("Failed to load grades");
      } finally {
        setGradesLoading(false);
      }
    };

    fetchGrades();
  }, []);

  // Fetch students with filters
  useEffect(() => {
    const params: Record<string, string | number> = {
      page: students.state.page,
      limit: 20,
    };

    if (searchQuery) params.search = searchQuery;
    if (gradeFilter) params.grade = gradeFilter;

    students.fetchStudents(params);
  }, [students.state.page, searchQuery, gradeFilter]);

  // Get available sections from current students
  const availableSections = useMemo(() => {
    const sections = new Set<string>();
    students.students.forEach((s) => {
      if (s.section) sections.add(s.section);
    });
    return Array.from(sections).sort();
  }, [students.students]);

  // Filter students by section
  const filteredStudents = useMemo(() => {
    if (!sectionFilter) return students.students;
    return students.students.filter((s) => s.section === sectionFilter);
  }, [students.students, sectionFilter]);

  // Calculate pagination for filtered results
  const itemsPerPage = 20;
  const totalFilteredItems = filteredStudents.length;
  const totalFilteredPages = Math.ceil(totalFilteredItems / itemsPerPage);

  const paginatedStudents = useMemo(() => {
    const startIdx = (students.state.page - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    return filteredStudents.slice(startIdx, endIdx);
  }, [filteredStudents, students.state.page]);

  const selectedStudents = useMemo(
    () => students.students.filter((s) => promotion.state.selectedStudentIds.has(s.id)),
    [students.students, promotion.state.selectedStudentIds]
  );

  const handleToggleStudent = (studentId: number) => {
    promotion.toggleStudentSelection(studentId);
  };

  const handleSelectAll = () => {
    promotion.selectAllStudents(paginatedStudents.map((s) => s.id));
  };

  const handleDeselectAll = () => {
    promotion.deselectAllStudents();
  };

  const handleResetFilters = () => {
    setGradeFilter("");
    setSectionFilter("");
    setSearchQuery("");
    students.setState({
      ...students.state,
      page: 1,
    });
  };

  const handlePromoteClick = () => {
    if (selectedStudents.length === 0) {
      toast.error("Please select at least one student");
      return;
    }
    setShowPromotionDialog(true);
  };

  // Check if promotion is enabled
  const isPromotionEnabled = isSuperAdmin && superAdminSettings?.promotionEnabled;

  if (settingsLoading || gradesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
          <p className="text-sm text-zinc-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ArrowUp className="h-6 w-6 text-blue-600" />
          <h1 className="text-3xl font-bold">Student Promotions</h1>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400">
          Manage student grade advancements and stream assignments
        </p>
      </div>

      {/* Permission Alert */}
      {!isSuperAdmin && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">Limited Access</h3>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Student promotion features are only accessible to Super Administrators.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feature Disabled Alert */}
      {isSuperAdmin && !isPromotionEnabled && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Feature Disabled</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                The promotion feature is currently disabled. Enable it in system settings to proceed.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content - Only show if Super Admin and promotion is enabled */}
      {isSuperAdmin && isPromotionEnabled && (
        <div className="space-y-6">
          {/* Filters Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      id="search"
                      placeholder="Name or ID..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        students.setState({ ...students.state, page: 1 });
                      }}
                      disabled={students.state.loading}
                    />
                  </div>
                </div>

                {/* Grade Filter */}
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade</Label>
                  <Select value={gradeFilter} onValueChange={(value) => {
                    setGradeFilter(value);
                    students.setState({ ...students.state, page: 1 });
                  }}>
                    <SelectTrigger id="grade" disabled={students.state.loading}>
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
                  <Label htmlFor="section">Section</Label>
                  <Select value={sectionFilter} onValueChange={setSectionFilter}>
                    <SelectTrigger id="section" disabled={students.state.loading || availableSections.length === 0}>
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
                    disabled={students.state.loading}
                    className="w-full"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Students Table */}
          <StudentSelectionPanel
            students={paginatedStudents}
            loading={students.state.loading}
            selectedStudentIds={promotion.state.selectedStudentIds}
            page={students.state.page}
            totalPages={totalFilteredPages}
            onToggleStudent={handleToggleStudent}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onSearch={() => {}} // Search is handled via state
            onPageChange={(page) => students.setState({ ...students.state, page })}
            selectedCount={selectedStudents.length}
          />

          {/* Action Bar */}
          {selectedStudents.length > 0 && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-100">
                    {selectedStudents.length} student{selectedStudents.length !== 1 ? "s" : ""} selected
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Ready to promote selected students
                  </p>
                </div>
                <Button
                  onClick={handlePromoteClick}
                  disabled={selectedStudents.length === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Promote Selected
                </Button>
              </CardContent>
            </Card>
          )}

          {/* No Students Message */}
          {!students.state.loading && paginatedStudents.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                <AlertCircle className="h-10 w-10 text-zinc-400" />
                <p className="text-zinc-600 dark:text-zinc-400">No students found matching your filters</p>
              </CardContent>
            </Card>
          )}

          {/* Error Message */}
          {students.state.error && (
            <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
              <CardContent className="flex items-start gap-3 pt-6">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-100">Error</h3>
                  <p className="text-sm text-red-800 dark:text-red-200">{students.state.error}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Promotion Dialog Modal */}
      {isSuperAdmin && isPromotionEnabled && (
        <PromotionDialogModal
          open={showPromotionDialog}
          onOpenChange={setShowPromotionDialog}
          selectedStudents={selectedStudents}
          grades={grades}
          onPromotionComplete={() => {
            setShowPromotionDialog(false);
            promotion.deselectAllStudents();
            students.fetchStudents({
              page: students.state.page,
              limit: 20,
            });
          }}
        />
      )}
    </div>
  );
}
