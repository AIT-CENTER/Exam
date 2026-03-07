"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowUpRight, Search, Loader2, Eye, Users, ChevronRight, Filter, List, CheckCircle } from "lucide-react";

type GradeRow = {
  id: number;
  grade_name: string;
  has_stream?: boolean | null;
};

type StudentListRow = {
  id: number;
  student_id: string;
  name: string;
  father_name: string;
  grandfather_name: string;
  section: string;
  stream: string | null;
  grade_id: number;
  registered_subjects_count: number;
  exams_taken: number;
  overall_percentage: number | null;
};

type SubjectSummary = {
  subject_id: number;
  subject_name: string;
  stream: string | null;
  exam_count: number;
  total_marks_obtained: number;
  total_possible_marks: number;
  percentage: number | null;
};

type SubjectExamResult = {
  subject_id: number;
  subject_name: string;
  stream: string | null;
  exams: {
    exam_id: number;
    exam_title: string;
    exam_date: string | null;
    total_marks: number;
    marks_obtained: number;
    percentage: number | null;
  }[];
};

type StudentDetails = {
  student: Pick<StudentListRow, "id" | "student_id" | "name" | "father_name" | "grandfather_name" | "section" | "stream" | "grade_id"> & {
    grade_name: string;
  };
  grade: { id: number; grade_name: string; has_stream?: boolean | null };
  registered_subjects: { subject_id: number; subject_name: string; stream: string | null }[];
  subject_summaries: SubjectSummary[];
  subject_exam_results?: SubjectExamResult[];
};

function isStreamValue(v: string | null | undefined) {
  return v === "Natural" || v === "Social";
}

