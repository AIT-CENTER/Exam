"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { StudentSidebar } from "@/components/student-sidebar";
import { StudentHeader } from "@/components/student-header";

export default function StudentLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  const isLoginPage = pathname === "/student/login";

  // Always redirect to login when not authenticated; never show dashboard without auth.
  useEffect(() => {
    if (isLoginPage) {
      setAuthChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/student/me", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && !json?.authenticated) {
          router.replace("/student/login");
          return;
        }
      } catch {
        if (!cancelled) router.replace("/student/login");
        return;
      }
      if (!cancelled) setAuthChecked(true);
    })();
    return () => { cancelled = true; };
  }, [isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!authChecked) {
    return (
      <div className="flex w-full h-screen items-center justify-center bg-[#f4f4f5] dark:bg-[#020617]">
        <div className="text-sm text-muted-foreground">Redirecting to login…</div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen overflow-hidden bg-[#f4f4f5] dark:bg-[#020617]">
      <StudentSidebar />

      <div className="flex flex-col flex-1 w-full h-full overflow-hidden">
        <StudentHeader title="Student Dashboard" />

        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 via-gray-100 to-gray-50 dark:bg-gradient-to-b dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-t border-l border-zinc-200 dark:border-zinc-800 sm:rounded-tl-[2rem] shadow-sm relative transition-all duration-300">
          <div className="min-h-full w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

