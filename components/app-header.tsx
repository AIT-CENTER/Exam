"use client";

import {
  Bell,
  Settings,
  Sun,
  User,
  Laptop,
  ShieldCheck,
  LifeBuoy,
  LogOut,
  Moon,
  UserPlus,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  GraduationCap,
  BookOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// --- DATA FOR TEACHER NOTIFICATIONS ---
const notifications = [
  {
    icon: <Clock className="h-5 w-5 text-blue-500" />,
    title: "Upcoming Exam",
    description: "Mathematics Midterm starts in 2 days",
    time: "5m ago",
  },
  {
    icon: <FileText className="h-5 w-5 text-green-500" />,
    title: "New Submission",
    description: "25 students submitted Assignment 3",
    time: "1h ago",
  },
  {
    icon: <UserPlus className="h-5 w-5 text-purple-500" />,
    title: "New Student Added",
    description: "Kebede Alemayehu joined your class",
    time: "4h ago",
  },
  {
    icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
    title: "Grading Deadline",
    description: "Physics quiz grades due tomorrow",
    time: "1d ago",
  },
  {
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    title: "Exam Published",
    description: "Final exam results are now available",
    time: "2d ago",
  },
];

// --- PROPS INTERFACE ---
interface ModernHeaderProps {
  title: string;
}

export function Header({ title }: ModernHeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState<{ 
    name: string; 
    email: string; 
    role: string; 
    avatar?: string;
    gradeName?: string;
    subjectName?: string;
    sections?: string[];
  } | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(3);

  useEffect(() => {
    // Get teacher data from cookie
    const getTeacherData = () => {
      try {
        const cookies = document.cookie.split(';');
        const teacherCookie = cookies.find(cookie => cookie.trim().startsWith('teacherData='));
        
        if (teacherCookie) {
          const cookieValue = teacherCookie.split('=')[1];
          const decodedValue = decodeURIComponent(cookieValue);
          const teacherData = JSON.parse(decodedValue);
          
          setUser({
            name: teacherData.fullName,
            email: teacherData.email,
            role: teacherData.subjectName ? `${teacherData.subjectName} Teacher` : "Teacher",
            gradeName: teacherData.gradeName,
            subjectName: teacherData.subjectName,
            sections: teacherData.sections,
          });
        }
      } catch (error) {
        console.error("Error parsing teacher data:", error);
      }
    };

    getTeacherData();
  }, []);

  const handleLogout = () => {
    // Clear teacher data cookie
    document.cookie = "teacherData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    // Redirect to login page
    router.push("/login/tech");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  };

  const markAllAsRead = () => {
    setUnreadNotifications(0);
  };

  if (!user) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <header className="sticky top-0 z-50 w-full border-b bg-background border-gray-200/60 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 animate-slide-in-left">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          <div className="flex flex-1 items-center gap-4">
            <SidebarTrigger className="-ml-1 h-8 w-8 hover:bg-gray-100/80 transition-all duration-200" />
            <h1 className="text-xl font-semibold tracking-tight text-gray-800">
              {title}
            </h1>
          </div>

          {/* Right Section - Notifications and User Menu */}
          <div className="flex items-center gap-3 ml-auto">

            {/* User Menu Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full hover:bg-gray-100/80 transition-all duration-200"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-blue-100 text-blue-800">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 animate-scale-in"
                align="end"
                forceMount
              >
                <DropdownMenuLabel className="font-normal p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="bg-blue-100 text-blue-800">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                      <Badge variant="secondary" className="w-fit text-xs mt-1">
                        {user.role}
                      </Badge>
                      {user.gradeName && (
                        <p className="text-xs text-muted-foreground">
                          {user.gradeName} • {user.sections?.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Teacher Profile</span>
                    <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <BookOpen className="mr-2 h-4 w-4" />
                    <span>My Classes</span>
                    <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Account Settings</span>
                    <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    <span>Security & Privacy</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <div className="relative mr-2 h-4 w-4">
                        <Sun className="absolute h-full w-full rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-full w-full rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                      </div>
                      <span>Theme</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem>
                          <Sun className="mr-2 h-4 w-4" />
                          <span>Light</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Moon className="mr-2 h-4 w-4" />
                          <span>Dark</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Laptop className="mr-2 h-4 w-4" />
                          <span>System</span>
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuItem>
                    <LifeBuoy className="mr-2 h-4 w-4" />
                    <span>Teacher Support</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                  <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}