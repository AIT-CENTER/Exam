// utils/supabase/server.ts
import { createServerClient } from "@supabase/ssr"
import type { NextRequest } from "next/server"

// Edge-safe Supabase client creator
export function createSupabaseClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options) {
          request.cookies.set({ name, value, ...options })
        },
        remove(name: string) {
          request.cookies.set({ name, value: "" })
        },
      },
    }
  )
}

// Optional: session updater for middleware or server components
export async function updateSession(request: NextRequest) {
  const supabase = createSupabaseClient(request)

  // Refresh user session / get current user
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    console.error("Supabase session error:", error.message)
  }

  return { supabase, user }
}
