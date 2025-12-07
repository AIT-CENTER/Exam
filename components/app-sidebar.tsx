"use client"

import * as React from "react"
import {
  GraduationCap,
  Home,
  Users,
  Shield,
  ChevronsUpDown,
  LucideIcon,
  ClipboardList,
  UserCheck,
  BarChart3,
  User,
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
import { usePathname } from "next/navigation"
import Link from "next/link"
import { AppUser } from "./app-user"
import { cn } from "@/lib/utils"

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive: boolean;
}

interface QuickAccessItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface Team {
  name: string;
  logo: LucideIcon;
  plan: string;
  isActive?: boolean;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [teacherData, setTeacherData] = React.useState<any>(null);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [activeTeam, setActiveTeam] = React.useState<Team | null>(null);

  // Get teacher data from cookie
  React.useEffect(() => {
    const getTeacherData = () => {
      try {
        const cookies = document.cookie.split(';');
        const teacherCookie = cookies.find(cookie => cookie.trim().startsWith('teacherData='));
        
        if (teacherCookie) {
          const cookieValue = teacherCookie.split('=')[1];
          const decodedValue = decodeURIComponent(cookieValue);
          const teacherData = JSON.parse(decodedValue);
          setTeacherData(teacherData);
          
          // Create teams data with active status
          const teacherTeams: Team[] = [
            {
              name: teacherData?.gradeName ? `${teacherData.gradeName} Teacher` : "Teacher",
              logo: GraduationCap,
              plan: teacherData?.subjectName || "Teacher",
              isActive: true
            },
            {
              name: "My Sections",
              logo: Users,
              plan: teacherData?.sections?.join(', ') || "Not assigned",
              isActive: false
            },
          ];
          
          setTeams(teacherTeams);
          setActiveTeam(teacherTeams[0]); // Set first team as active
        }
      } catch (error) {
        console.error("Error parsing teacher data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    getTeacherData();
  }, []);

  const data = {
    user: {
      name: teacherData?.fullName || "Loading...",
      email: teacherData?.email || "loading@teacher.edu",
      avatar: "/teacher-avatar.png",
    },
    navMain: [
      {
        title: "Dashboard",
        url: "/teacher",
        icon: Home,
        isActive: pathname === "/teacher",
      },
      {
        title: "My Exams",
        url: "/teacher/exams",
        icon: ClipboardList,
        isActive: pathname === "/teacher/exams",
      },
      {
        title: "My Students",
        url: "/teacher/students",
        icon: UserCheck,
        isActive: pathname === "/teacher/students",
      },
      {
        title: "Exam Result",
        url: "/teacher/result",
        icon: BarChart3,
        isActive: pathname === "/teacher/result",
      },
      {
        title: "Individual Result",
        url: "/teacher/individual",
        icon: User,
        isActive: pathname === "/teacher/individual",
      },
    ] as NavItem[],
    quickAccess: [] as QuickAccessItem[],
    system: [
      {
        title: "Security",
        url: "/teacher/security",
        icon: Shield,
        isActive: pathname === "/teacher/security",
      },
    ] as NavItem[],
  }

  // Skeleton loader component
  const SkeletonItem = () => (
    <div className="flex items-center space-x-3 p-2">
      <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
      <div className="h-4 bg-gray-200 rounded animate-pulse flex-1"></div>
    </div>
  );

  // Tooltip component for collapsed sidebar
  const TooltipWrapper = ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div className="relative group">
      {children}
      {isCollapsed && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
          {title}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <Sidebar collapsible="icon" className="border-r border-gray-200/60" {...props}>
        <SidebarHeader className="p-3">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <div className="mb-6">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3 mb-3"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((item) => (
                <SkeletonItem key={item} />
              ))}
            </div>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center space-x-3 p-2">
            <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="space-y-2 flex-1">
              <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
    );
  }

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r border-gray-200/60 flex flex-col"
      onCollapseChange={setIsCollapsed}
      {...props}
    >
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
                    {activeTeam ? <activeTeam.logo className="size-4" /> : <GraduationCap className="size-4" />}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-sm">
                      {activeTeam ? activeTeam.name : "Teacher"}
                    </span>
                    <span className="truncate text-xs text-gray-600">
                      {activeTeam ? activeTeam.plan : "Loading..."}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-3.5" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-52 rounded-lg shadow-md animate-scale-in"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                {teams.map((team) => (
                  <DropdownMenuItem
                    key={team.name}
                    onClick={() => setActiveTeam(team)}
                    className={cn(
                      "gap-2.5 p-2.5 hover:bg-gray-100/80 transition-colors duration-200 relative",
                      team.isActive && "bg-blue-50"
                    )}
                  >
                    <div className={cn(
                      "flex -ms-1 size-5 items-center justify-center rounded-sm border",
                      team.isActive 
                        ? "border-blue-300 bg-blue-50" 
                        : "border-gray-200"
                    )}>
                      <team.logo className={cn(
                        "size-3.5 shrink-0",
                        team.isActive ? "text-blue-600" : ""
                      )} />
                    </div>
                    <div className="flex-1">
                      <span className={cn(
                        "text-sm",
                        team.isActive ? "font-semibold text-blue-700" : ""
                      )}>
                        {team.name}
                      </span>
                      <div className="text-xs text-gray-500 mt-0.5">{team.plan}</div>
                    </div>
                    
                    {team.isActive && (
                      <div className="flex items-center justify-center size-2 rounded-full bg-green-500 ml-2">
                        <div className="size-1 rounded-full bg-white"></div>
                      </div>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent className="flex-1">
        {/* Platform Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-gray-600 mb-1">
            {!isCollapsed && "Main Menu"}
          </SidebarGroupLabel>
          <SidebarMenu>
            {data.navMain.map((item) => (
              <SidebarMenuItem key={item.title}>
                <TooltipWrapper title={item.title}>
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
                </TooltipWrapper>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Quick Actions Section - Now empty, so it won't render anything */}
        {data.quickAccess.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-gray-600 mb-1">
              {!isCollapsed && "Quick Actions"}
            </SidebarGroupLabel>
            <SidebarMenu>
              {data.quickAccess.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <TooltipWrapper title={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      className="hover:bg-[#EEEDEC] hover:text-[#282828] transition-all duration-200 h-8 text-sm"
                    >
                      <Link href={item.url}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </TooltipWrapper>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* System Section - Always at bottom */}
      <div className="mt-auto">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-gray-600 mb-1">
            {!isCollapsed && "System"}
          </SidebarGroupLabel>
          <SidebarMenu>
            {data.system.map((item) => (
              <SidebarMenuItem key={item.title}>
                <TooltipWrapper title={item.title}>
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
                </TooltipWrapper>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </div>

      <SidebarFooter>
        <AppUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}