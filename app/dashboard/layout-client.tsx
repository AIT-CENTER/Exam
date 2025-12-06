"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { ModernHeader } from "@/components/admin-header";

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Pages keessatti sidebar fi header hin barbaadne
  const hideSidebarAndHeader =
    pathname === "/dashboard/exams/new" 

  if (hideSidebarAndHeader) {
    return <>{children}</>; // content qofa
  }

  return (
    <>
      <AdminSidebar />
      <SidebarInset>
        <ModernHeader title="" />
        {children}
      </SidebarInset>
    </>
  );
}