function formatPercent(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(2)}%`;
}

function getFullName(s: { name: string; father_name?: string | null; grandfather_name?: string | null }) {
  const parts = [s.name, s.father_name, s.grandfather_name].filter(Boolean);
  return parts.join(" ").trim() || s.name;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

const STEPS = [
  { id: 1, title: "Filters", description: "Grade, section & stream", icon: Filter },
  { id: 2, title: "Select students", description: "Review & choose who to promote", icon: List },
  { id: 3, title: "Confirm", description: "Promote selected students", icon: CheckCircle },
];

function PromotePageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[70vh] w-full bg-transparent">
      <style>{`
        .spinner-svg { animation: spinner-rotate 2s linear infinite; }
        .spinner-circle {
          stroke-dasharray: 1, 200;
          stroke-dashoffset: 0;
          animation: spinner-stretch 1.5s ease-in-out infinite;
          stroke-linecap: round;
        }
        @keyframes spinner-rotate { 100% { transform: rotate(360deg); } }
        @keyframes spinner-stretch {
          0% { stroke-dasharray: 1, 200; stroke-dashoffset: 0; }
          50% { stroke-dasharray: 90, 200; stroke-dashoffset: -35px; }
          100% { stroke-dasharray: 90, 200; stroke-dashoffset: -124px; }
        }
      `}</style>
      <svg className="h-10 w-10 text-zinc-800 dark:text-zinc-200 spinner-svg" viewBox="25 25 50 50">
        <circle className="spinner-circle" cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="4" />
      </svg>
    </div>
  );
}

export default function PromoteStudentsClient() {
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string>("");
  const [currentGrade, setCurrentGrade] = useState<GradeRow | null>(null);
  const [nextGrade, setNextGrade] = useState<GradeRow | null>(null);
  const [students, setStudents] = useState<StudentListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [streamFilter, setStreamFilter] = useState<string>("all");

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteBusy, setPromoteBusy] = useState(false);

  const [targetStreamForAll, setTargetStreamForAll] = useState<string>("");
  const [targetStreamByStudentId, setTargetStreamByStudentId] = useState<Record<number, string>>({});

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewStudentId, setReviewStudentId] = useState<number | null>(null);
  const [reviewData, setReviewData] = useState<StudentDetails | null>(null);

  const needsStreamSelection = useMemo(() => {
    if (!nextGrade) return false;
    if (typeof nextGrade.has_stream === "boolean") return nextGrade.has_stream;
    return nextGrade.grade_name.includes("11") || nextGrade.grade_name.includes("12");
  }, [nextGrade]);

  const gradeHasStream = useMemo(() => {
    if (!currentGrade) return false;
    if (typeof currentGrade.has_stream === "boolean") return currentGrade.has_stream;
    return currentGrade.grade_name.includes("11") || currentGrade.grade_name.includes("12");
  }, [currentGrade]);

  const availableSections = useMemo(() => {
    const sections = [...new Set(students.map((s) => s.section).filter(Boolean))] as string[];
    return sections.sort();
  }, [students]);

  const availableStreams = useMemo(() => {
    if (!gradeHasStream) return [] as string[];
    const streams = [...new Set(students.map((s) => s.stream).filter(isStreamValue))] as string[];
    return streams.length ? streams.sort() : ["Natural", "Social"];
  }, [gradeHasStream, students]);

  const selectedStudents = useMemo(() => {
    const ids = selectedStudentIds;
    return students.filter((s) => ids.has(s.id));
  }, [students, selectedStudentIds]);

  const filteredStudents = useMemo(() => {
    let list = students;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const full = `${s.student_id} ${getFullName(s)}`.toLowerCase();
        return full.includes(q);
      });
    }
    if (sectionFilter !== "all") list = list.filter((s) => s.section === sectionFilter);
    if (streamFilter !== "all") list = list.filter((s) => (s.stream ?? "") === streamFilter);
    return list;
  }, [students, searchQuery, sectionFilter, streamFilter]);

  const allFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every((s) => selectedStudentIds.has(s.id));
  }, [filteredStudents, selectedStudentIds]);

  const someFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.some((s) => selectedStudentIds.has(s.id)) && !allFilteredSelected;
  }, [filteredStudents, selectedStudentIds, allFilteredSelected]);

  const resetPromotionState = () => {
    setTargetStreamForAll("");
    setTargetStreamByStudentId({});
  };

  const fetchGrades = async () => {
    const res = await fetch("/api/admin/student-promotions", { cache: "no-store" });
    if (!res.ok) {
      throw new Error((await res.json().catch(() => null))?.error || "Failed to load grades");
    }
    const json = (await res.json()) as { grades: GradeRow[] };
    setGrades(json.grades || []);
  };

  const fetchGradeList = async (gradeId: string) => {
    setListLoading(true);
    setSelectedStudentIds(new Set());
    setSectionFilter("all");
    setStreamFilter("all");
    resetPromotionState();
    try {
      const res = await fetch(`/api/admin/student-promotions?gradeId=${encodeURIComponent(gradeId)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => null))?.error || "Failed to load students");
      }
      const json = (await res.json()) as {
        currentGrade: GradeRow | null;
        nextGrade: GradeRow | null;
        students: StudentListRow[];
      };
      setCurrentGrade(json.currentGrade);
      setNextGrade(json.nextGrade);
      setStudents(json.students || []);
    } finally {
      setListLoading(false);
    }
  };

  const openReview = async (studentId: number) => {
    if (!selectedGradeId) return;
    setReviewOpen(true);
    setReviewBusy(true);
    setReviewStudentId(studentId);
    setReviewData(null);
    try {
      const res = await fetch(
        `/api/admin/student-promotions/student?gradeId=${encodeURIComponent(selectedGradeId)}&studentId=${studentId}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        throw new Error((await res.json().catch(() => null))?.error || "Failed to load student results");
      }
      setReviewData((await res.json()) as StudentDetails);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load student results");
      setReviewOpen(false);
    } finally {
      setReviewBusy(false);
    }
  };

  const toggleSelectAllFiltered = () => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredStudents.forEach((s) => next.delete(s.id));
      } else {
        filteredStudents.forEach((s) => next.add(s.id));
      }
      return next;
    });
  };

  const toggleStudent = (id: number) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openPromote = () => {
    if (!nextGrade) {
      toast.error("No next grade found for this grade.");
      return;
    }
    if (selectedStudentIds.size === 0) {
      toast.error("Select at least one student to promote.");
      return;
    }
    resetPromotionState();
    setPromoteOpen(true);
  };

  const applyStreamToAll = (stream: string) => {
    setTargetStreamForAll(stream);
    setTargetStreamByStudentId((prev) => {
      const next: Record<number, string> = { ...prev };
      selectedStudents.forEach((s) => {
        next[s.id] = stream;
      });
      return next;
    });
  };

  const promoteSelected = async () => {
    if (!currentGrade || !nextGrade) return;
    const ids = Array.from(selectedStudentIds);
    if (ids.length === 0) return;

    if (needsStreamSelection) {
      const missing = ids.filter((id) => !isStreamValue(targetStreamByStudentId[id] ?? targetStreamForAll));
      if (missing.length > 0) {
        toast.error("Please select a stream for all selected students.");
        return;
      }
    }

    setPromoteBusy(true);
    try {
      const perStudentStreamKeys = Object.keys(targetStreamByStudentId || {});
      const shouldSendPerStudentStreams = needsStreamSelection && perStudentStreamKeys.length > 0;
      const res = await fetch("/api/admin/student-promotions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromGradeId: currentGrade.id,
          toGradeId: nextGrade.id,
          studentIds: ids,
          streamForAll: needsStreamSelection && isStreamValue(targetStreamForAll) ? targetStreamForAll : undefined,
          streamByStudentId: shouldSendPerStudentStreams ? targetStreamByStudentId : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Promotion failed");
      }
      toast.success(`Promoted ${json.promotedCount ?? ids.length} student(s) to ${nextGrade.grade_name}`);
      setPromoteOpen(false);
      await fetchGradeList(String(currentGrade.id));
    } catch (e: any) {
      toast.error(e?.message || "Promotion failed");
    } finally {
      setPromoteBusy(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await fetchGrades();
      } catch (e: any) {
        toast.error(e?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedGradeId) {
      setStudents([]);
      setCurrentGrade(null);
      setNextGrade(null);
      setSelectedStudentIds(new Set());
      resetPromotionState();
      return;
    }
    fetchGradeList(selectedGradeId).catch((e: any) => toast.error(e?.message || "Failed to load students"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGradeId]);

  if (loading) return <PromotePageSpinner />;

  const currentStep = selectedGradeId ? (selectedStudentIds.size > 0 ? 3 : 2) : 1;

  return (
    <div className="flex-1 space-y-6 p-4 lg:p-8 bg-transparent min-h-screen">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Promote Students</h1>
            <p className="text-muted-foreground mt-1">
              Review students’ grade-scoped results and promote them to the next grade. Only Grade 9, 10, and 11 can be
              upgraded (to 10, 11, and 12). Students not promoted remain in their current grade.
            </p>
          </div>
          <Button
            onClick={openPromote}
            className="gap-2"
            disabled={!nextGrade || selectedStudentIds.size === 0 || listLoading}
          >
            <ArrowUpRight className="h-4 w-4" />
            Promote Selected
          </Button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 flex-wrap">
        {STEPS.map((step, i) => (
          <React.Fragment key={step.id}>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${
                currentStep >= step.id
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted/50 border-transparent text-muted-foreground"
              }`}
            >
              <step.icon className="h-4 w-4" />
              <span className="font-medium">{step.title}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Filters */}
      <Card className="shadow-sm border-muted/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
          <CardDescription>
            Select grade, section, and stream (if applicable). Only students in the selected filters are listed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>From grade</Label>
              <Select value={selectedGradeId} onValueChange={setSelectedGradeId} disabled={listLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.grade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <Select
                value={sectionFilter}
                onValueChange={setSectionFilter}
                disabled={!selectedGradeId || listLoading || availableSections.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sections</SelectItem>
                  {availableSections.map((sec) => (
                    <SelectItem key={sec} value={sec}>
                      {sec}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {gradeHasStream && (
              <div className="space-y-2">
                <Label>Stream</Label>
                <Select
                  value={streamFilter}
                  onValueChange={setStreamFilter}
                  disabled={!selectedGradeId || listLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All streams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All streams</SelectItem>
                    {availableStreams.map((str) => (
                      <SelectItem key={str} value={str}>
                        {str}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10 w-full"
                  placeholder="By ID or full name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={!selectedGradeId || listLoading}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {currentGrade && (
              <Badge variant="secondary">{currentGrade.grade_name}</Badge>
            )}
            {currentGrade && nextGrade && <span className="text-muted-foreground">→</span>}
            {nextGrade && <Badge>{nextGrade.grade_name}</Badge>}
            {needsStreamSelection && nextGrade && (
              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                Stream required
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Students table */}
      <Card className="shadow-sm border-muted/60 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <List className="h-4 w-4" />
                Students
              </CardTitle>
              <CardDescription>
                {selectedGradeId
                  ? `Showing ${filteredStudents.length} student(s). Selected ${selectedStudentIds.size}. Only selected students will be promoted; others remain in the same grade.`
                  : "Select a grade in Filters to view students."}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (selectedStudentIds.size === 0) {
                  toast.error("Select at least one student first.");
                  return;
                }
                openPromote();
              }}
              disabled={!selectedGradeId || !nextGrade || selectedStudentIds.size === 0 || listLoading}
            >
              <Users className="h-4 w-4" />
              Bulk promote
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {listLoading ? (
            <div className="flex items-center justify-center py-20 min-h-[200px]">
              <div className="flex flex-col items-center gap-3">
                <svg className="h-8 w-8 text-primary animate-spin" viewBox="0 0 24 24" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-muted-foreground">Loading students...</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                    <TableHead className="w-[48px] text-center">
                      <Checkbox
                        checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                        onCheckedChange={toggleSelectAllFiltered}
                        disabled={!selectedGradeId || filteredStudents.length === 0}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="font-semibold">Student ID</TableHead>
                    <TableHead className="font-semibold">Full name</TableHead>
                    <TableHead className="font-semibold">Section</TableHead>
                    <TableHead className="font-semibold">Stream</TableHead>
                    <TableHead className="text-right font-semibold">Subjects</TableHead>
                    <TableHead className="text-right font-semibold">Exams</TableHead>
                    <TableHead className="text-right font-semibold">Overall</TableHead>
                    <TableHead className="text-right font-semibold w-[100px]">Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!selectedGradeId ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                        Select a grade in Filters to load students.
                      </TableCell>
                    </TableRow>
                  ) : filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                        No students match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((s, idx) => (
                      <TableRow
                        key={s.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          idx % 2 === 1 ? "bg-muted/20" : ""
                        }`}
                      >
                        <TableCell className="w-[48px] text-center">
                          <Checkbox
                            checked={selectedStudentIds.has(s.id)}
                            onCheckedChange={() => toggleStudent(s.id)}
                            aria-label={`Select ${getFullName(s)}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{s.student_id}</TableCell>
                        <TableCell className="font-medium">{getFullName(s)}</TableCell>
                        <TableCell>{s.section}</TableCell>
                        <TableCell>
                          {s.stream ? (
                            <Badge variant="secondary" className="text-xs">{s.stream}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{s.registered_subjects_count}</TableCell>
                        <TableCell className="text-right">{s.exams_taken}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold tabular-nums">{formatPercent(s.overall_percentage)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openReview(s.id)}>
                            <Eye className="h-3.5 w-3.5" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={promoteOpen} onOpenChange={(open) => (!promoteBusy ? setPromoteOpen(open) : undefined)}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Promote selected students</DialogTitle>
            <DialogDescription>
              Promoting from <span className="font-medium">{currentGrade?.grade_name ?? "—"}</span> to{" "}
              <span className="font-medium">{nextGrade?.grade_name ?? "—"}</span>.
              {needsStreamSelection && " The target grade requires selecting a stream."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {needsStreamSelection && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Stream selection</p>
                    <p className="text-xs text-muted-foreground">
                      Choose a stream per student, or apply one stream to all selected students.
                    </p>
                  </div>
                  <div className="w-full sm:max-w-[220px] space-y-2">
                    <Label>Apply to all</Label>
                    <Select
                      value={targetStreamForAll}
                      onValueChange={(v) => applyStreamToAll(v)}
                      disabled={promoteBusy}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select stream" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Natural">Natural</SelectItem>
                        <SelectItem value="Social">Social</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <ScrollArea className="max-h-[40vh] pr-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Current</TableHead>
                        <TableHead>Target stream</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedStudents.map((s) => {
                        const current = s.stream ?? "—";
                        const target = targetStreamByStudentId[s.id] ?? "";
                        const invalid = !isStreamValue(target) && promoteOpen;
                        return (
                          <TableRow key={`promote-${s.id}`} className="hover:bg-muted/40">
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{getFullName(s)}</span>
                                <span className="text-xs text-muted-foreground">{s.student_id}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{current}</Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={target}
                                onValueChange={(v) =>
                                  setTargetStreamByStudentId((prev) => ({ ...prev, [s.id]: v }))
                                }
                                disabled={promoteBusy}
                              >
                                <SelectTrigger className={invalid ? "border-amber-500" : ""}>
                                  <SelectValue placeholder="Select stream" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Natural">Natural</SelectItem>
                                  <SelectItem value="Social">Social</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}

            {!needsStreamSelection && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  The target grade does not require streams. Students will be moved to the next grade.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild>
              <Button variant="outline" disabled={promoteBusy}>
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={promoteSelected} disabled={promoteBusy}>
              {promoteBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Promoting...
                </>
              ) : (
                "Confirm promotion"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={(open) => (!reviewBusy ? setReviewOpen(open) : undefined)}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Student results review</DialogTitle>
            <DialogDescription>
              All subjects the student studies in this grade. Switch tabs to see exam results per subject.
            </DialogDescription>
          </DialogHeader>

          {reviewBusy || !reviewData ? (
            <div className="flex items-center justify-center py-14 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading results...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{reviewData.grade.grade_name}</Badge>
                <Badge variant="secondary">
                  {getFullName(reviewData.student)}
                </Badge>
                <Badge variant="outline">{reviewData.student.student_id}</Badge>
                {reviewData.student.stream && (
                  <Badge variant="outline">Stream: {reviewData.student.stream}</Badge>
                )}
                <Badge variant="outline">Section: {reviewData.student.section}</Badge>
              </div>

              {(() => {
                const subjectList: SubjectExamResult[] =
                  reviewData.subject_exam_results?.length
                    ? reviewData.subject_exam_results
                    : reviewData.registered_subjects.map((s) => ({
                        subject_id: s.subject_id,
                        subject_name: s.subject_name,
                        stream: s.stream,
                        exams: [],
                      }));
                const defaultId = subjectList[0] ? String(subjectList[0].subject_id) : "0";
                return (
                  <Tabs defaultValue={defaultId} className="w-full">
                    <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                      {subjectList.map((sub) => (
                        <TabsTrigger
                          key={sub.subject_id}
                          value={String(sub.subject_id)}
                          className="flex-1 min-w-0 text-xs sm:text-sm"
                        >
                          {sub.subject_name}
                          {sub.stream && sub.stream !== "Common" ? ` (${sub.stream})` : ""}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {subjectList.length === 0 ? (
                      <div className="mt-4 py-8 text-center text-sm text-muted-foreground">
                        No subjects assigned to this grade.
                      </div>
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
                                      No exams for this subject in this grade yet.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  sub.exams.map((exam) => (
                                    <TableRow key={exam.exam_id} className="hover:bg-muted/30">
                                      <TableCell className="font-medium">{exam.exam_title}</TableCell>
                                      <TableCell>{formatDate(exam.exam_date)}</TableCell>
                                      <TableCell className="text-right tabular-nums">
                                        {exam.marks_obtained} / {exam.total_marks}
                                      </TableCell>
                                      <TableCell className="text-right font-medium tabular-nums">
                                        {formatPercent(exam.percentage)}
                                      </TableCell>
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

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild>
              <Button type="button">Close</Button>
            </DialogClose>
            {reviewStudentId != null && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  toggleStudent(reviewStudentId);
                  toast.success("Selection updated");
                }}
              >
                Toggle selection
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

