"use client";

import {
  User,
  Settings,
  LogOut,
  Moon,
  Sun,
  Laptop,
  Bell,
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
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

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
  const { theme, setTheme } = useTheme();
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

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

  const handleProfileClick = () => {
    router.push("/teacher/security");
  };

  if (!user) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <header className="w-full bg-transparent border-none flex-none h-16 flex items-center px-4 sm:px-6">
        <div className="flex flex-1 items-center gap-4">
          <SidebarTrigger className="-ml-2 h-9 w-9 hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200" />
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h1>
        </div>

        {/* Right Section - User Menu */}
        <div className="ml-auto flex items-center gap-2">
          
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
            onClick={toggleTheme}
          >
            <Sun className="absolute h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
            
          {/* User Menu Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 ml-2 hover:bg-black/5 dark:hover:bg-white/5">
                <Avatar className="h-9 w-9 rounded-full border border-zinc-200 dark:border-zinc-800">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 animate-scale-in shadow-lg"
                align="end"
                forceMount
              >
                {/* User Info Section */}
                <DropdownMenuLabel className="font-normal p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 ring-2 ring-white ring-offset-2">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-lg font-semibold">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1.5">
                      <p className="text-sm font-semibold leading-none text-gray-900">
                        {user.name}
                      </p>
                      <p className="text-xs leading-none text-gray-600">
                        {user.email}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                          {user.role}
                        </Badge>
                        {user.gradeName && (
                          <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                            {user.gradeName}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {/* Main Actions */}
                <DropdownMenuGroup className="p-1">
                  <DropdownMenuItem onClick={handleProfileClick} className="cursor-pointer px-3 py-2.5 rounded-md hover:bg-blue-50 transition-colors">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-blue-100">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <span className="text-sm font-medium ">Profile</span>
                          <p className="text-xs text-gray-500">View and edit profile</p>
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuGroup>


                <DropdownMenuSeparator />

                {/* Logout Button */}
                <div className="p-2">
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="cursor-pointer px-3 py-2.5 rounded-md hover:bg-red-50 transition-colors text-red-600 hover:text-red-700"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-red-100">
                          <LogOut className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-sm font-medium">Log out</span>
                          <p className="text-xs text-red-500">Sign out of your account</p>
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
    </TooltipProvider>
  );
}