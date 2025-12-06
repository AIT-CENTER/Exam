// middleware.ts
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const protectedTeacherRoutes = [
  "/teacher",
  "/teacher/students",
  "/teacher/result",
  "/teacher/exams",
  "/teacher/individual",
  "/teacher/exams/[slug]",
  "/teacher/security",
]

// Edge-safe Supabase session updater
async function updateSession(request: NextRequest) {
  const supabase = createServerClient(
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

  // Optional: refresh user session
  await supabase.auth.getUser()
  return NextResponse.next()
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtectedTeacherRoute = protectedTeacherRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )

  if (isProtectedTeacherRoute) {
    const teacherCookie = request.cookies.get("teacherData")

    if (!teacherCookie) {
      return NextResponse.redirect(new URL("/login/tech", request.url))
    }

    try {
      const teacherData = JSON.parse(decodeURIComponent(teacherCookie.value))

      if (teacherData.expires && new Date(teacherData.expires) < new Date()) {
        const response = NextResponse.redirect(new URL("/", request.url))
        response.cookies.delete("teacherData")
        return response
      }

      return await updateSession(request)
    } catch (err) {
      const response = NextResponse.redirect(new URL("/login/tech", request.url))
      response.cookies.delete("teacherData")
      return response
    }
  }

  // For non-protected routes, just update session
  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
