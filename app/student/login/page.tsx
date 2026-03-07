"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

export default function StudentLoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  async function login() {
    try {
      setLoginBusy(true);
      const res = await fetch("/api/student/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: loginId, password: loginPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || json?.error || "Login failed");
      }
      toast.success("Signed in");
      router.push("/student");
    } catch (e: any) {
      toast.error(e?.message || "Login failed");
    } finally {
      setLoginBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-wrap items-center justify-center w-full gap-0 text-left bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-950 px-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Student Login</CardTitle>
          <CardDescription className="text-center">
            Enter your student ID and (if set) password to access your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Student ID</Label>
              <Input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value.toUpperCase())}
                placeholder="e.g. ST-001"
                autoCapitalize="characters"
                inputMode="text"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                type="password"
                placeholder="(Leave empty if first time)"
              />
            </div>
          </div>
          <Button onClick={login} className="w-full gap-2" disabled={loginBusy}>
            {loginBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Sign in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

