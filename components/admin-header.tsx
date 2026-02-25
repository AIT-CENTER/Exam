"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { supabase } from "@/lib/supabaseClient"

import {
  Settings,
  Sun,
  LogOut,
  Moon,
  LifeBuoy,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function ModernHeader({ title }: { title: string }) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [user, setUser] = useState<{ name: string; email: string; avatar?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [logoutOpen, setLogoutOpen] = useState(false)

  useEffect(() => {
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
        }
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/alpha')
  }

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark")
  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase()

  return (
    <TooltipProvider delayDuration={100}>
      <>
        {/* Transparent background and border-none. Inherits exactly from the layout wrapper */}
        <header className="w-full bg-transparent border-none flex-none h-16 flex items-center px-4 sm:px-6">
          <div className="flex flex-1 items-center gap-4">
            <SidebarTrigger className="-ml-2 h-9 w-9 hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200" />
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {!loading && user ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                  onClick={toggleTheme}
                >
                  <Sun className="absolute h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                  onClick={() => router.push("/dashboard/settings")}
                >
                  <Settings className="h-4 w-4" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 ml-2 hover:bg-black/5 dark:hover:bg-white/5">
                      <Avatar className="h-9 w-9 rounded-full border border-zinc-200 dark:border-zinc-800">
                        <AvatarImage src={user?.avatar} alt={user?.name} />
                        <AvatarFallback className="bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 animate-scale-in" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-zinc-200 dark:border-zinc-800">
                          <AvatarFallback className="bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{user.name}</p>
                          <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setLogoutOpen(true) }}>
                      <LogOut className="mr-2 h-4 w-4 text-red-500" />
                      <span className="text-red-500 font-medium">Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex gap-2">
                {/* Skeletons adapt to theme using bg-zinc-200 and dark:bg-zinc-800 */}
                <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse ml-2" />
              </div>
            )}
          </div>
        </header>

        <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Log out?</AlertDialogTitle>
              <AlertDialogDescription>
                You will be signed out of the admin dashboard. You can log in again at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleLogout}>
                Log out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </TooltipProvider>
  )
}