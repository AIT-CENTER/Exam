"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Student, GradeInfo } from "@/hooks/usePromotionState";

interface PromotionDialogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStudents: Student[];
  grades: GradeInfo[];
  onPromotionComplete: () => void;
}

type DialogStep = "select-grade" | "configure-streams" | "review" | "processing" | "success" | "error";

interface PromotionData {
  targetGradeId: number | null;
  streamAssignments: Map<number, string | null>;
  bulkStream: string | null;
}

export function PromotionDialogModal({
  open,
  onOpenChange,
  selectedStudents,
  grades,
  onPromotionComplete,
}: PromotionDialogModalProps) {
  const [currentStep, setCurrentStep] = useState<DialogStep>("select-grade");
  const [promotionData, setPromotionData] = useState<PromotionData>({
    targetGradeId: null,
    streamAssignments: new Map(),
    bulkStream: null,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successDetails, setSuccessDetails] = useState<{
    promoted: number;
    errors: string[];
  } | null>(null);

  const targetGrade = useMemo(
    () => grades.find((g) => g.id === promotionData.targetGradeId),
    [grades, promotionData.targetGradeId]
  );

  const needsStreamAssignment = targetGrade?.hasStream || false;

  const areAllStreamsAssigned = useMemo(() => {
    if (!needsStreamAssignment) return true;
    return selectedStudents.every(
      (s) => promotionData.streamAssignments.get(s.id) !== null
    );
  }, [needsStreamAssignment, selectedStudents, promotionData.streamAssignments]);

  const handleSelectGrade = (gradeId: string) => {
    const id = parseInt(gradeId);
    setPromotionData({
      ...promotionData,
      targetGradeId: id,
      streamAssignments: new Map(),
      bulkStream: null,
    });

    // Move to next step
    const nextGrade = grades.find((g) => g.id === id);
    if (nextGrade?.hasStream) {
      setCurrentStep("configure-streams");
    } else {
      setCurrentStep("review");
    }
  };

  const handleBulkStreamSelect = (stream: string) => {
    const newAssignments = new Map<number, string | null>();
    selectedStudents.forEach((s) => {
      newAssignments.set(s.id, stream);
    });
    setPromotionData({
      ...promotionData,
      streamAssignments: newAssignments,
      bulkStream: stream,
    });
  };

  const handleIndividualStreamChange = (studentId: number, stream: string) => {
    const newAssignments = new Map(promotionData.streamAssignments);
    newAssignments.set(studentId, stream);
    setPromotionData({
      ...promotionData,
      streamAssignments: newAssignments,
    });
  };

  const handleProceedToReview = () => {
    if (!areAllStreamsAssigned) {
      toast.error("Please assign a stream to all students");
      return;
    }
    setCurrentStep("review");
  };

  const handleConfirmPromotion = async () => {
    if (!promotionData.targetGradeId) {
      toast.error("Please select a target grade");
      return;
    }

    setCurrentStep("processing");

    try {
      const promotions = selectedStudents.map((student) => ({
        studentId: student.id,
        targetGradeId: promotionData.targetGradeId!,
        targetStream: promotionData.streamAssignments.get(student.id) || null,
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
      setCurrentStep("success");
      setSuccessDetails({
        promoted: data.updatedStudents?.length || 0,
        errors: data.errors || [],
      });
      toast.success(`Successfully promoted ${data.updatedStudents?.length || 0} student(s)`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setErrorMessage(errorMsg);
      setCurrentStep("error");
      toast.error("Promotion failed: " + errorMsg);
    }
  };

  const handleClose = () => {
    if (currentStep === "success" || currentStep === "error") {
      onPromotionComplete();
      onOpenChange(false);
      // Reset state
      setCurrentStep("select-grade");
      setPromotionData({
        targetGradeId: null,
        streamAssignments: new Map(),
        bulkStream: null,
      });
      setErrorMessage(null);
      setSuccessDetails(null);
    } else {
      onOpenChange(false);
      // Reset state
      setCurrentStep("select-grade");
      setPromotionData({
        targetGradeId: null,
        streamAssignments: new Map(),
        bulkStream: null,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {currentStep === "select-grade" && (
          <>
            <DialogHeader>
              <DialogTitle>Promote Students</DialogTitle>
              <DialogDescription>
                Select the target grade for {selectedStudents.length} student{selectedStudents.length !== 1 ? "s" : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 space-y-3">
                <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Students to Promote:
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedStudents.map((student) => (
                    <Badge key={student.id} variant="secondary">
                      {student.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Grade Selection */}
              <div className="space-y-3">
                <Label htmlFor="target-grade" className="text-base font-semibold">
                  Target Grade
                </Label>
                <Select onValueChange={handleSelectGrade}>
                  <SelectTrigger id="target-grade">
                    <SelectValue placeholder="Select a target grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map((grade) => (
                      <SelectItem key={grade.id} value={String(grade.id)}>
                        {grade.name}
                        {grade.hasStream && " (with streams)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {currentStep === "configure-streams" && targetGrade && (
          <>
            <DialogHeader>
              <DialogTitle>Configure Streams</DialogTitle>
              <DialogDescription>
                Assign streams for students in {targetGrade.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Bulk Stream Assignment */}
              {targetGrade.availableStreams.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <Label className="text-sm font-semibold mb-3 block">
                    Apply Stream to All Students
                  </Label>
                  <Select onValueChange={handleBulkStreamSelect} value={promotionData.bulkStream || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a stream for all" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetGrade.availableStreams.map((stream) => (
                        <SelectItem key={stream} value={stream}>
                          {stream}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Individual Stream Assignment */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Individual Stream Assignment</Label>
                <ScrollArea className="h-64 border rounded-lg p-4">
                  <div className="space-y-3">
                    {selectedStudents.map((student) => (
                      <div key={student.id} className="flex items-center gap-3 pb-3 border-b last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{student.name}</p>
                          <p className="text-xs text-zinc-500">{student.student_id}</p>
                        </div>
                        <Select
                          value={promotionData.streamAssignments.get(student.id) || ""}
                          onValueChange={(stream) =>
                            handleIndividualStreamChange(student.id, stream)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Stream" />
                          </SelectTrigger>
                          <SelectContent>
                            {targetGrade.availableStreams.map((stream) => (
                              <SelectItem key={stream} value={stream}>
                                {stream}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCurrentStep("select-grade")}>
                Back
              </Button>
              <Button
                onClick={handleProceedToReview}
                disabled={!areAllStreamsAssigned}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {currentStep === "review" && targetGrade && (
          <>
            <DialogHeader>
              <DialogTitle>Review Promotions</DialogTitle>
              <DialogDescription>
                Confirm the details before proceeding
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold">
                    Students to Promote
                  </p>
                  <p className="text-2xl font-bold mt-1">{selectedStudents.length}</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold">
                    Target Grade
                  </p>
                  <p className="text-xl font-bold mt-1">{targetGrade.name}</p>
                </div>
              </div>

              {/* Student List */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Students</Label>
                <ScrollArea className="h-48 border rounded-lg p-4">
                  <div className="space-y-2">
                    {selectedStudents.map((student) => (
                      <div key={student.id} className="flex items-center justify-between pb-2 border-b last:border-0">
                        <div>
                          <p className="font-medium text-sm">{student.name}</p>
                          <p className="text-xs text-zinc-500">{student.student_id}</p>
                        </div>
                        {needsStreamAssignment && (
                          <Badge variant="outline">
                            {promotionData.streamAssignments.get(student.id) || "—"}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Warning */}
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  This action will update student grades and create new result records. Previous results will be preserved.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  setCurrentStep(needsStreamAssignment ? "configure-streams" : "select-grade")
                }
              >
                Back
              </Button>
              <Button onClick={handleConfirmPromotion} className="bg-blue-600 hover:bg-blue-700">
                Confirm Promotion
              </Button>
            </DialogFooter>
          </>
        )}

        {currentStep === "processing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <div className="text-center">
              <h3 className="font-semibold">Processing Promotions</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Please wait while we update student records...
              </p>
            </div>
          </div>
        )}

        {currentStep === "success" && successDetails && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Promotions Completed
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-900 dark:text-green-100">
                  {successDetails.promoted} student{successDetails.promoted !== 1 ? "s" : ""}{" "}
                  promoted successfully
                </p>
              </div>

              {successDetails.errors.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-amber-900">Warnings</Label>
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
                    {successDetails.errors.map((error, idx) => (
                      <p key={idx} className="text-sm text-amber-900 dark:text-amber-100">
                        • {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="bg-green-600 hover:bg-green-700">
                Done
              </Button>
            </DialogFooter>
          </>
        )}

        {currentStep === "error" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Error
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-900 dark:text-red-100">
                  {errorMessage || "An error occurred during promotion"}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCurrentStep("review")}>
                Try Again
              </Button>
              <Button onClick={handleClose} variant="destructive">
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
