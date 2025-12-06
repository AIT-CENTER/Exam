// middleware.ts
import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/utils/supabase/middleware"

// Teacher routes that need protection
const protectedTeacherRoutes = [
  '/teacher',
  '/teacher/students', 
  '/teacher/result',
  '/teacher/exams',
  '/teacher/individual',
  '/teacher/exams/[slug]',
  '/teacher/security',    // Add this line - kun exams list page dha
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the current path is a protected teacher route
  const isProtectedTeacherRoute = protectedTeacherRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )

  if (isProtectedTeacherRoute) {
    // Check for teacher data in cookie
    const teacherCookie = request.cookies.get('teacherData')
    
    if (!teacherCookie) {
      // Redirect to teacher login if no teacher data found
      const loginUrl = new URL('/login/tech', request.url)
      return NextResponse.redirect(loginUrl)
    }

    try {
      // Verify the cookie data is valid
      const teacherData = JSON.parse(decodeURIComponent(teacherCookie.value))
      
      // Check if cookie is expired
      if (teacherData.expires && new Date(teacherData.expires) < new Date()) {
        // Clear expired cookie and redirect to login
        const response = NextResponse.redirect(new URL('/', request.url))
        response.cookies.delete('teacherData')
        return response
      }

      // Teacher is authenticated, continue with request
      return await updateSession(request)
    } catch (error) {
      // Invalid cookie data, redirect to login
      const response = NextResponse.redirect(new URL('login/tech', request.url))
      response.cookies.delete('teacherData')
      return response
    }
  }

  // For non-teacher routes, continue with normal session update
  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}