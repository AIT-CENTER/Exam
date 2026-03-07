"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { StudentSidebar } from "@/components/student-sidebar";
import { StudentHeader } from "@/components/student-header";

export default function StudentLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Treat the dedicated login route as a standalone page without dashboard chrome.
  const hideSidebarAndHeader = pathname === "/student/login";

  if (hideSidebarAndHeader) {
    return <>{children}</>;
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

