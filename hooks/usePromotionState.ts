import { useState, useCallback } from "react";

export interface Student {
  id: number;
  name: string;
  student_id: string;
  grade_id: number;
  grade_name: string;
  section: string;
  stream: string | null;
  results_summary: {
    subject_name: string;
    total_marks: number;
    average_score: number;
    best_score: number;
  }[];
}

export interface GradeInfo {
  id: number;
  name: string;
  hasStream: boolean;
  availableStreams: string[];
}

export interface PromotionState {
  selectedStudentIds: Set<number>;
  targetGradeId: number | null;
  streamAssignments: Map<number, string | null>; // studentId -> stream
  bulkStream: string | null; // For "apply to all" functionality
}

export function usePromotionState() {
  const [state, setState] = useState<PromotionState>({
    selectedStudentIds: new Set(),
    targetGradeId: null,
    streamAssignments: new Map(),
    bulkStream: null,
  });

  const toggleStudentSelection = useCallback((studentId: number) => {
    setState((prev) => {
      const newSelected = new Set(prev.selectedStudentIds);
      if (newSelected.has(studentId)) {
        newSelected.delete(studentId);
      } else {
        newSelected.add(studentId);
      }
      return {
        ...prev,
        selectedStudentIds: newSelected,
      };
    });
  }, []);

  const selectAllStudents = useCallback((studentIds: number[]) => {
    setState((prev) => ({
      ...prev,
      selectedStudentIds: new Set(studentIds),
    }));
  }, []);

  const deselectAllStudents = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedStudentIds: new Set(),
    }));
  }, []);

  const setTargetGrade = useCallback((gradeId: number | null) => {
    setState((prev) => ({
      ...prev,
      targetGradeId: gradeId,
      streamAssignments: new Map(), // Reset stream assignments when grade changes
      bulkStream: null,
    }));
  }, []);

  const setStreamForStudent = useCallback((studentId: number, stream: string | null) => {
    setState((prev) => {
      const newAssignments = new Map(prev.streamAssignments);
      if (stream === null) {
        newAssignments.delete(studentId);
      } else {
        newAssignments.set(studentId, stream);
      }
      return {
        ...prev,
        streamAssignments: newAssignments,
      };
    });
  }, []);

  const setBulkStream = useCallback((stream: string | null) => {
    setState((prev) => {
      const newAssignments = new Map<number, string | null>();
      if (stream) {
        for (const studentId of prev.selectedStudentIds) {
          newAssignments.set(studentId, stream);
        }
      }
      return {
        ...prev,
        bulkStream: stream,
        streamAssignments: newAssignments,
      };
    });
  }, []);

  const getStreamForStudent = useCallback(
    (studentId: number): string | null => {
      return state.streamAssignments.get(studentId) ?? null;
    },
    [state.streamAssignments]
  );

  const isAllStreamsAssigned = useCallback(
    (requiresStream: boolean): boolean => {
      if (!requiresStream) return true;
      for (const studentId of state.selectedStudentIds) {
        if (!state.streamAssignments.has(studentId)) {
          return false;
        }
      }
      return true;
    },
    [state.selectedStudentIds, state.streamAssignments]
  );

  const reset = useCallback(() => {
    setState({
      selectedStudentIds: new Set(),
      targetGradeId: null,
      streamAssignments: new Map(),
      bulkStream: null,
    });
  }, []);

  return {
    state,
    toggleStudentSelection,
    selectAllStudents,
    deselectAllStudents,
    setTargetGrade,
    setStreamForStudent,
    setBulkStream,
    getStreamForStudent,
    isAllStreamsAssigned,
    reset,
  };
}
