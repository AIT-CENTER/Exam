"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Activity,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  RefreshCw,
  Plus,
  Send,
  Search,
  Timer,
  ShieldOff,
  UserMinus,
} from "lucide-react";
import { getTeacherDataFromCookie } from "@/utils/teacherCookie";
import { useLiveMonitor, type LiveStudent } from "@/hooks/useLiveMonitor";
import { TextLoop } from "@/components/motion-primitives/text-loop";
import { toast } from "sonner";

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

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

export default function LiveMonitorPage() {
  const router = useRouter();
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [forceSubmitSessionId, setForceSubmitSessionId] = useState<string | null>(null);
  const [removeSessionId, setRemoveSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [addTimeSessionId, setAddTimeSessionId] = useState<string | null>(null);
  const [addTimeMinutes, setAddTimeMinutes] = useState("5");

  const {
    students,
    riskLogs,
    loading,
    error,
    fetchLiveData,
    addTimeToStudent,
    addTimeToAll,
    removeRiskFromStudent,
    removeStudentFromMonitor,
    forceSubmitExam,
  } = useLiveMonitor(teacherId);

  useEffect(() => {
    const load = async () => {
      const teacher = await getTeacherDataFromCookie();
      if (!teacher?.teacherId) {
        toast.error("Please log in as a teacher");
        router.push("/login/teacher");
        return;
      }
      setTeacherId(teacher.teacherId);
    };
    load();
  }, [router]);

  const handleAddTime = async (sessionId: string, minutes: number) => {
    try {
      await addTimeToStudent(sessionId, minutes);
      toast.success(`Added ${minutes} min`);
    } catch {
      toast.error("Failed to add time");
    }
  };

  const handleForceSubmit = async (sessionId: string) => {
    try {
      await forceSubmitExam(sessionId);
      setForceSubmitSessionId(null);
      toast.success("Exam force-submitted");
    } catch {
      toast.error("Force submit failed");
    }
  };

  const handleRemoveFromMonitor = async (sessionId: string) => {
    try {
      await removeStudentFromMonitor(sessionId);
      setRemoveSessionId(null);
      toast.success("Student removed from monitor");
    } catch {
      toast.error("Remove failed");
    }
  };

  const handleAddTimeToAll = async (minutes: number) => {
    try {
      await addTimeToAll(minutes);
      toast.success(`Added ${minutes} min to all`);
    } catch {
      toast.error("Failed to add time to all");
    }
  };

  const handleRemoveRisk = async (sessionId: string) => {
    try {
      await removeRiskFromStudent(sessionId);
      toast.success("Risk reset to 0");
    } catch {
      toast.error("Failed to remove risk");
    }
  };

  if (loading && !teacherId) {
    return <DashboardSpinner />;
  }

  const activeCount = students.filter((s) => s.status === "Active").length;
  const disconnectedCount = students.filter((s) => s.status === "Disconnected").length;
  const flaggedCount = students.filter((s) => s.isFlagged).length;

  const filteredAndSortedStudents = useMemo(() => {
    const filtered = searchQuery.trim()
      ? students.filter((s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : students;
    return [...filtered].sort((a, b) => (a.isFlagged ? 0 : 1) - (b.isFlagged ? 0 : 1));
  }, [students, searchQuery]);

  const [addTimeConfirmOpen, setAddTimeConfirmOpen] = useState(false);
  const [addTimeAllOpen, setAddTimeAllOpen] = useState(false);
  const [addTimeAllMinutes, setAddTimeAllMinutes] = useState("5");

  const handleOpenAddSpecificTime = (sessionId: string) => {
    setAddTimeSessionId(sessionId);
    setAddTimeMinutes("5");
  };

  const handleAddSpecificTime = async () => {
    if (!addTimeSessionId) return;
    const mins = parseInt(addTimeMinutes, 10);
    if (isNaN(mins) || mins < 1) {
      toast.error("Enter valid minutes");
      return;
    }
    setAddTimeConfirmOpen(true);
  };

  const handleConfirmAddTime = async () => {
    if (!addTimeSessionId) return;
    const mins = parseInt(addTimeMinutes, 10);
    if (isNaN(mins) || mins < 1) return;
    try {
      await addTimeToStudent(addTimeSessionId, mins);
      toast.success(`Added ${mins} min`);
      setAddTimeSessionId(null);
      setAddTimeMinutes("5");
    } catch {
      toast.error("Failed to add time");
    } finally {
      setAddTimeConfirmOpen(false);
    }
  };

  const handleConfirmAddTimeToAll = async () => {
    const mins = parseInt(addTimeAllMinutes, 10);
    if (isNaN(mins) || mins < 1) {
      toast.error("Enter valid minutes");
      return;
    }
    try {
      await addTimeToAll(mins);
      toast.success(`Added ${mins} min to all`);
      setAddTimeAllOpen(false);
      setAddTimeAllMinutes("5");
    } catch {
      toast.error("Failed to add time to all");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Activity className="h-6 w-6" />
          Live Monitoring
        </h1>
        <CardDescription className="mt-1">
          Real-time student status, time remaining, and risk flags. Use actions to add time or force-submit.
        </CardDescription>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{students.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Disconnected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{disconnectedCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Flagged</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{flaggedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Students</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchLiveData()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            {students.some((s) => s.status === "Active" || s.status === "Disconnected") && (
              <>
                <Button variant="outline" size="sm" onClick={() => setAddTimeAllOpen(true)}>
                  <Timer className="h-4 w-4 mr-1" />
                  Add time for all
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAddTimeToAll(5)}>
                  <Plus className="h-4 w-4 mr-1" />
                  +5 min all
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleAddTimeToAll(10)}>
                  +10 min all
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading && !teacherId ? (
            <Skeleton className="h-64 w-full" />
          ) : error ? (
            <p className="text-destructive">{error}</p>
          ) : students.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No active exam sessions. Assign an exam and have students start to see them here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time left</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedStudents.map((row) => (
                  <TableRow key={row.sessionId}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.studentId}</div>
                    </TableCell>
                    <TableCell>{row.examName}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} isFlagged={row.isFlagged} />
                    </TableCell>
                    <TableCell>
                      {row.status === "Active" || row.status === "Disconnected" ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTime(row.remainingTime)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(row.riskCount ?? 0) > 0 ? (
                        <span className="text-sm">
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            {row.riskCount}/{row.maxRiskBeforeSubmit ?? 7}
                          </Badge>
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({Math.max(0, (row.maxRiskBeforeSubmit ?? 7) - (row.riskCount ?? 0))} left)
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0/{(row.maxRiskBeforeSubmit ?? 7)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {(row.status === "Active" || row.status === "Disconnected") && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleAddTime(row.sessionId, 5)}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add 5 min
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAddTime(row.sessionId, 10)}>
                              Add 10 min
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenAddSpecificTime(row.sessionId)}>
                              <Timer className="h-4 w-4 mr-2" />
                              Add specific time
                            </DropdownMenuItem>
                            {(row.riskCount ?? 0) > 0 && (
                              <DropdownMenuItem onClick={() => handleRemoveRisk(row.sessionId)}>
                                <ShieldOff className="h-4 w-4 mr-2" />
                                Remove risk
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setRemoveSessionId(row.sessionId)}>
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove from monitor
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setForceSubmitSessionId(row.sessionId)}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Force submit
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!addTimeSessionId} onOpenChange={(o) => !o && setAddTimeSessionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add specific time</DialogTitle>
            <DialogDescription>Enter minutes to add. Respects admin max extension limit.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              min={1}
              value={addTimeMinutes}
              onChange={(e) => setAddTimeMinutes(e.target.value)}
              placeholder="Minutes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTimeSessionId(null)}>Cancel</Button>
            <Button onClick={handleAddSpecificTime}>Add time</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addTimeAllOpen} onOpenChange={setAddTimeAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add time for all students</DialogTitle>
            <DialogDescription>
              Enter minutes to add to all active/disconnected sessions. Respects the admin max extension limit.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              min={1}
              value={addTimeAllMinutes}
              onChange={(e) => setAddTimeAllMinutes(e.target.value)}
              placeholder="Minutes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTimeAllOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmAddTimeToAll}>Add time</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={addTimeConfirmOpen} onOpenChange={setAddTimeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm add time</AlertDialogTitle>
            <AlertDialogDescription>
              Add {addTimeMinutes} minute(s) to this student&apos;s exam? This will extend their end time. The total extension cannot exceed the admin-configured maximum.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAddTime}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeSessionId} onOpenChange={() => setRemoveSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from monitor?</AlertDialogTitle>
            <AlertDialogDescription>
              This student will be hidden from the live monitor. Their exam continues normally; they are not submitted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeSessionId && handleRemoveFromMonitor(removeSessionId)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!forceSubmitSessionId} onOpenChange={() => setForceSubmitSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force submit exam?</AlertDialogTitle>
            <AlertDialogDescription>
              This will submit the exam immediately with current answers. The student will not be able to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => forceSubmitSessionId && handleForceSubmit(forceSubmitSessionId)}
            >
              Force submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({ status, isFlagged }: { status: string; isFlagged: boolean }) {
  const variant =
    status === "Active"
      ? "default"
      : status === "Disconnected"
        ? "secondary"
        : "outline";
  const label = isFlagged && status === "Active" ? `${status} (flagged)` : status;
  return (
    <Badge variant={variant} className={isFlagged ? "border-amber-400 bg-amber-50 text-amber-800" : ""}>
      {status === "Disconnected" && <AlertTriangle className="h-3 w-3 mr-1" />}
      {label}
    </Badge>
  );
}
