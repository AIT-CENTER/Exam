"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { DashboardSpinner } from "@/components/dashboard-spinner";

type MeResponse =
  | { authenticated: false }
  | {
      authenticated: true;
      mustSetPassword: boolean;
      student: { full_name: string; student_id: string } | null;
    };

export default function StudentPasswordPage() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [verifyId, setVerifyId] = useState("");
  const [verifyPhone, setVerifyPhone] = useState("");

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

  async function save() {
    try {
      if (!newPassword) return toast.error("Enter a new password");
      if (newPassword !== confirm) return toast.error("Passwords do not match");

      setBusy(true);
      const res = await fetch("/api/student/password/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword || undefined,
          new_password: newPassword,
          verify_student_id: verifyId || undefined,
          verify_phone: verifyPhone || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to update password");
      toast.success("Password saved");
      window.location.href = "/student";
    } catch (e: any) {
      toast.error(e?.message || "Failed to update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 lg:p-8">
      {loading ? (
        <DashboardSpinner />
      ) : me?.authenticated ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {me.mustSetPassword ? "Create password" : "Update password"}
            </CardTitle>
            <CardDescription>
              {me.student?.full_name ?? "Student"} {me.student ? `• ${me.student.student_id}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {me.mustSetPassword && (
              <div className="rounded-lg border p-4 space-y-4">
                <div className="text-sm font-medium">Verification required</div>
                <p className="text-xs text-muted-foreground">
                  To create your password for the first time, verify using your Student ID and phone number.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Student ID</Label>
                    <Input
                      value={verifyId}
                      onChange={(e) => setVerifyId(e.target.value.toUpperCase())}
                      placeholder="e.g. ST-001"
                      autoCapitalize="characters"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone number</Label>
                    <Input value={verifyPhone} onChange={(e) => setVerifyPhone(e.target.value)} placeholder="e.g. 09xxxxxxxx" />
                  </div>
                </div>
              </div>
            )}
            {!me.mustSetPassword && (
              <div className="space-y-2">
                <Label>Current password</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>New password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Confirm new password</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button onClick={save} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save password
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Not signed in</CardTitle>
            <CardDescription>Sign in on the login page first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/student/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

