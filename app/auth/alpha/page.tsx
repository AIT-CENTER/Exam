"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { Loader2, Mail, Lock, Shield, GraduationCap } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"

// Validation schema
const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Please enter a valid email address" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(100, { message: "Password too long" }),
})

type LoginForm = z.infer<typeof loginSchema>

export default function AdminLoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      // Attempt to sign in with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (authError) {
        toast.error(authError.message || "Invalid email or password")
        setIsLoading(false)
        return
      }

      if (!authData.session?.user?.id) {
        toast.error("Authentication failed. Please try again.")
        setIsLoading(false)
        return
      }

      // Fetch admin role from database
      const { data: adminData, error: adminError } = await supabase
        .from("admin")
        .select("id, role")
        .eq("id", authData.session.user.id)
        .single()

      if (adminError || !adminData) {
        toast.error("Admin account not found. Please contact support.")
        await supabase.auth.signOut()
        setIsLoading(false)
        return
      }

      const role = adminData.role as "super_admin" | "admin"

      // Show redirecting toast
      const redirectToast = toast.loading("Redirecting...")

      // Redirect based on role
      if (role === "super_admin") {
        setTimeout(() => {
          toast.dismiss(redirectToast)
          router.push("/dashboard")
        }, 800)
      } else if (role === "admin") {
        setTimeout(() => {
          toast.dismiss(redirectToast)
          router.push("/dashboard/students")
        }, 800)
      } else {
        toast.error("Invalid admin role")
        await supabase.auth.signOut()
        setIsLoading(false)
      }
    } catch (error: any) {
      console.error("Login error:", error)
      toast.error(error.message || "Login failed. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-200/20 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-tr from-indigo-200/20 to-transparent rounded-full blur-3xl"></div>
      </div>

      <Card className="w-full max-w-md shadow-lg border-slate-200 dark:border-slate-800 relative z-10">
        <CardHeader className="space-y-2 text-center pb-4">
          <div className="flex justify-center mb-2">
            <div className="rounded-lg bg-slate-900 dark:bg-slate-100 p-3 shadow-lg">
              <GraduationCap className="h-8 w-8 text-slate-50 dark:text-slate-900" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Admin Portal</CardTitle>
          <CardDescription className="text-sm">
            Sign in to manage the educational system
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Email Field */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="admin@example.com"
                          className="pl-9 h-10 text-sm"
                          disabled={isLoading}
                          autoComplete="email"
                          spellCheck="false"
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs font-medium" />
                  </FormItem>
                )}
              />

              {/* Password Field */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your password"
                          className="pl-9 h-10 text-sm"
                          disabled={isLoading}
                          autoComplete="current-password"
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs font-medium" />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-10 text-sm font-medium"
                disabled={isLoading || !form.formState.isValid}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Sign in
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 space-y-4 border-t border-slate-200 dark:border-slate-800 pt-6">
            <p className="text-center text-xs text-muted-foreground">
              Need to create an account?{" "}
              <Link href="/create-admin" className="text-slate-900 dark:text-slate-100 font-semibold hover:underline">
                Contact super admin
              </Link>
            </p>

            <p className="text-xs text-center text-muted-foreground italic">
              By signing in, you agree to protect the integrity of student data and maintain system security.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
