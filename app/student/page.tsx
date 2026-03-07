"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardSpinner } from "@/components/dashboard-spinner";

type MeResponse =
  | { authenticated: false }
  | {
      authenticated: true;
      mustSetPassword: boolean;
      student: { full_name: string; student_id: string; grade_id: number; grade_name: string | null; section: string; stream: string | null } | null;
    };

export default function StudentHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/student/me", { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as MeResponse;
        setMe(json);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Student Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">View your results and manage your password.</p>
      </div>

      {loading ? (
        <DashboardSpinner />
      ) : me?.authenticated ? (
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
            <p className="text-sm text-muted-foreground">Use the sidebar menu to navigate your dashboard.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center justify-center py-14 text-muted-foreground text-sm">
          Redirecting to login…
        </div>
      )}
    </div>
  );
}

