"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Student, GradeInfo } from "@/hooks/usePromotionState";

interface PromotionConfigPanelProps {
  students: Student[];
  grades: GradeInfo[];
  targetGradeId: number | null;
  bulkStream: string | null;
  getStreamForStudent: (studentId: number) => string | null;
  selectedStudentIds: Set<number>;
  onTargetGradeChange: (gradeId: number | null) => void;
  onBulkStreamChange: (stream: string | null) => void;
  onStreamChange: (studentId: number, stream: string | null) => void;
}

export function PromotionConfigPanel({
  students,
  grades,
  targetGradeId,
  bulkStream,
  getStreamForStudent,
  selectedStudentIds,
  onTargetGradeChange,
  onBulkStreamChange,
  onStreamChange,
}: PromotionConfigPanelProps) {
  const selectedStudents = useMemo(
    () => students.filter((s) => selectedStudentIds.has(s.id)),
    [students, selectedStudentIds]
  );

  const targetGrade = useMemo(
    () => grades.find((g) => g.id === targetGradeId),
    [grades, targetGradeId]
  );

  const areAllStreamsAssigned = useMemo(() => {
    if (!targetGrade?.hasStream) return true;
    return selectedStudents.every((s) => getStreamForStudent(s.id) !== null);
  }, [targetGrade, selectedStudents, getStreamForStudent]);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle>Promotion Configuration</CardTitle>
        <CardDescription>Set the target grade and stream assignments</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 flex-1">
        {/* Target Grade Selection */}
        <div className="space-y-2">
          <Label htmlFor="target-grade">Target Grade *</Label>
          <Select
            value={targetGradeId?.toString() ?? ""}
            onValueChange={(value) => onTargetGradeChange(value ? parseInt(value) : null)}
          >
            <SelectTrigger id="target-grade">
              <SelectValue placeholder="Select a target grade" />
            </SelectTrigger>
            <SelectContent>
              {grades.map((grade) => (
                <SelectItem key={grade.id} value={grade.id.toString()}>
                  {grade.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {targetGrade && (
          <>
            <Separator />

            {/* Stream Selection (if applicable) */}
            {targetGrade.hasStream && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Stream Assignment</h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
                    {targetGrade.name} requires stream selection
                  </p>
                </div>

                {/* Bulk Stream Selection */}
                <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg space-y-2">
                  <Label htmlFor="bulk-stream" className="text-xs font-semibold uppercase text-zinc-600">
                    Apply to All
                  </Label>
                  <Select value={bulkStream ?? ""} onValueChange={(value) => onBulkStreamChange(value || null)}>
                    <SelectTrigger id="bulk-stream" className="bg-white dark:bg-zinc-900">
                      <SelectValue placeholder="Select stream for all students..." />
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

                {/* Individual Stream Assignments */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-zinc-600">
                    Individual Assignments
                  </Label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedStudents.map((student) => (
                      <div key={student.id} className="flex items-center gap-2">
                        <span className="text-sm flex-1 truncate">{student.name}</span>
                        <Select
                          value={getStreamForStudent(student.id) ?? ""}
                          onValueChange={(value) => onStreamChange(student.id, value || null)}
                        >
                          <SelectTrigger className="w-32 text-xs h-8">
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
                </div>

                {/* Validation Status */}
                <div className="flex items-start gap-2 text-sm">
                  {areAllStreamsAssigned ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>All streams assigned</span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>Not all students have stream assigned</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Summary */}
            <Separator />
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Summary</p>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p>
                  Promoting <Badge variant="secondary">{selectedStudents.length}</Badge> student(s) to{" "}
                  <Badge variant="secondary">{targetGrade.name}</Badge>
                  {targetGrade.hasStream && bulkStream && (
                    <>
                      {" "}
                      with stream <Badge variant="secondary">{bulkStream}</Badge>
                    </>
                  )}
                </p>
              </div>
            </div>
          </>
        )}

        {!targetGrade && selectedStudents.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <AlertCircle className="h-4 w-4" />
            Please select a target grade
          </div>
        )}
      </CardContent>
    </Card>
  );
}
