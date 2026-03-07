import { useState, useEffect, useCallback } from "react";
import { Student } from "./usePromotionState";

interface FetchState {
  students: Student[];
  loading: boolean;
  error: string | null;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FetchParams {
  page?: number;
  search?: string;
  grade?: string;
  limit?: number;
}

export function useStudentFetching() {
  const [state, setState] = useState<FetchState>({
    students: [],
    loading: true,
    error: null,
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [filters, setFilters] = useState({
    search: "",
    grade: "",
  });

  const fetchStudents = useCallback(async (params: FetchParams = {}) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const page = params.page ?? state.page;
      const search = params.search ?? filters.search;
      const grade = params.grade ?? filters.grade;
      const limit = params.limit ?? state.limit;

      const queryParams = new URLSearchParams();
      queryParams.append("page", String(page));
      queryParams.append("limit", String(limit));
      if (search) queryParams.append("search", search);
      if (grade) queryParams.append("grade", grade);

      console.log("[v0] Fetching students with params:", { page, search, grade, limit });

      const response = await fetch(
        `/api/admin/promotions/students?${queryParams.toString()}`,
        { cache: "no-store" }
      );

      console.log("[v0] Response status:", response.status);

      if (!response.ok) {
        const error = await response.json();
        console.log("[v0] Error response:", error);
        throw new Error(error.error || "Failed to fetch students");
      }

      const data = await response.json();
      console.log("[v0] Data fetched successfully, students count:", data.data?.length);

      setState((prev) => ({
        ...prev,
        students: data.data || [],
        page: data.pagination?.page || 1,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
        loading: false,
      }));

      setFilters({ search, grade });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.log("[v0] Fetch error:", errorMessage);
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
    }
  }, [state.page, state.limit, filters.search, filters.grade]);

  // Initial fetch on mount
  useEffect(() => {
    fetchStudents();
  }, []);

  const setPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, page }));
    fetchStudents({ page });
  }, [fetchStudents]);

  const setSearch = useCallback((search: string) => {
    fetchStudents({ search, page: 1 });
  }, [fetchStudents]);

  const setGradeFilter = useCallback((grade: string) => {
    fetchStudents({ grade, page: 1 });
  }, [fetchStudents]);

  const refetch = useCallback(() => {
    fetchStudents();
  }, [fetchStudents]);

  return {
    state,
    students: state.students,
    loading: state.loading,
    error: state.error,
    setState,
    setPage,
    setSearch,
    setGradeFilter,
    refetch,
    fetchStudents,
  };
}
