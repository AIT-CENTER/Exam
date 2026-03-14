"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { DashboardSpinner } from "@/components/dashboard-spinner";

type MeResponse =
  | { authenticated: false }
  | {
      authenticated: true;
      mustSetPassword: boolean;
      student: { full_name: string; student_id: string; grade_id: number; grade_name: string | null; section: string; stream: string | null } | null;
    };

type SimpleResultSummary = {
  total_exams: number;
  average_percentage: number | null;
  last_exam_title: string | null;
  last_exam_date: string | null;
};

export default function StudentHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [resultsSummary, setResultsSummary] = useState<SimpleResultSummary | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/student/me", { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as MeResponse;
        setMe(json);
        if (!json?.authenticated) {
          router.replace("/student/login");
        }
        if (json?.authenticated && !json.mustSetPassword) {
          void loadResultsSummary();
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function loadResultsSummary() {
    try {
      setResultsLoading(true);
      const res = await fetch("/api/student/results", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.subject_exam_results) {
        return;
      }

      const subjects = json.subject_exam_results as {
        subject_id: number;
        subject_name: string;
        exams: { exam_title: string; exam_date: string | null; total_marks: number; marks_obtained: number; percentage: number | null }[];
      }[];

      const allExams = subjects.flatMap((s) => s.exams.map((e) => ({ ...e, subject_name: s.subject_name })));
      if (!allExams.length) {
        setResultsSummary({ total_exams: 0, average_percentage: null, last_exam_title: null, last_exam_date: null });
        return;
      }

      const validPct = allExams.map((e) => e.percentage).filter((p): p is number => typeof p === "number");
      const avgPct = validPct.length ? validPct.reduce((a, b) => a + b, 0) / validPct.length : null;

      const sortedByDate = allExams
        .filter((e) => e.exam_date)
        .sort((a, b) => new Date(b.exam_date ?? "").getTime() - new Date(a.exam_date ?? "").getTime());
      const last = sortedByDate[0] ?? null;

      setResultsSummary({
        total_exams: allExams.length,
        average_percentage: avgPct,
        last_exam_title: last?.exam_title ?? null,
        last_exam_date: last?.exam_date ?? null,
      });
    } finally {
      setResultsLoading(false);
    }
  }

  if (!me?.authenticated) {
    return (
      <div className="flex w-full min-h-[50vh] items-center justify-center">
        <DashboardSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Student Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">View your results and manage your password.</p>
      </div>

      {loading ? (
        <DashboardSpinner />
      ) : (
        <>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Welcome
                {me.student ? <Badge variant="secondary">{me.student.student_id}</Badge> : null}
              </CardTitle>
              <CardDescription>
                {me.student?.full_name ?? "Student"} • {me.student?.grade_name ?? `Grade ${me.student?.grade_id ?? "—"}`} • Section {me.student?.section ?? "—"}
                {me.student?.stream ? ` • ${me.student.stream}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Use the sidebar menu to open your detailed results, change your password, and review your performance.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Exams taken</CardTitle>
              </CardHeader>
              <CardContent>
                {resultsLoading && !resultsSummary ? (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading…
                  </div>
                ) : (
                  <p className="text-2xl font-bold">
                    {resultsSummary ? resultsSummary.total_exams : "—"}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Average score</CardTitle>
              </CardHeader>
              <CardContent>
                {resultsLoading && !resultsSummary ? (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading…
                  </div>
                ) : (
                  <p className="text-2xl font-bold">
                    {resultsSummary?.average_percentage != null
                      ? `${resultsSummary.average_percentage.toFixed(1)}%`
                      : "—"}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Last exam</CardTitle>
              </CardHeader>
              <CardContent>
                {resultsLoading && !resultsSummary ? (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading…
                  </div>
                ) : resultsSummary?.last_exam_title ? (
                  <>
                    <p className="text-sm font-semibold truncate">
                      {resultsSummary.last_exam_title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {resultsSummary.last_exam_date
                        ? new Date(resultsSummary.last_exam_date).toLocaleDateString()
                        : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No exams recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

