"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sun, Moon, LogOut } from "lucide-react";

type MeResponse =
  | { authenticated: false }
  | {
      authenticated: true;
      mustSetPassword: boolean;
      student: { full_name: string; student_id: string } | null;
    };

export function StudentHeader({ title }: { title: string }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/student/me", { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as MeResponse;
        setMe(json);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleLogout = async () => {
    if (loggingOut) return;
    const confirmed = window.confirm("Are you sure you want to log out?");
    if (!confirmed) return;
    try {
      setLoggingOut(true);
      await fetch("/api/student/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setLoggingOut(false);
      router.push("/student/login");
    }
  };

  const initials = (fullName: string | undefined) => {
    if (!fullName) return "ST";
    return fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");
  };

  const displayName =
    me && "authenticated" in me && me.authenticated
      ? me.student?.full_name ?? "Student"
      : "Guest student";

  const displayId =
    me && "authenticated" in me && me.authenticated ? me.student?.student_id : undefined;

  return (
    <TooltipProvider delayDuration={100}>
      <header className="w-full bg-transparent border-none flex-none h-16 flex items-center px-4 sm:px-6">
        <div className="flex flex-1 items-center gap-4">
          <SidebarTrigger className="-ml-2 h-9 w-9 hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200" />
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="text-xs text-muted-foreground">
              {displayName}
              {displayId ? ` • ${displayId}` : ""}
            </p>
          </div>
        </div>

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

          <Button
            variant="ghost"
            className="relative h-9 px-3 rounded-full ml-1 hover:bg-black/5 dark:hover:bg-white/5 text-xs"
            onClick={handleLogout}
            disabled={loading || loggingOut}
          >
            <LogOut className="h-3.5 w-3.5 mr-1" />
            {loggingOut ? "Logging out..." : "Logout"}
          </Button>

          <Avatar className="h-9 w-9 rounded-full border border-zinc-200 dark:border-zinc-800 ml-1">
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-sky-500 text-white text-xs font-semibold">
              {initials(me && "authenticated" in me && me.authenticated ? me.student?.full_name ?? undefined : undefined)}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>
    </TooltipProvider>
  );
}

