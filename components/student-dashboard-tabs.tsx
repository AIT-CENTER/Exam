"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, FileText, LayoutDashboard } from "lucide-react";

export function StudentDashboardTabs() {
  const router = useRouter();
  const pathname = usePathname();

  const value = useMemo(() => {
    if (pathname.startsWith("/student/results")) return "results";
    if (pathname.startsWith("/student/password")) return "password";
    return "home";
  }, [pathname]);

  return (
    <Tabs value={value} className="w-full">
      <TabsList className="w-full grid grid-cols-3">
        <TabsTrigger value="home" onClick={() => router.push("/student")} className="gap-2">
          <LayoutDashboard className="h-4 w-4" />
          Home
        </TabsTrigger>
        <TabsTrigger value="results" onClick={() => router.push("/student/results")} className="gap-2">
          <FileText className="h-4 w-4" />
          Results
        </TabsTrigger>
        <TabsTrigger value="password" onClick={() => router.push("/student/password")} className="gap-2">
          <Lock className="h-4 w-4" />
          Password
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

