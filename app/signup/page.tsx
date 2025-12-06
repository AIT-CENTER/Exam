"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";  // Import from lib
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Mail, Lock, User, Phone, Shield } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, agreeTerms: checked }));
  };

  const handleSignup = async () => {
    // Validation full
    if (!formData.username || !formData.fullName || !formData.email || !formData.phone || !formData.password || !formData.confirmPassword) {
      toast.error("Hunda kennuu barbaachisa");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwordwwan hin wal fakkaatan");
      return;
    }
    if (formData.password.length < 8) {
      toast.error("Password minimum 8 characters ta'uu qaba");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Email format sirrii hin ta'e");
      return;
    }
    if (!formData.agreeTerms) {
      toast.error("Terms fi conditions agree godhuu barbaachisa");
      return;
    }

    setIsLoading(true);

    try {
      // Real Supabase auth.signUp (lib/supabaseClient.ts irraa)
      const { data: { user }, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError || !user) {
        toast.error(authError?.message || "Auth signup failed");
        setIsLoading(false);
        return;
      }

      // Real profile insert public.admin table irratti (lib/supabaseClient.ts irraa)
      const { error: profileError } = await supabase.from("admin").insert({
        id: user.id,  // Automatic UUID from auth
        username: formData.username,
        full_name: formData.fullName,
        email: formData.email,
        phone_number: formData.phone,
      });

      if (profileError) {
        console.log("Detailed profile error:", profileError);  // Browser console ilaali (F12)
        toast.error(profileError.message || "Database error saving new admin");
        setIsLoading(false);
        return;
      }

      toast.success("Admin account created successfully! Login gochuu danda'u.");
      setIsDialogOpen(true);
      setIsLoading(false);
      setFormData({ username: "", fullName: "", email: "", phone: "", password: "", confirmPassword: "", agreeTerms: false });
    } catch (error) {
      console.log("Unexpected error:", error);  // Browser console ilaali
      toast.error("Unexpected error: " + (error as Error).message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Admin Signup</CardTitle>
          <p className="text-sm text-muted-foreground text-center">
            Admin account haaraa create godhi. Achuma login gochuu danda'u.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Username kennu"
                value={formData.username}
                onChange={handleInputChange}
                className="pl-10"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fullName">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Full name kennu"
                value={formData.fullName}
                onChange={handleInputChange}
                className="pl-10"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@example.com"
                value={formData.email}
                onChange={handleInputChange}
                className="pl-10"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="0912345678"
                value={formData.phone}
                onChange={handleInputChange}
                className="pl-10"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Password kennu (min 8 chars)"
                value={formData.password}
                onChange={handleInputChange}
                className="pl-10"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="agreeTerms" checked={formData.agreeTerms} onCheckedChange={handleCheckboxChange} />
            <Label htmlFor="agreeTerms" className="text-sm">
              Terms fi conditions agree godhi
            </Label>
          </div>
          <Button onClick={handleSignup} disabled={isLoading} className="w-full">
            {isLoading ? "Creating..." : "Create Admin Account"}
          </Button>
          <div className="text-center text-sm">
            Account qabdu? <Link href="/login" className="text-primary hover:underline">Login godhi</Link>
          </div>
        </CardContent>
      </Card>

      {/* Success Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Success!</DialogTitle>
            <DialogDescription>
              Admin account created. <Link href="/login" className="text-primary hover:underline">Login gochuu danda'u</Link>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => router.push("/login")}>Login</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}