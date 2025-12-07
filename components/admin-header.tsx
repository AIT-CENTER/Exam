// admin-header.tsx
// ModernHeader.tsx

"use client";

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

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
  // --- ICONS FOR MODERN NOTIFICATIONS ---
  UserPlus,
  AlertTriangle,
  CheckCircle,
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


// --- UPDATED PROPS: breadcrumbs is removed ---
interface ModernHeaderProps {
  title: string;
}

export function ModernHeader({ title }: ModernHeaderProps) {
  const router = useRouter()
  // const { setTheme } = useTheme() // Uncomment if you have a theme provider
  const [user, setUser] = useState<{ name: string; email: string; avatar?: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
            router.push('/auth/alpha')
            return
          }

          setUser({
            name: adminData.full_name,
            email: adminData.email,
            // avatar: adminData.avatar_url, // Add if you have avatar field
          })
        } else {
          router.push('/auth/alpha')
        }
      } catch (error) {
        console.error('Error fetching user:', error)
        router.push('/auth/alpha')
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/alpha')
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  };

  if (loading || !user) {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background border-gray-200/60 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 animate-slide-in-left">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          <div className="flex flex-1 items-center gap-4">
            <SidebarTrigger className="-ml-1 h-8 w-8 hover:bg-gray-100/80 transition-all duration-200" />
            <h1 className="text-xl font-semibold tracking-tight text-gray-800">
              {title}
            </h1>
          </div>
          {/* Loading placeholder for user avatar */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
          </div>
        </div>
      </header>
    )
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

          {/* Right Section - Notifications and User Menu (No changes here) */}
          <div className="flex items-center gap-2 ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
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
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Admin Profile</span>
                    <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Global Settings</span>
                    <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    <span>Security & Permissions</span>
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
                    <span>Admin Support</span>
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