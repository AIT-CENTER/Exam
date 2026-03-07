"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Lock, KeyRound, Calendar } from "lucide-react";
import { DashboardSpinner } from "@/components/dashboard-spinner";

type TermKey = "semester_1" | "semester_2" | "full_year";

type MeResponse =
  | { authenticated: false }
  | {
      authenticated: true;
      mustSetPassword: boolean;
      student: { full_name: string; student_id: string; grade_id: number; grade_name: string | null; section: string; stream: string | null } | null;
    };

type SubjectExamResult = {
  subject_id: number;
  subject_name: string;
  exams: {
    exam_title: string;
    exam_date: string | null;
    total_marks: number;
    marks_obtained: number;
    percentage: number | null;
  }[];
};

type ResultsResponse = {
  source: "live" | "snapshot";
  enrollment?: { grade_id: number | null; grade_name: string | null; section: string | null; stream: string | null };
  period?: { academic_year: number; term: TermKey; label: string | null; start_date: string | null; end_date: string | null };
  academic_year?: number | null;
  current_mode?: "semester_1" | "full_year";
  periods?: { id: number; term: TermKey; start_date: string | null; end_date: string | null }[];
  subject_exam_results: SubjectExamResult[];
};

type Period = {
  id: number;
  academic_year: number;
  term: TermKey;
  label: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

function formatTerm(term: TermKey) {
  if (term === "semester_1") return "Semester 1";
  if (term === "semester_2") return "Semester 2";
  return "Full year";
}

function formatDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString();
}

function pct(v: number | null) {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(2)}%`;
}

export default function StudentResultsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);

  const [mode, setMode] = useState<"current" | "archived">("current");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState<string>("");

  const [resultsBusy, setResultsBusy] = useState(false);
  const [results, setResults] = useState<ResultsResponse | null>(null);

  const subjectList = useMemo(() => results?.subject_exam_results ?? [], [results]);

  useEffect(() => {
    void refreshMe();
  }, []);

  // If the student is not authenticated, send them to the dedicated login page
  // instead of showing the dashboard chrome here.
  useEffect(() => {
    if (!loading && me && "authenticated" in me && !me.authenticated) {
      router.replace("/student/login");
    }
  }, [loading, me, router]);

  useEffect(() => {
    if (!me || !("authenticated" in me) || !me.authenticated) return;
    void loadPeriods();
  }, [me]);

  useEffect(() => {
    if (!me || !("authenticated" in me) || !me.authenticated) return;
    if (me.mustSetPassword) return;
    void loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, periodId, me?.authenticated, (me as any)?.mustSetPassword]);

  async function refreshMe() {
    try {
      setLoading(true);
      const res = await fetch("/api/student/me", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as MeResponse;
      setMe(json);
    } finally {
      setLoading(false);
    }
  }

  async function loadPeriods() {
    try {
      const res = await fetch("/api/student/periods", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const list = (json.periods ?? []) as Period[];
      setPeriods(list);
      const current = list.find((p) => p.is_current);
      if (current) setPeriodId(String(current.id));
      else if (list[0]) setPeriodId(String(list[0].id));
    } catch {
      // ignore
    }
  }

  async function loadResults() {
    try {
      setResultsBusy(true);
      setResults(null);

      let url = "/api/student/results";
      if (mode === "archived" && periodId) url += `?period_id=${encodeURIComponent(periodId)}`;

      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && json?.error === "PASSWORD_REQUIRED") {
          await refreshMe();
          return;
        }
        throw new Error(json?.error || "Failed to load results");
      }
      setResults(json as ResultsResponse);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load results");
    } finally {
      setResultsBusy(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Student Results</h1>
        <p className="text-muted-foreground mt-1 text-sm">View your semester/year results when enabled by the school.</p>
      </div>

      {loading ? (
        <DashboardSpinner />
      ) : me?.authenticated ? (
        me.mustSetPassword ? (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Create your password
              </CardTitle>
              <CardDescription>
                You’re signed in for the first time. Create a password before viewing results.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="gap-2">
                <Link href="/student/password">
                  <KeyRound className="h-4 w-4" />
                  Create password
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {me.student?.full_name ?? "Student"}
                  {me.student ? <Badge variant="secondary">{me.student.student_id}</Badge> : null}
                </CardTitle>
                <CardDescription>
                  {me.student?.grade_name ?? `Grade ${me.student?.grade_id ?? "—"}`} • Section {me.student?.section ?? "—"}
                  {me.student?.stream ? ` • ${me.student.stream}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                  <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="current">Current</TabsTrigger>
                    <TabsTrigger value="archived">Archived</TabsTrigger>
                  </TabsList>
                  <TabsContent value="current" className="mt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1">
                        <Label>Current view</Label>
                        <div className="mt-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
                          {results?.current_mode === "full_year"
                            ? "Full year (includes first semester)"
                            : "First semester only"}
                        </div>
                      </div>
                      <Button onClick={loadResults} variant="outline" className="gap-2" disabled={resultsBusy}>
                        {resultsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                        Refresh
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="archived" className="mt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1">
                        <Label>Academic period</Label>
                        <Select value={periodId} onValueChange={setPeriodId}>
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Select a period" />
                          </SelectTrigger>
                          <SelectContent>
                            {periods.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.academic_year} • {formatTerm(p.term)} {p.is_current ? " • Current" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={loadResults} variant="outline" className="gap-2" disabled={resultsBusy}>
                        {resultsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                        Refresh
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Results</CardTitle>
                <CardDescription>
                  {results?.source === "snapshot" && results.period ? (
                    <>
                      {results.period.academic_year} • {formatTerm(results.period.term)} • {formatDate(results.period.start_date)} →{" "}
                      {formatDate(results.period.end_date)}
                    </>
                  ) : results?.periods?.length ? (
                    <>
                      {results.academic_year ?? ""} •{" "}
                      {results.current_mode === "full_year" ? "Full year" : "Semester 1"} •{" "}
                      {results.periods.map((p) => formatTerm(p.term)).join(" + ")}
                    </>
                  ) : (
                    " "
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {resultsBusy ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Loading results...
                  </div>
                ) : !results ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">Select a term/period to view results.</div>
                ) : subjectList.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No results available.</div>
                ) : (
                  <Tabs defaultValue={String(subjectList[0].subject_id)} className="w-full">
                    <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                      {subjectList.map((sub) => (
                        <TabsTrigger key={sub.subject_id} value={String(sub.subject_id)} className="flex-1 min-w-0 text-xs sm:text-sm">
                          {sub.subject_name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {subjectList.map((sub) => (
                      <TabsContent key={sub.subject_id} value={String(sub.subject_id)} className="mt-4 focus-visible:outline-none">
                        <ScrollArea className="h-[50vh] pr-4 rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="font-semibold">Exam</TableHead>
                                <TableHead className="font-semibold">Date</TableHead>
                                <TableHead className="text-right font-semibold">Score</TableHead>
                                <TableHead className="text-right font-semibold">%</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sub.exams.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                                    No exams for this subject.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                sub.exams.map((exam, idx) => (
                                  <TableRow key={`${exam.exam_title}-${idx}`} className="hover:bg-muted/30">
                                    <TableCell className="font-medium">{exam.exam_title}</TableCell>
                                    <TableCell>{formatDate(exam.exam_date)}</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {exam.marks_obtained} / {exam.total_marks}
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">{pct(exam.percentage)}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </TabsContent>
                    ))}
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </>
        )
      ) : (
        <div className="flex items-center justify-center py-14 text-muted-foreground text-sm">
          Redirecting to login…
        </div>
      )}
    </div>
  );
}

