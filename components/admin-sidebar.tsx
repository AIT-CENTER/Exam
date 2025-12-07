// admin-sidebar.tsx (Updated version)
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import {
  Users,
  Home,
  Settings,
  ChevronsUpDown,
  type LucideIcon,
  BookOpen,
  Building2,
  Activity,
  Shield, // Icon for Security
  Plus, // Added for new items
  BarChart3, // Icon for Results
  UserCheck, // Icon for Individual Result
  GraduationCap, // Icon for Teachers
  Award, // Icon for Grades
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
} from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { NavUser } from "./nav-user"
import { Skeleton } from "@/components/ui/skeleton"

interface NavItem {
  title: string
  url: string
  icon: LucideIcon
  isActive: boolean
}

interface QuickAccessItem {
  title: string
  url: string
  icon: LucideIcon
  isActive: boolean // Added isActive here for consistency
}

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = React.useState<{ name: string; email: string; avatar?: string } | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // Fetch admin profile from DB
          const { data: adminData, error } = await supabase
            .from('admin')
            .select('full_name, email')
            .eq('id', session.user.id)
            .single()

          if (error || !adminData) {
            console.error('Error fetching admin profile:', error)
            router.push('/') // Redirect to login if no profile
            return
          }

          setUser({
            name: adminData.full_name,
            email: adminData.email,
            // avatar: adminData.avatar_url, // Add if you have avatar field
          })
        } else {
          router.push('/')
        }
      } catch (error) {
        console.error('Error fetching user:', error)
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/auth/alpha')
      } else if (session?.user) {
        fetchUser()
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const data = {
    teams: [
      {
        name: "Exam Administration",
        logo: Shield,
        plan: "Administrator",
      },
      {
        name: "Exam Management",
        logo: BookOpen,
        plan: "Coordinator",
      },
    ],
    // --- UPDATED Main Navigation Links ---
    navMain: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: Home,
        isActive: pathname === "/dashboard",
      },
      {
        title: "Subjects",
        url: "/dashboard/subject",
        icon: Building2,
        isActive: pathname.startsWith("/dashboard/subject"),
      },
      {
        title: "Students",
        url: "/dashboard/students",
        icon: Users,
        isActive: pathname.startsWith("/dashboard/students"),
      },
      // --- NEW GRADES PAGE ADDED TO MAIN MENU ---
      {
        title: "Grades",
        url: "/dashboard/grades",
        icon: Award,
        isActive: pathname.startsWith("/dashboard/grades"),
      },
    ] as NavItem[],
    // --- NEW QUICK ACTIONS SECTION ---
    quickActions: [
      {
        title: "New Student",
        url: "/dashboard/students/new",
        icon: Plus,
        isActive: pathname === "/dashboard/students/new",
      },
    ] as QuickAccessItem[],
    // --- UPDATED QUICK ACCESS / SYSTEM LINKS ---
    quickAccess: [
      // --- SECURITY CHANGED TO TEACHERS ---
      {
        title: "Teachers",
        url: "/dashboard/teachers",
        icon: GraduationCap,
        isActive: pathname.startsWith("/dashboard/teachers"),
      },
      {
        title: "Settings",
        url: "/dashboard/settings",
        icon: Settings,
        isActive: pathname.startsWith("/dashboard/settings"),
      },
    ] as QuickAccessItem[],
  }

  const [activeTeam, setActiveTeam] = React.useState(data.teams[0])

  // Function to render sidebar items with tooltip
  const renderSidebarItem = (item: { title: string; url: string; icon: LucideIcon; isActive: boolean }) => (
    <Tooltip key={item.title}>
      <TooltipTrigger asChild>
        <SidebarMenuButton
          asChild
          isActive={item.isActive}
          className="hover:bg-gray-200/80 hover:text-gray-800 transition-all duration-200 h-8 text-sm"
        >
          <Link href={item.url}>
            <item.icon className="h-5 w-5" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </TooltipTrigger>
      <TooltipContent 
        side="right" 
        align="center"
        className="bg-gray-900 text-white text-xs px-2 py-1 rounded-md"
      >
        {item.title}
      </TooltipContent>
    </Tooltip>
  )

  // Loading State
  if (loading || !user) {
    return (
      <TooltipProvider>
        <Sidebar collapsible="icon" className="border-r border-gray-200/60" {...props}>
          <SidebarHeader className="p-3">
            <SidebarMenu>
              <SidebarMenuItem>
                {/* Team Selector Skeleton */}
                <div className="flex items-center gap-3 p-2 rounded-lg">
                  <Skeleton className="h-7 w-7 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                    <Skeleton className="h-2.5 w-16 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <Skeleton className="h-3.5 w-3.5 bg-gray-200 rounded animate-pulse" />
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          
          <SidebarContent>
            {/* Main Menu Skeleton */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-gray-600 mb-1">
                <Skeleton className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
              </SidebarGroupLabel>
              <SidebarMenu>
                {[...Array(5)].map((_, i) => ( // Changed from 4 to 5 for the new Results item
                  <SidebarMenuItem key={i}>
                    <div className="flex items-center gap-3 p-2 rounded-md">
                      <Skeleton className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
                      <Skeleton className="h-4 flex-1 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>

            {/* Quick Actions Skeleton */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-gray-600 mb-1">
                <Skeleton className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
              </SidebarGroupLabel>
              <SidebarMenu>
                {[...Array(1)].map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <div className="flex items-center gap-3 p-2 rounded-md">
                      <Skeleton className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
                      <Skeleton className="h-4 flex-1 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>

            {/* System Links Skeleton */}
            <SidebarGroup className="mt-auto">
              <SidebarGroupLabel className="text-xs font-medium text-gray-600 px-2 mb-1">
                <Skeleton className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
              </SidebarGroupLabel>
              <SidebarMenu>
                {[...Array(2)].map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <div className="flex items-center gap-3 p-2 rounded-md">
                      <Skeleton className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
                      <Skeleton className="h-4 flex-1 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          
          <SidebarFooter>
            {/* User Profile Skeleton */}
            <div className="flex items-center gap-3 p-2">
              <Skeleton className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                <Skeleton className="h-2.5 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </SidebarFooter>
          
          <SidebarRail />
        </Sidebar>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Sidebar collapsible="icon" className="border-r border-gray-200/60" {...props}>
        <SidebarHeader className="p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent cursor-pointer data-[state=open]:text-sidebar-accent-foreground hover:bg-gray-100/80 transition-all duration-200 h-10"
                  >
                    <div className="flex -ms-2 aspect-square size-7 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                      <activeTeam.logo className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold text-gray-600 text-sm">{activeTeam.name}</span>
                      <span className="truncate text-xs text-gray-600">{activeTeam.plan}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto text-gray-600 size-3.5" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-52 rounded-lg shadow-md animate-scale-in"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  {data.teams.map((team) => (
                    <DropdownMenuItem
                      key={team.name}
                      onClick={() => setActiveTeam(team)}
                      className="gap-2.5 p-2.5 hover:bg-gray-100/80 transition-colors duration-200"
                    >
                      <div className="flex -ms-1 size-5 items-center justify-center rounded-sm border border-gray-200">
                        <team.logo className="size-3.5 shrink-0" />
                      </div>
                      <span className="text-sm">{team.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="">
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-gray-600 mb-1">Main Menu</SidebarGroupLabel>
            <SidebarMenu>
              {data.navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {renderSidebarItem(item)}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

          {/* NEW QUICK ACTIONS SECTION */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-gray-600 mb-1">Quick Actions</SidebarGroupLabel>
            <SidebarMenu>
              {data.quickActions.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {renderSidebarItem(item)}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel className="text-xs font-medium text-gray-600 px-2 mb-1">System</SidebarGroupLabel>
            <SidebarMenu>
              {data.quickAccess.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {renderSidebarItem(item)}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={user!} onLogout={() => {
            supabase.auth.signOut()
            router.push('/')
          }} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </TooltipProvider>
  )
}