"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Header } from "@/components/app-header";

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Slug page: /teacher/exams/[id]
  const isSlugPage =
    pathname.startsWith("/teacher/exams/") && pathname !== "/teacher/exams";

  const hideSidebarAndHeader = isSlugPage;

  if (hideSidebarAndHeader) {
    return <>{children}</>;
  }

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <Header title="" />
        {children}
      </SidebarInset>
    </>
  );
}
