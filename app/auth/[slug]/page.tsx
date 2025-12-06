"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Lock, User, Mail, LogIn, Shield, Home } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

const VALID_SLUG = process.env.NEXT_PUBLIC_ADMIN_LOGIN_SLUG || "kmss";


// Validation schema
const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, { message: "Username or email is required" })
    .refine(
      (val) => {
        if (val.includes("@")) {
          return z.string().email().safeParse(val).success;
        }
        return val.length >= 3;
      },
      { message: "Enter a valid username (min 3 chars) or email" }
    ),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(50, { message: "Password too long" }),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AdminLogin() {
  const router = useRouter();
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [isValidAccess, setIsValidAccess] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  // Slug check
  useEffect(() => {
    const pathSegments = window.location.pathname.split('/auth/').filter(Boolean);
    const urlSlug = pathSegments[0] || '';
    setCurrentSlug(urlSlug);

    if (urlSlug !== VALID_SLUG) {
      toast.error("Invalid access link");
      setTimeout(() => router.replace("/404"), 2000);
    } else {
      setIsValidAccess(true);
    }
  }, [router]);

  const onSubmit = async (data: LoginForm) => {
    if (currentSlug !== VALID_SLUG) return;

    try {
      let email = data.identifier;

      // If identifier is username, fetch email from admin table
      if (!data.identifier.includes('@')) {
        const { data: adminData, error: fetchError } = await supabase
          .from('admin')
          .select('email')
          .eq('username', data.identifier)
          .single();

        if (fetchError) {
          console.error('Fetch admin error:', fetchError);
          toast.error("Invalid username. Please check and try again.");
          return;
        }

        if (!adminData) {
          toast.error("No account found with this username.");
          return;
        }

        email = adminData.email;
      }

      // Client-side Supabase auth sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: data.password,
      });

      if (authError) {
        console.error('Auth error:', authError);
        if (authError.message.includes('Invalid login credentials')) {
          toast.error("Invalid password. Please try again.");
        } else if (authError.message.includes('Email not confirmed')) {
          toast.error("Email not confirmed. Please check your inbox.");
        } else {
          toast.error(authError.message || "Login failed. Please try again.");
        }
        return;
      }

      if (!authData.session) {
        toast.error("Login successful but session not created. Please try again.");
        return;
      }

      // Verify it's an admin user
      const { data: adminVerify, error: verifyError } = await supabase
        .from('admin')
        .select('id')
        .eq('id', authData.user.id)
        .single();

      if (verifyError) {
        console.error('Verify admin error:', verifyError);
        await supabase.auth.signOut();
        toast.error("Verification error. Please contact support.");
        return;
      }

      if (!adminVerify) {
        await supabase.auth.signOut();
        toast.error("Access denied. Admin privileges required.");
        return;
      }

      toast.success("Login successful! Redirecting to dashboard...");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error('Unexpected login error:', err);
      toast.error("Network error. Please check your connection and try again.");
    }
  };

  const handleGoToDashboard = () => {
    router.push("/dashboard");
  };

  // Wrong slug page
  if (VALID_SLUG && currentSlug !== VALID_SLUG) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center space-y-6">
          <Shield className="h-20 w-20 text-red-500 mx-auto animate-pulse" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-muted-foreground mt-2">This admin portal does not exist</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isValidAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 p-4">
      <div className="absolute top-6 right-6">
        <Button
          variant="outline"
          onClick={handleGoToDashboard}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Go to Dashboard
        </Button>
      </div>
      
      <div className="max-w-md w-full">
        <Card className="border-0 shadow-2xl">
          <CardHeader className="space-y-6 pb-8 text-center">
            <div className="flex justify-center">
              <div className="p-4 bg-indigo-100 rounded-xl">
                <Lock className="h-12 w-12 text-indigo-600" />
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl font-bold text-gray-900">
                Admin Login
              </CardTitle>
              <p className="text-muted-foreground mt-2">
                Secure access to admin dashboard
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Username or Email */}
                <FormField
                  control={form.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">Username or Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className="absolute left-3 top-3.5">
                            {field.value?.includes("@") ? (
                              <Mail className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <User className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <Input
                            {...field}
                            placeholder="admin or admin@aasts.edu.et"
                            className="pl-11 h-12 text-base"
                            autoFocus
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-sm font-medium" />
                    </FormItem>
                  )}
                />

                {/* Password */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="••••••••"
                            className="pl-11 h-12 text-base"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-sm font-medium" />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-semibold"
                  disabled={form.formState.isSubmitting || !form.formState.isValid}
                  size="lg"
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-5 w-5" />
                      Login to Dashboard
                    </>
                  )}
                </Button>
              </form>
            </Form>
            <p className="text-sm ml-7 text-gray-500">Developer By Alpha Institute Tech <a target="_blank" className="text-gray-900 text-center" href="alphainstitutetech.com">(AIT Tech Center)</a></p>
          </CardContent>
        </Card>
      </div>
      
    </div>
    
  );
}