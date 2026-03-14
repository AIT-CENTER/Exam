"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSpinner } from "@/components/ui/dashboard-spinner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Loader2, RefreshCw, FileText, Eye, Database, GraduationCap, CalendarIcon, Info, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type TermKey = "semester_1" | "semester_2" | "full_year";

type AcademicPeriod = {
  id: number;
  academic_year: number;
  term: TermKey;
  label: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

type Grade = { id: number; grade_name: string; has_stream?: boolean };

type EnrollmentRow = {
  enrollment_id: number;
  student_db_id: number | null;
  student_number: string | null;
  full_name: string;
  grade_id: number;
  grade_name: string | null;
  section: string;
  stream: string | null;
  subjects: number;
  total_marks_obtained: number;
  total_possible_marks: number;
  overall_percentage: number | null;
};

type EnrollmentDetail = {
  enrollment: { id: number; section: string; stream: string | null; grade_id: number; grade_name: string | null };
  period: { academic_year: number; term: TermKey; label: string | null; start_date: string | null; end_date: string | null } | null;
  student: { student_id: string; full_name: string; gender: string | null };
  subject_exam_results: {
    subject_id: number;
    subject_name: string;
    exams: {
      exam_id: number | null;
      exam_title: string;
      exam_date: string | null;
      total_marks: number;
      marks_obtained: number;
      percentage: number | null;
    }[];
  }[];
};

function formatTerm(term: TermKey) {
  if (term === "semester_1") return "Semester 1";
  if (term === "semester_2") return "Semester 2";
  return "Full year";
}

function formatDateStr(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString();
}

function pct(v: number | null) {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(2)}%`;
}

const CURRENT_YEAR = new Date().getFullYear();

/** Skeleton for the Results Archive page during loading */
function ResultsArchiveSkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 lg:p-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>

      {/* How it works skeleton */}
      <Card className="shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
      </Card>

      {/* Academic period skeleton */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i}>
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Archived results table skeleton */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-36" />
          </div>
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i}>
                <Skeleton className="h-4 w-12 mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Shadcn-style date picker using Popover + Calendar */
function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  disabled,
  fromYear = 1990,
  toYear = 2100,
}: {
  value: string;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  fromYear?: number;
  toYear?: number;
}) {
  const date = value ? new Date(value) : undefined;
  const isValid = date && !Number.isNaN(date.getTime());

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !isValid && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {isValid ? format(date!, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={isValid ? date! : undefined}
          onSelect={(d) => onChange(d)}
          captionLayout="dropdown-buttons"
          fromYear={fromYear}
          toYear={toYear}
        />
      </PopoverContent>
    </Popover>
  );
}

export default function ResultsArchiveClient() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [enabled, setEnabled] = useState<boolean>(false);

  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeId, setGradeId] = useState<string>("all");
  const [section, setSection] = useState<string>("all");
  const [stream, setStream] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [gradeHasStream, setGradeHasStream] = useState<boolean>(false);

  const [rows, setRows] = useState<EnrollmentRow[]>([]);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewBusy, setViewBusy] = useState(false);
  const [viewData, setViewData] = useState<EnrollmentDetail | null>(null);

  const [snapshotConfirmOpen, setSnapshotConfirmOpen] = useState(false);
  const [snapshotConfirmMessage, setSnapshotConfirmMessage] = useState<string | null>(null);

  const newYear = String(CURRENT_YEAR);
  const [newTerm, setNewTerm] = useState<TermKey>("semester_1");
  const [newStart, setNewStart] = useState<string>("");
  const [newEnd, setNewEnd] = useState<string>("");
  const [newLabel, setNewLabel] = useState<string>("");
  const [newIsCurrent, setNewIsCurrent] = useState<boolean>(false);

  const selectedGrade = useMemo(() => grades.find((g) => String(g.id) === gradeId) ?? null, [grades, gradeId]);

  useEffect(() => {
    void loadInitial();
  }, []);

  // When academic periods change, adjust default term: if Semester 1 already exists
  // for the current year, move focus to Semester 2 and disable Full year creation.
  useEffect(() => {
    const year = CURRENT_YEAR;
    const hasSem1 = periods.some((p) => p.academic_year === year && p.term === "semester_1");
    const hasSem2 = periods.some((p) => p.academic_year === year && p.term === "semester_2");

    if (hasSem1 && !hasSem2) {
      setNewTerm("semester_2");
    } else if (!hasSem1) {
      setNewTerm("semester_1");
    }
  }, [periods]);

  useEffect(() => {
    const hasStream = Boolean(selectedGrade?.has_stream);
    setGradeHasStream(hasStream);
    if (!hasStream) setStream("all");
    void loadSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId]);

  useEffect(() => {
    if (!selectedPeriodId) return;
    void fetchEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriodId, gradeId, section, stream]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (selectedPeriodId) void fetchEnrollments();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function loadInitial() {
    try {
      setLoading(true);

      const flagsRes = await fetch("/api/admin/system-settings", { cache: "no-store" });
      const flagsJson = await flagsRes.json().catch(() => ({}));
      setEnabled(Boolean(flagsJson.enable_results_archive));

      const [periodsRes, gradesRes] = await Promise.all([
        fetch("/api/admin/results-archive/periods", { cache: "no-store" }),
        supabase.from("grades").select("id, grade_name, has_stream").order("grade_name"),
      ]);

      const pJson = await periodsRes.json().catch(() => ({}));
      setPeriods(pJson.periods ?? []);

      if (!gradesRes.error) setGrades((gradesRes.data as any) ?? []);

      const current = (pJson.periods ?? []).find((p: AcademicPeriod) => p.is_current);
      if (current) setSelectedPeriodId(String(current.id));
      else if ((pJson.periods ?? []).length > 0) setSelectedPeriodId(String((pJson.periods ?? [])[0].id));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load archive data");
    } finally {
      setLoading(false);
    }
  }

  async function loadSections() {
    try {
      if (gradeId === "all") {
        setAvailableSections([]);
        setSection("all");
        return;
      }
      const gId = Number(gradeId);
      if (!Number.isFinite(gId) || gId <= 0) return;

      const { data, error } = await supabase
        .from("grade_sections")
        .select("section_name")
        .eq("grade_id", gId)
        .order("section_name");

      if (error) return;
      const unique = Array.from(new Set((data ?? []).map((r: any) => String(r.section_name)))).filter(Boolean);
      setAvailableSections(unique);
      setSection("all");
    } catch {
      // ignore
    }
  }

  async function fetchEnrollments() {
    try {
      if (!selectedPeriodId) return;
      setBusy(true);

      const sp = new URLSearchParams();
      sp.set("period_id", selectedPeriodId);
      if (gradeId !== "all") sp.set("grade_id", gradeId);
      if (section !== "all") sp.set("section", section);
      if (gradeHasStream && stream !== "all") sp.set("stream", stream);
      if (search.trim()) sp.set("q", search.trim());

      const res = await fetch(`/api/admin/results-archive/enrollments?${sp.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed");
      setRows(json.enrollments ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load results");
    } finally {
      setBusy(false);
    }
  }

  async function createPeriod() {
    try {
      setBusy(true);
      const res = await fetch("/api/admin/results-archive/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academic_year: Number(newYear),
          term: newTerm,
          label: newLabel || null,
          start_date: newStart || null,
          end_date: newEnd || null,
          is_current: newIsCurrent,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to create period");
      toast.success("Academic period saved");
      await loadInitial();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create period");
    } finally {
      setBusy(false);
    }
  }

  async function snapshotPeriod(force = false) {
    try {
      if (!selectedPeriodId) return;
      setBusy(true);
      const res = await fetch("/api/admin/results-archive/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_id: Number(selectedPeriodId),
          grade_id: gradeId === "all" ? undefined : Number(gradeId),
          section: section === "all" ? undefined : section,
          stream: gradeHasStream ? (stream === "all" ? undefined : stream) : undefined,
          force,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // If snapshots already exist, ask for confirmation before overwriting
        if (res.status === 409 && json.code === "SNAPSHOT_EXISTS") {
          setSnapshotConfirmMessage(
            json.error ||
              "Results for this academic period and filters were already saved before. Do you want to overwrite the existing snapshot?"
          );
          setSnapshotConfirmOpen(true);
          return;
        }
        throw new Error(json.error || "Snapshot failed");
      }
      toast.success(`Snapshot saved: ${json.exams_snapshotted ?? 0} exam rows`);
      await fetchEnrollments();
    } catch (e: any) {
      toast.error(e?.message || "Snapshot failed");
    } finally {
      setBusy(false);
    }
  }

  async function openEnrollment(enrollmentId: number) {
    try {
      setViewOpen(true);
      setViewBusy(true);
      setViewData(null);
      const res = await fetch(`/api/admin/results-archive/enrollments/${enrollmentId}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load details");
      setViewData(json as EnrollmentDetail);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load details");
      setViewOpen(false);
    } finally {
      setViewBusy(false);
    }
  }

  async function generateTranscript(studentNumber: string | null) {
    try {
      if (!studentNumber) return;
      setBusy(true);
      const res = await fetch(`/api/admin/results-archive/transcript?student_number=${encodeURIComponent(studentNumber)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load transcript");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Student Transcript", 105, 16, { align: "center" });

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Student: ${json.student?.full_name ?? "—"}`, 14, 26);
      doc.text(`Student ID: ${json.student?.student_number ?? "—"}`, 14, 32);

      let y = 40;
      for (const yr of json.years ?? []) {
        const heading = `${yr.academic_year ?? ""} • ${formatTerm(yr.term)} • ${yr.grade_name ?? ""} • Section ${yr.section ?? ""}${yr.stream ? ` • ${yr.stream}` : ""}`;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(heading, 14, y);
        y += 4;

        const tableBody = (yr.subject_summaries ?? []).map((s: any) => [
          s.subject_name,
          `${s.total_marks_obtained} / ${s.total_possible_marks}`,
          pct(s.average_percentage),
          String(s.exam_count ?? 0),
        ]);

        autoTable(doc, {
          startY: y,
          head: [["Subject", "Total", "Avg %", "Exams"]],
          body: tableBody,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [79, 70, 229] },
          margin: { left: 14, right: 14 },
        });

        // @ts-expect-error jspdf-autotable adds lastAutoTable
        y = (doc.lastAutoTable?.finalY ?? y) + 8;
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
      }

      doc.save(`transcript_${studentNumber}.pdf`);
      toast.success("Transcript downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Transcript failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-[70vh]">
        <DashboardSpinner />
        <div className="w-full px-4 lg:px-8 pb-24">
          <ResultsArchiveSkeleton />
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex-1 space-y-6 p-4 lg:p-8">
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Results archive is disabled
            </CardTitle>
            <CardDescription>
              Enable <span className="font-medium">Results Archive</span> in <Badge variant="secondary">Settings</Badge> (super admin) to store year/semester snapshots and generate transcripts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadInitial} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 lg:p-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Results Archive</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Store and view end-of-semester results. Data updates in real time as you change filters or run snapshots.
          </p>
        </div>
        <Button onClick={loadInitial} variant="outline" className="gap-2" disabled={busy}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* How it works - clear explanation */}
      <Card className="border-indigo-200/50 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            How the Results Archive works
          </CardTitle>
          <CardDescription className="text-muted-foreground space-y-2">
            <span className="block">
              <strong>View past students&apos; results:</strong> Select an academic period from the dropdown below, then filter by grade, section, or stream. 
              Search by student ID or name. Click <strong>View</strong> on any row to see that student&apos;s detailed exam results for that period. 
              Results update automatically as you change filters.
            </span>
            <span className="block">
              <strong>Save results by semester:</strong> Create a new period (or use an existing one) with the current year (auto-detected), choose the term (Semester 1, 2, or Full year), 
              set start and end dates with the date pickers, then click <strong>Save period</strong>. After that, select the period, apply filters if needed, 
              and click <strong>Snapshot results</strong> to permanently store exam results for that period. Promoted students keep their archived results here.
            </span>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Academic period
          </CardTitle>
          <CardDescription>Create or select an academic period. Year is auto-detected; use the date pickers for start and end dates.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4">
            <Label>Period</Label>
            <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.academic_year} • {formatTerm(p.term)} {p.is_current ? " • Current" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPeriodId && (
              <p className="text-xs text-muted-foreground mt-2">
                {(() => {
                  const p = periods.find((x) => String(x.id) === selectedPeriodId);
                  if (!p) return null;
                  return (
                    <>
                      {p.label ? `${p.label} • ` : ""}
                      {formatDateStr(p.start_date)} → {formatDateStr(p.end_date)}
                    </>
                  );
                })()}
              </p>
            )}
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <Label>Year</Label>
                <Input
                  className="mt-2 bg-muted cursor-not-allowed"
                  value={newYear}
                  disabled
                  readOnly
                  title="Year is auto-detected from the current date"
                />
                <p className="text-xs text-muted-foreground mt-1">Auto-detected</p>
              </div>
              <div>
                <Label>Term</Label>
                <Select value={newTerm} onValueChange={(v) => setNewTerm(v as TermKey)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semester_1">Semester 1</SelectItem>
                    <SelectItem value="semester_2">Semester 2</SelectItem>
                    {/* Once semesters are used, full-year is derived from them, so we disable manual creation */}
                    <SelectItem
                      value="full_year"
                      disabled={periods.some(
                        (p) => p.academic_year === CURRENT_YEAR && p.term === "semester_1"
                      )}
                    >
                      Full year (auto from S1 + S2)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start date</Label>
                <div className="mt-2">
                  <DatePicker
                    value={newStart}
                    onChange={(d) => setNewStart(d ? format(d, "yyyy-MM-dd") : "")}
                    placeholder="start date"
                    fromYear={1990}
                    toYear={2100}
                  />
                </div>
              </div>
              <div>
                <Label>End date</Label>
                <div className="mt-2">
                  <DatePicker
                    value={newEnd}
                    onChange={(d) => setNewEnd(d ? format(d, "yyyy-MM-dd") : "")}
                    placeholder="end date"
                    fromYear={1990}
                    toYear={2100}
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button onClick={createPeriod} className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save period"}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Label (optional)</Label>
                <Input className="mt-2" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="E.g. 2025/26 - Semester 1" />
              </div>
              <div className="flex items-center gap-2 pt-8">
                <input
                  id="period-current"
                  type="checkbox"
                  checked={newIsCurrent}
                  onChange={(e) => setNewIsCurrent(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="period-current" className="text-sm">
                  Mark as current
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border border-muted/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Archived results
          </CardTitle>
          <CardDescription>
            Choose a period, then filter by grade, section, or stream. Use <span className="font-medium">Snapshot results</span> to store results for the selected period. Click <span className="font-medium">View</span> for details or <span className="font-medium">Transcript</span> to download a PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Period filter (searchable) + other filters */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <Label>Period</Label>
              <div className="mt-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between",
                        !selectedPeriodId && "text-muted-foreground"
                      )}
                    >
                      {selectedPeriodId
                        ? (() => {
                            const p = periods.find((x) => String(x.id) === selectedPeriodId);
                            if (!p) return "Select period";
                            return `${p.academic_year} • ${formatTerm(p.term)}${p.label ? ` • ${p.label}` : ""}`;
                          })()
                        : "Select period"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[280px]" align="start">
                    <Command>
                      <CommandInput placeholder="Search period..." />
                      <CommandList>
                        <CommandEmpty>No periods found.</CommandEmpty>
                        <CommandGroup>
                          {periods.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.academic_year}-${p.term}-${p.label ?? ""}`}
                              onSelect={() => setSelectedPeriodId(String(p.id))}
                            >
                              {p.academic_year} • {formatTerm(p.term)}
                              {p.label ? ` • ${p.label}` : ""}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label>Grade</Label>
              <Select value={gradeId} onValueChange={setGradeId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="All grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All grades</SelectItem>
                  {grades.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.grade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Section</Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sections</SelectItem>
                  {availableSections.map((s) => (
                    <SelectItem key={s} value={s}>
                      Section {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stream</Label>
              <Select value={stream} onValueChange={setStream} disabled={!gradeHasStream}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={gradeHasStream ? "All streams" : "No streams"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All streams</SelectItem>
                  <SelectItem value="Natural">Natural</SelectItem>
                  <SelectItem value="Social">Social</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Search</Label>
              <Input className="mt-2" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Student ID or name..." />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{rows.length}</span> students
            </div>
            <Button onClick={snapshotPeriod} disabled={!selectedPeriodId || busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Snapshot results
            </Button>
          </div>

          <div className="rounded-lg border border-muted/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold">Student ID</TableHead>
                  <TableHead className="font-semibold">Full name</TableHead>
                  <TableHead className="font-semibold">Grade</TableHead>
                  <TableHead className="font-semibold">Section</TableHead>
                  <TableHead className="font-semibold">Stream</TableHead>
                  <TableHead className="text-right font-semibold">Overall</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {busy && rows.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-14 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                      No archived results for this filter yet. Create a period, run a snapshot, or change filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, index) => (
                    <TableRow
                      key={r.enrollment_id}
                      className={index % 2 === 0 ? "bg-muted/20" : ""}
                    >
                      <TableCell className="font-mono">{r.student_number ?? "—"}</TableCell>
                      <TableCell className="font-medium">{r.full_name}</TableCell>
                      <TableCell>{r.grade_name ?? `Grade ${r.grade_id}`}</TableCell>
                      <TableCell>{r.section}</TableCell>
                      <TableCell>{r.stream ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{pct(r.overall_percentage)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => openEnrollment(r.enrollment_id)}>
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button size="sm" variant="default" className="gap-1" onClick={() => generateTranscript(r.student_number)} disabled={busy}>
                            <FileText className="h-4 w-4" />
                            Transcript
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Archived results detail</DialogTitle>
            <DialogDescription>Subject tabs show exams for the selected academic period.</DialogDescription>
          </DialogHeader>

          {viewBusy || !viewData ? (
            <div className="flex items-center justify-center py-14 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{viewData.enrollment.grade_name ?? `Grade ${viewData.enrollment.grade_id}`}</Badge>
                <Badge variant="secondary">{viewData.student.full_name}</Badge>
                <Badge variant="outline">{viewData.student.student_id}</Badge>
                <Badge variant="outline">Section: {viewData.enrollment.section}</Badge>
                {viewData.enrollment.stream ? <Badge variant="outline">Stream: {viewData.enrollment.stream}</Badge> : null}
                {viewData.period ? (
                  <Badge variant="outline">
                    {viewData.period.academic_year} • {formatTerm(viewData.period.term)}
                  </Badge>
                ) : null}
              </div>

              {(() => {
                const subjectList = viewData.subject_exam_results ?? [];
                const defaultId = subjectList[0] ? String(subjectList[0].subject_id) : "0";
                return (
                  <Tabs defaultValue={defaultId} className="w-full">
                    <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                      {subjectList.map((sub) => (
                        <TabsTrigger key={sub.subject_id} value={String(sub.subject_id)} className="flex-1 min-w-0 text-xs sm:text-sm">
                          {sub.subject_name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {subjectList.length === 0 ? (
                      <div className="mt-4 py-8 text-center text-sm text-muted-foreground">No subjects found in snapshot.</div>
                    ) : (
                      subjectList.map((sub) => (
                        <TabsContent key={sub.subject_id} value={String(sub.subject_id)} className="mt-4 focus-visible:outline-none">
                          <ScrollArea className="h-[42vh] pr-4 rounded-lg border">
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
                                      No exams for this subject in this period.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  sub.exams.map((exam) => (
                                    <TableRow key={`${exam.exam_id ?? exam.exam_title}`} className="hover:bg-muted/30">
                                      <TableCell className="font-medium">{exam.exam_title}</TableCell>
                                      <TableCell>{formatDateStr(exam.exam_date)}</TableCell>
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
                      ))
                    )}
                  </Tabs>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm re-snapshot when data already exists */}
      <AlertDialog open={snapshotConfirmOpen} onOpenChange={setSnapshotConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite existing snapshot?</AlertDialogTitle>
            <AlertDialogDescription>
              {snapshotConfirmMessage ??
                "Results for this academic period and filters were already saved before. Do you want to overwrite the existing snapshot with the latest data?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setSnapshotConfirmOpen(false);
                await snapshotPeriod(true);
              }}
            >
              Overwrite snapshot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
