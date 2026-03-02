import type { Metadata } from "next";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { Suspense } from "react";

import { CardDescription } from "@/components/ui/card";
import AnalyticsClient from "@/components/dashboard/analytics-client";

export const metadata: Metadata = {
  title: "Admin Analytics",
};

async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as CookieOptions)
          );
        },
      },
    }
  );
}

function DashboardSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[70vh] w-full bg-transparent">
      <style>{`
        .spinner-svg { animation: spinner-rotate 2s linear infinite; }
        .spinner-circle {
          stroke-dasharray: 1, 200; stroke-dashoffset: 0;
          animation: spinner-stretch 1.5s ease-in-out infinite; stroke-linecap: round;
        }
        @keyframes spinner-rotate { 100% { transform: rotate(360deg); } }
        @keyframes spinner-stretch {
          0% { stroke-dasharray: 1, 200; stroke-dashoffset: 0; }
          50% { stroke-dasharray: 90, 200; stroke-dashoffset: -35px; }
          100% { stroke-dasharray: 90, 200; stroke-dashoffset: -124px; }
        }
      `}</style>
      <svg className="h-10 w-10 text-zinc-800 dark:text-zinc-200 spinner-svg" viewBox="25 25 50 50">
        <circle className="spinner-circle" cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="4" />
      </svg>
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: adminRow } = await supabase
    .from("admin")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminRow) redirect("/unauthorized");

  const role = (adminRow.role as "super_admin" | "admin" | null) ?? "super_admin";

  if (role === "admin") {
    const { data: permRow } = await supabase
      .from("admin_page_permissions")
      .select("allowed")
      .eq("role", "admin")
      .eq("page_key", "analytics")
      .maybeSingle();
    
    if (!permRow?.allowed) redirect("/dashboard");
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Analytics
          </h1>
          <CardDescription className="mt-1">
            Real-time exam performance and risk trends. Updated every 5 seconds.
          </CardDescription>
        </div>
      </div>
      <Suspense fallback={<DashboardSpinner />}>
        <AnalyticsClient />
      </Suspense>
    </div>
  );
}