// middleware.ts
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

// Teacher routes that need protection
const protectedTeacherRoutes = [
  "/teacher",
  "/teacher/students",
  "/teacher/result",
  "/teacher/exams",
  "/teacher/individual",
  "/teacher/exams/[slug]",
  "/teacher/security",
];

export const config = {
  // ⭐ Important — fix Edge Runtime warning
  runtime: "nodejs",

  // ⭐ Filter only routes that need the middleware
  matcher: [
    "/teacher/:path*",
    "/dashboard/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check whether the route is protected for teachers
  const isProtectedTeacherRoute = protectedTeacherRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isProtectedTeacherRoute) {
    const teacherCookie = request.cookies.get("teacherData");

    // If no cookie found → redirect to teacher login
    if (!teacherCookie) {
      const loginUrl = new URL("/login/tech", request.url);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const teacherData = JSON.parse(
        decodeURIComponent(teacherCookie.value)
      );

      // Check for expiration
      if (
        teacherData.expires &&
        new Date(teacherData.expires) < new Date()
      ) {
        const response = NextResponse.redirect(
          new URL("/login/tech", request.url)
        );
        response.cookies.delete("teacherData");
        return response;
      }

      // Authenticated → continue
      return await updateSession(request);
    } catch (error) {
      const response = NextResponse.redirect(
        new URL("/login/tech", request.url)
      );
      response.cookies.delete("teacherData");
      return response;
    }
  }

  // Non-teacher routes → normal supabase session middleware
  return await updateSession(request);
}
