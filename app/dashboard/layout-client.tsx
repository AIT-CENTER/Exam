"use client";

import React from "react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { ModernHeader } from "@/components/admin-header";

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    // Outer Wrapper: bg-zinc-50 (light mode) and bg-zinc-950 (dark mode)
    // Both the Header and Sidebar sit inside this and use bg-transparent to share this exact color.
    <div className="flex w-full h-screen overflow-hidden bg-[#f4f4f5] dark:bg-[#020617]">
      
      <AdminSidebar />
      
      <div className="flex flex-col flex-1 w-full h-full overflow-hidden">
        
        <ModernHeader title="Admin Dashboard" />
        
        {/* Main Content Area: ONLY this part scrolls. Distinct white/dark background with rounded corner. */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 via-gray-100 to-gray-50 dark:bg-gradient-to-b dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-t border-l border-zinc-200 dark:border-zinc-800 sm:rounded-tl-[2rem] shadow-sm relative transition-all duration-300">
          <div className="min-h-full w-full ">
            {children}
          </div>
        </main>
        
      </div>
    </div>
  );
}