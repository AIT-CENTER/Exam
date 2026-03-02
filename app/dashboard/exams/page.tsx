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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>All Exams</CardTitle>
          <CardDescription>Exams created by teachers; live monitoring summary for in-progress sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : exams.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No exams found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Grade / Section</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Live sessions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((exam) => {
                  const summary = getLiveSummary(exam.id);
                  return (
                    <TableRow key={exam.id}>
                      <TableCell>
                        <div className="font-medium">{exam.title}</div>
                        {!exam.exam_active && (
                          <Badge variant="secondary" className="mt-1">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>{exam.exam_code}</TableCell>
                      <TableCell>{exam.teacher_name}</TableCell>
                      <TableCell>{exam.grade_name} / {exam.section}</TableCell>
                      <TableCell>{new Date(exam.exam_date).toLocaleDateString()}</TableCell>
                      <TableCell>{exam.duration} min</TableCell>
                      <TableCell>
                        {summary.total === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="flex items-center gap-2 flex-wrap">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
