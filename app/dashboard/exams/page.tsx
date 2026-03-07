"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Clock, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useLiveMonitor } from "@/hooks/useLiveMonitor";

interface ExamRow {
  id: number;
  title: string;
  exam_code: string;
  exam_date: string;
  duration: number;
  total_marks: number;
  exam_active: boolean;
  created_by: string | null;
  teacher_name: string;
  grade_name: string;
  section: string;
}

function DashboardSpinner() {
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

export default function AdminExamsPage() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { students: liveStudents } = useLiveMonitor(null);
  const [currentPage, setCurrentPage] = useState(1);

  const EXAMS_PER_PAGE = 10;

  useEffect(() => {
    const fetchExams = async () => {
      const { data: examsData, error: examsError } = await supabase
        .from("exams")
        .select(
          `
          id,
          title,
          exam_code,
          exam_date,
          duration,
          total_marks,
          exam_active,
          created_by,
          section,
          grades (grade_name),
          teacher (full_name)
        `
        )
        .order("exam_date", { ascending: false })
        .limit(200);

      if (examsError) {
        setLoading(false);
        return;
      }

      const rows: ExamRow[] = (examsData || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        exam_code: e.exam_code,
        exam_date: e.exam_date,
        duration: e.duration ?? 60,
        total_marks: e.total_marks,
        exam_active: e.exam_active ?? true,
        created_by: e.created_by,
        teacher_name: e.teacher?.full_name ?? "—",
        grade_name: e.grades?.grade_name ?? "—",
        section: e.section ?? "—",
      }));
      setExams(rows);
      setLoading(false);
    };
    fetchExams();
  }, []);

  const getLiveSummary = (examId: number) => {
    const forExam = liveStudents.filter((s) => s.examId === examId);
    const active = forExam.filter((s) => s.status === "Active").length;
    const disconnected = forExam.filter((s) => s.status === "Disconnected").length;
    const flagged = forExam.filter((s) => s.isFlagged).length;
    return { total: forExam.length, active, disconnected, flagged };
  };

  if (loading) {
    return <DashboardSpinner />;
  }

  const totalPages = Math.ceil(exams.length / EXAMS_PER_PAGE) || 1;
  const paginatedExams = exams.slice(
    (currentPage - 1) * EXAMS_PER_PAGE,
    currentPage * EXAMS_PER_PAGE
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          Exam Oversight
        </h1>
        <CardDescription className="mt-1">
          View all exams across teachers (read-only). Live session summary per exam.
        </CardDescription>
      </div>

      <Card className="shadow-sm border border-muted/60">
        <CardHeader>
          <CardTitle>All Exams</CardTitle>
          <CardDescription>Exams created by teachers; live monitoring summary for in-progress sessions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : exams.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No exams found.</p>
          ) : (
            <>
              <div className="rounded-lg border border-muted/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[24%]">Exam</TableHead>
                      <TableHead className="w-[10%]">Code</TableHead>
                      <TableHead className="w-[18%]">Teacher</TableHead>
                      <TableHead className="w-[18%]">Grade / Section</TableHead>
                      <TableHead className="w-[12%]">Date</TableHead>
                      <TableHead className="w-[10%]">Duration</TableHead>
                      <TableHead className="w-[18%]">Live sessions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedExams.map((exam, index) => {
                      const summary = getLiveSummary(exam.id);
                      const isStriped = index % 2 === 0;
                      return (
                        <TableRow
                          key={exam.id}
                          className={isStriped ? "bg-muted/20" : ""}
                        >
                          <TableCell>
                            <div className="font-medium line-clamp-2">{exam.title}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(exam.exam_date).toLocaleString()}
                            </div>
                            {!exam.exam_active && (
                              <Badge variant="secondary" className="mt-1">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {exam.exam_code}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{exam.teacher_name}</div>
                            {exam.created_by && (
                              <div className="text-xs text-muted-foreground">
                                ID: {exam.created_by}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-sm">
                              <span className="font-medium">{exam.grade_name}</span>
                              <span className="text-xs text-muted-foreground">
                                Section {exam.section}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(exam.exam_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{exam.duration} min</TableCell>
                          <TableCell>
                            {summary.total === 0 ? (
                              <span className="text-muted-foreground text-sm">No live sessions</span>
                            ) : (
                              <span className="flex items-center gap-2 flex-wrap text-xs">
                                <Badge variant="outline" className="bg-green-50 text-green-800">
                                  {summary.active} active
                                </Badge>
                                {summary.disconnected > 0 && (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-800">
                                    {summary.disconnected} disconnected
                                  </Badge>
                                )}
                                {summary.flagged > 0 && (
                                  <Badge variant="outline" className="bg-red-50 text-red-800">
                                    {summary.flagged} flagged
                                  </Badge>
                                )}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * EXAMS_PER_PAGE + 1} to{" "}
                    {Math.min(currentPage * EXAMS_PER_PAGE, exams.length)} of{" "}
                    {exams.length} exams
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md border px-3 py-1 text-sm bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      Prev
                    </button>
                    <span className="text-xs text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md border px-3 py-1 text-sm bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(p + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
