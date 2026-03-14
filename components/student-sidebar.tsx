"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  FileText,
  Lock,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
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

export function StudentSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = React.useState(false);

  const navItems = [
    {
      title: "Dashboard",
      url: "/student",
      icon: LayoutDashboard,
      isActive: pathname === "/student",
    },
    {
      title: "Results",
      url: "/student/results",
      icon: FileText,
      isActive: pathname.startsWith("/student/results"),
    },
    {
      title: "Password",
      url: "/student/password",
      icon: Lock,
      isActive: pathname.startsWith("/student/password"),
    },
  ];

  const handleLogoutConfirm = async () => {
    if (loggingOut) return;
    try {
      setLoggingOut(true);
      setLogoutConfirmOpen(false);
      await fetch("/api/student/auth/logout", { method: "POST" });
    } catch {
      // ignore errors, still navigate away
    } finally {
      setLoggingOut(false);
      router.push("/student/login");
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0! border-none bg-transparent flex flex-col"
      {...props}
    >
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white text-lg font-semibold">
            S
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">Student Portal</span>
              <span className="text-xs text-muted-foreground leading-tight">
                Results & dashboard
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 px-0 gap-4 mt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-gray-600 mb-1">
            {!isCollapsed && "Navigation"}
          </SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={item.isActive}
                  tooltip={item.title}
                  className="hover:bg-gray-200/80 hover:text-gray-800 transition-all duration-200 h-9 text-sm font-medium dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                >
                  <Link href={item.url}>
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 sm:px-3 pb-2 sm:pb-3 pt-2">
        <button
          type="button"
          onClick={() => setLogoutConfirmOpen(true)}
          className="w-full min-h-[44px] sm:min-h-0 flex items-center justify-between rounded-lg border px-3 py-2.5 sm:py-2 text-xs sm:text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation"
          disabled={loggingOut}
          aria-label="Log out"
        >
          <span className="flex items-center gap-2">
            <LogOut className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
            {!isCollapsed && <span>{loggingOut ? "Logging out..." : "Log out"}</span>}
          </span>
          {!isCollapsed && (
            <Badge
              variant="outline"
              className="text-[10px] text-red-600 border-red-200 dark:border-red-800 shrink-0"
            >
              Exit
            </Badge>
          )}
        </button>
      </SidebarFooter>
      <SidebarRail />

      <AlertDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out of the student dashboard?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleLogoutConfirm();
              }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {loggingOut ? "Logging out…" : "Log out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}

