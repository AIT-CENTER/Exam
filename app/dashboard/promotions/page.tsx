"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowRight, AlertCircle, Loader2, Users, GraduationCap } from "lucide-react";
import { StudentSelectionPanel } from "@/components/promotions/StudentSelectionPanel";
import { PromotionConfigPanel } from "@/components/promotions/PromotionConfigPanel";
import { ConfirmationDialog } from "@/components/promotions/ConfirmationDialog";
import { usePromotionState, GradeInfo } from "@/hooks/usePromotionState";
import { useStudentFetching } from "@/hooks/useStudentFetching";

// Loading spinner component
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

export default function PromotionsPage() {
  const router = useRouter();
  const promotion = usePromotionState();
  const students = useStudentFetching();

  const [grades, setGrades] = useState<GradeInfo[]>([]);
  const [gradesLoading, setGradesLoading] = useState(true);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

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
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setGradeError(errorMessage);
        toast.error("Failed to load grades: " + errorMessage);
      } finally {
        setGradesLoading(false);
      }
    };

    fetchGrades();
  }, []);

  const selectedStudents = useMemo(
    () => students.students.filter((s) => promotion.state.selectedStudentIds.has(s.id)),
    [students.students, promotion.state.selectedStudentIds]
  );

  const targetGrade = useMemo(
    () => grades.find((g) => g.id === promotion.state.targetGradeId),
    [grades, promotion.state.targetGradeId]
  );

  const canProceedToConfirmation = useMemo(() => {
    return (
      selectedStudents.length > 0 &&
      promotion.state.targetGradeId !== null &&
      promotion.isAllStreamsAssigned(targetGrade?.hasStream ?? false)
    );
  }, [selectedStudents, promotion.state.targetGradeId, targetGrade, promotion]);

  const handleConfirmPromotions = async () => {
    if (!canProceedToConfirmation) {
      toast.error("Please complete all required fields");
      return;
    }

    setIsExecuting(true);
    try {
      const promotions = selectedStudents.map((student) => ({
        studentId: student.id,
        targetGradeId: promotion.state.targetGradeId!,
        targetStream: promotion.getStreamForStudent(student.id),
      }));

      const response = await fetch("/api/admin/promotions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promotions }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to execute promotions");
      }

      const data = await response.json();

      setShowConfirmation(false);
      toast.success(`Successfully promoted ${data.updatedStudents.length} student(s)`);

      // Reset form and refetch students
      promotion.reset();
      students.refetch();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      toast.error("Promotion failed: " + errorMessage);
      console.error("[promotions] error:", err);
    } finally {
      setIsExecuting(false);
    }
  };

  if (students.loading && gradesLoading) {
    return <PageSpinner />;
  }

  if (students.error) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              <span>{students.error}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold">Student Promotions</h1>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400">
          Manage bulk student grade level promotions with optional stream assignments
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Left: Student Selection */}
        <StudentSelectionPanel
          students={students.students}
          loading={students.loading}
          selectedStudentIds={promotion.state.selectedStudentIds}
          page={students.page}
          totalPages={students.totalPages}
          onToggleStudent={promotion.toggleStudentSelection}
          onSelectAll={promotion.selectAllStudents}
          onDeselectAll={promotion.deselectAllStudents}
          onSearch={students.setSearch}
          onPageChange={students.setPage}
        />

        {/* Middle: Configuration */}
        <PromotionConfigPanel
          students={students.students}
          grades={grades}
          targetGradeId={promotion.state.targetGradeId}
          bulkStream={promotion.state.bulkStream}
          getStreamForStudent={promotion.getStreamForStudent}
          selectedStudentIds={promotion.state.selectedStudentIds}
          onTargetGradeChange={promotion.setTargetGrade}
          onBulkStreamChange={promotion.setBulkStream}
          onStreamChange={promotion.setStreamForStudent}
        />

        {/* Right: Summary & Action */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Review and proceed with promotions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selected Count */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                  Selected Students
                </p>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-3xl font-bold">{selectedStudents.length}</span>
                </div>
              </div>

              {/* Target Grade */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                  Target Grade
                </p>
                {targetGrade ? (
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="text-lg font-semibold">{targetGrade.name}</span>
                  </div>
                ) : (
                  <p className="text-zinc-500 dark:text-zinc-400">Not selected</p>
                )}
              </div>

              {/* Stream Info */}
              {targetGrade?.hasStream && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                    Stream Assignment
                  </p>
                  {promotion.state.bulkStream ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded-full text-sm font-medium">
                        {promotion.state.bulkStream}
                      </span>
                      <span className="text-xs text-zinc-500">
                        ({promotion.isAllStreamsAssigned(true) ? "Complete" : "Incomplete"})
                      </span>
                    </div>
                  ) : (
                    <p className="text-zinc-500 dark:text-zinc-400">Individual assignment</p>
                  )}
                </div>
              )}

              {/* Validation Messages */}
              {selectedStudents.length === 0 && (
                <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Select at least one student</span>
                </div>
              )}

              {selectedStudents.length > 0 && !targetGrade && (
                <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Select a target grade</span>
                </div>
              )}

              {selectedStudents.length > 0 &&
                targetGrade?.hasStream &&
                !promotion.isAllStreamsAssigned(true) && (
                  <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>Assign streams to all students</span>
                  </div>
                )}
            </CardContent>
          </div>

          {/* Action Button */}
          <CardContent className="pt-0 border-t mt-6">
            <Button
              onClick={() => setShowConfirmation(true)}
              disabled={!canProceedToConfirmation || gradesLoading}
              className="w-full gap-2"
              size="lg"
            >
              {gradesLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Review & Confirm
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmation}
        isLoading={isExecuting}
        selectedStudents={selectedStudents}
        targetGradeName={targetGrade?.name ?? null}
        getStreamForStudent={promotion.getStreamForStudent}
        onConfirm={handleConfirmPromotions}
        onCancel={() => setShowConfirmation(false)}
      />
    </div>
  );
}
