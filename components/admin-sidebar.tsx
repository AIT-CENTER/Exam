"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import {
  Users,
  Home,
  type LucideIcon,
  BookOpen,
  Plus,
  GraduationCap,
  Award,
  ClipboardList,
  BarChart3,
  ArrowUpRight,
  FileText,
} from "lucide-react"

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
} from "@/components/ui/sidebar"
import Link from "next/link"
import { NavUser } from "./nav-user"
import { Skeleton } from "@/components/ui/skeleton"

interface NavItem {
  title: string
  url: string
  icon: LucideIcon
  isActive: boolean
  pageKey?: string
}

interface QuickAccessItem {
  title: string
  url: string
  icon: LucideIcon
  isActive: boolean 
}

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = React.useState<{ name: string; email: string; avatar?: string } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [role, setRole] = React.useState<"super_admin" | "admin" | null>(null)
  const [pageAccess, setPageAccess] = React.useState<Record<string, boolean>>({})
  
  const { state } = useSidebar()

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data: adminData, error } = await supabase
            .from('admin')
            .select('full_name, email')
            .eq('id', session.user.id)
            .single()

          if (!error && adminData) {
            setUser({
              name: adminData.full_name,
              email: adminData.email,
            })
          }

          // Fetch role + permissions
          try {
            const res = await fetch("/api/admin/page-permissions", { cache: "no-store" })
            if (res.ok) {
              const json = await res.json()
              setRole(json.role ?? "super_admin")
              setPageAccess(json.permissions ?? {})
            }
          } catch {
            // ignore; fallback is unrestricted
          }
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/auth/alpha')
      } else if (session?.user) {
        fetchUser()
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const canAccess = (pageKey?: string) => {
    if (!pageKey) return true
    if (!role || role === "super_admin") return true
    return pageAccess[pageKey] ?? true
  }

  // Re-ordered Navigation Links
  const data = {
    navMain: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: Home,
        isActive: pathname === "/dashboard",
        pageKey: "dashboard_home",
      },
      {
        title: "Students",
        url: "/dashboard/students",
        icon: Users,
        isActive: pathname.startsWith("/dashboard/students"),
        pageKey: "students_page",
      },
      {
        title: "Promote Students",
        url: "/dashboard/promotions",
        icon: ArrowUpRight,
        isActive: pathname.startsWith("/dashboard/promotions"),
        pageKey: "students_promotions",
      },
      {
        title: "Results Archive",
        url: "/dashboard/results-archive",
        icon: FileText,
        isActive: pathname.startsWith("/dashboard/results-archive"),
        pageKey: "results_archive",
      },
      {
        title: "Teachers",
        url: "/dashboard/teachers",
        icon: GraduationCap,
        isActive: pathname.startsWith("/dashboard/teachers"),
        pageKey: "teachers_page",
      },
      {
        title: "Subjects",
        url: "/dashboard/subject",
        icon: BookOpen,
        isActive: pathname.startsWith("/dashboard/subject"),
        pageKey: "subjects_page",
      },
      {
        title: "Grades",
        url: "/dashboard/grades",
        icon: Award,
        isActive: pathname.startsWith("/dashboard/grades"),
        pageKey: "grades_page",
      },
      {
        title: "Exam Oversight",
        url: "/dashboard/exams",
        icon: ClipboardList,
        isActive: pathname.startsWith("/dashboard/exams"),
        pageKey: "exams_page",
      },
      {
        title: "Analytics",
        url: "/dashboard/analytics",
        icon: BarChart3,
        isActive: pathname.startsWith("/dashboard/analytics"),
        pageKey: "analytics",
      },
    ] as NavItem[],
    quickActions: [
      {
        title: "New Student",
        url: "/dashboard/students/new",
        icon: Plus,
        isActive: pathname === "/dashboard/students/new",
      },
    ] as QuickAccessItem[],
  }

  // Only show nav items the admin is allowed to use (hidden when not permitted, not locked)
  const visibleNavMain = data.navMain.filter((item) => canAccess(item.pageKey))

  const renderSidebarItem = (item: {
    title: string
    url: string
    icon: LucideIcon
    isActive: boolean
    pageKey?: string
  }) => (
    <SidebarMenuButton
      key={item.title}
      asChild
      isActive={item.isActive}
      tooltip={item.title}
      className="h-9 text-sm font-medium transition-colors duration-200"
    >
      <Link href={item.url} className="flex items-center gap-3">
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="truncate flex-1">{item.title}</span>
      </Link>
    </SidebarMenuButton>
  )

  // Loading State with Adaptive Skeletons (bg-zinc-200 for light, bg-zinc-800 for dark)
  if (loading || !user) {
    return (
      <Sidebar collapsible="icon" className="border-r-0! border-none bg-transparent" {...props}>
        <SidebarHeader className="p-4 flex items-center justify-center">
          <Skeleton className="h-10 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        </SidebarHeader>
        <SidebarContent className="px-3">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            ))}
          </div>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <Skeleton className="h-10 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        </SidebarFooter>
      </Sidebar>
    )
  }

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0! border-none bg-transparent"
      {...props}
    >
      <SidebarHeader className="">
        <SidebarMenu>
          <SidebarMenuItem>
            {/* size="lg" ensures it has enough room, but the inner flex aligns it perfectly center when collapsed */}
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-black/5 dark:hover:bg-white/5"
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm">
                <GraduationCap className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Alpha School</span>
                <span className="truncate text-xs text-muted-foreground">Admin Platform</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-0 gap-4">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground group-data-[collapsible=icon]:hidden">
            Overview
          </SidebarGroupLabel>
          <SidebarMenu>
            {visibleNavMain.map((item) => (
              <SidebarMenuItem key={item.title}>{renderSidebarItem(item)}</SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground group-data-[collapsible=icon]:hidden">
            Quick Actions
          </SidebarGroupLabel>
          <SidebarMenu>
            {data.quickActions.map((item) => (
              <SidebarMenuItem key={item.title}>{renderSidebarItem(item)}</SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="">
        <NavUser
          user={user!}
          onLogout={() => {
            supabase.auth.signOut()
            router.push("/auth/alpha")
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}