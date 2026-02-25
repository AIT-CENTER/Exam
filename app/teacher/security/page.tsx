"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Settings, 
  User, 
  Key,
  Save,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Phone,
  Mail,
  GraduationCap,
  BookOpen,
  Users
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getTeacherDataFromCookie, TeacherCookieData } from "@/utils/teacherCookie";
import bcrypt from "bcryptjs";

interface TeacherProfileData {
  full_name: string;
  email: string;
  phone_number: string;
  username: string;
  grade_id: number | null;
  subject_id: number | null;
  section: string;
  grade_name?: string;
  subject_name?: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function TeacherSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teacherCookie, setTeacherCookie] = useState<TeacherCookieData | null>(null);

  // Teacher Profile Data
  const [teacherData, setTeacherData] = useState<TeacherProfileData>({
    full_name: "",
    email: "",
    phone_number: "",
    username: "",
    grade_id: null,
    subject_id: null,
    section: "",
    grade_name: "",
    subject_name: ""
  });

  // Password Change Data
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Errors
  const [errors, setErrors] = useState({
    profile: {} as any,
    password: {} as any
  });

  useEffect(() => {
    fetchTeacherData();
  }, []);

  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      
      // Get teacher data from cookie
      const cookieData = await getTeacherDataFromCookie();
      
      if (!cookieData) {
        toast.error("You must be logged in");
        router.push("/teacher/login");
        return;
      }

      setTeacherCookie(cookieData);

      // Fetch complete teacher data from database using teacherId from cookie
      const { data: teacher, error } = await supabase
        .from("teacher")
        .select(`
          *,
          grades!teacher_grade_id_fkey(grade_name),
          subjects!teacher_subject_id_fkey(subject_name)
        `)
        .eq("id", cookieData.teacherId)
        .single();

      if (error) {
        toast.error("Failed to load teacher data");
        return;
      }

      if (teacher) {
        setTeacherData({
          full_name: teacher.full_name || "",
          email: teacher.email || "",
          phone_number: teacher.phone_number || "",
          username: teacher.username || "",
          grade_id: teacher.grade_id,
          subject_id: teacher.subject_id,
          section: teacher.section || "",
          grade_name: teacher.grades?.grade_name || "",
          subject_name: teacher.subjects?.subject_name || ""
        });
      }

    } catch (error) {
      toast.error("Failed to load teacher data");
    } finally {
      setLoading(false);
    }
  };

  const validateProfile = () => {
    const newErrors: any = {};

    if (!teacherData.full_name.trim()) {
      newErrors.full_name = "Full name is required";
    }

    if (!teacherData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacherData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (teacherData.phone_number && !/^\+?[\d\s-()]+$/.test(teacherData.phone_number)) {
      newErrors.phone_number = "Please enter a valid phone number";
    }

    if (!teacherData.username.trim()) {
      newErrors.username = "Username is required";
    }

    setErrors(prev => ({ ...prev, profile: newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = () => {
    const newErrors: any = {};

    if (!passwordData.currentPassword.trim()) {
      newErrors.currentPassword = "Current password is required";
    }

    if (!passwordData.newPassword.trim()) {
      newErrors.newPassword = "New password is required";
    } else if (passwordData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters long";
    } else if (!/(?=.*[a-z])/.test(passwordData.newPassword)) {
      newErrors.newPassword = "Password must contain at least one lowercase letter";
    } else if (!/(?=.*[A-Z])/.test(passwordData.newPassword)) {
      newErrors.newPassword = "Password must contain at least one uppercase letter";
    } else if (!/(?=.*\d)/.test(passwordData.newPassword)) {
      newErrors.newPassword = "Password must contain at least one number";
    } else if (!/(?=.*[@$!%*?&])/.test(passwordData.newPassword)) {
      newErrors.newPassword = "Password must contain at least one special character (@$!%*?&)";
    }

    if (!passwordData.confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your new password";
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (passwordData.currentPassword && passwordData.newPassword && 
        passwordData.currentPassword === passwordData.newPassword) {
      newErrors.newPassword = "New password must be different from current password";
    }

    setErrors(prev => ({ ...prev, password: newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const handleProfileChange = (field: string, value: string) => {
    setTeacherData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors.profile[field]) {
      setErrors(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          [field]: ""
        }
      }));
    }
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors.password[field]) {
      setErrors(prev => ({
        ...prev,
        password: {
          ...prev.password,
          [field]: ""
        }
      }));
    }
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setSaving(true);
    try {
      if (!teacherCookie?.teacherId) {
        toast.error("You must be logged in");
        return;
      }

      // Update teacher data (only editable fields) using teacherId from cookie
      const { error } = await supabase
        .from("teacher")
        .update({
          full_name: teacherData.full_name,
          email: teacherData.email,
          phone_number: teacherData.phone_number,
          username: teacherData.username,
          updated_at: new Date().toISOString()
        })
        .eq("id", teacherCookie.teacherId);

      if (error) {
        toast.error("Failed to update profile: " + error.message);
        return;
      }

      toast.success("Profile updated successfully!");

    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const hashPassword = async (password: string) => {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  };

  const comparePasswords = async (plainPassword: string, hashedPassword: string) => {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error("Password comparison error:", error);
      return false;
    }
  };

  const handleChangePassword = async () => {
    if (!validatePassword()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setSaving(true);
    try {
      if (!teacherCookie?.teacherId) {
        toast.error("You must be logged in");
        return;
      }

      // First, get the current teacher's hashed password from the database
      const { data: teacher, error: fetchError } = await supabase
        .from("teacher")
        .select("password")
        .eq("id", teacherCookie.teacherId)
        .single();

      if (fetchError || !teacher) {
        toast.error("Failed to fetch teacher data");
        return;
      }

      // Verify current password by comparing with bcrypt
      const isCurrentPasswordCorrect = await comparePasswords(
        passwordData.currentPassword, 
        teacher.password || ""
      );

      if (!isCurrentPasswordCorrect) {
        toast.error("Current password is incorrect");
        setErrors(prev => ({
          ...prev,
          password: {
            ...prev.password,
            currentPassword: "Current password is incorrect"
          }
        }));
        return;
      }

      // Hash the new password
      const hashedNewPassword = await hashPassword(passwordData.newPassword);

      // Update password in teacher table
      const { error: updateError } = await supabase
        .from("teacher")
        .update({ 
          password: hashedNewPassword,
          updated_at: new Date().toISOString()
        })
        .eq("id", teacherCookie.teacherId);

      if (updateError) {
        toast.error("Failed to update password: " + updateError.message);
        return;
      }

      toast.success("Password updated successfully!");
      
      // Reset password form
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });

      // Clear errors
      setErrors(prev => ({
        ...prev,
        password: {}
      }));

    } catch (error) {
      console.error("Password change error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const passwordStrength = (): { strength: number; label: string; color: string } => {
    if (!passwordData.newPassword) return { strength: 0, label: "", color: "" };
    
    let strength = 0;
    
    if (passwordData.newPassword.length >= 8) strength += 1;
    if (/(?=.*[a-z])/.test(passwordData.newPassword)) strength += 1;
    if (/(?=.*[A-Z])/.test(passwordData.newPassword)) strength += 1;
    if (/(?=.*\d)/.test(passwordData.newPassword)) strength += 1;
    if (/(?=.*[@$!%*?&])/.test(passwordData.newPassword)) strength += 1;

    const strengths = [
      { strength: 1, label: "Very Weak", color: "bg-red-500" },
      { strength: 2, label: "Weak", color: "bg-orange-500" },
      { strength: 3, label: "Fair", color: "bg-yellow-500" },
      { strength: 4, label: "Good", color: "bg-blue-500" },
      { strength: 5, label: "Strong", color: "bg-green-500" }
    ];

    return strengths[strength - 1] || { strength: 0, label: "Very Weak", color: "bg-red-500" };
  };

  const strengthInfo = passwordStrength();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] w-full bg-transparent">
        <style>{`
          .spinner-svg {
            animation: spinner-rotate 2s linear infinite;
          }
          .spinner-circle {
            stroke-dasharray: 1, 200;
            stroke-dashoffset: 0;
            animation: spinner-stretch 1.5s ease-in-out infinite;
            stroke-linecap: round;
          }
          @keyframes spinner-rotate {
            100% {
              transform: rotate(360deg);
            }
          }
          @keyframes spinner-stretch {
            0% {
              stroke-dasharray: 1, 200;
              stroke-dashoffset: 0;
            }
            50% {
              stroke-dasharray: 90, 200;
              stroke-dashoffset: -35px;
            }
            100% {
              stroke-dasharray: 90, 200;
              stroke-dashoffset: -124px;
            }
          }
        `}</style>
        
        <svg
          className="h-10 w-10 text-zinc-800 dark:text-zinc-200 spinner-svg"
          viewBox="25 25 50 50"
        >
          <circle
            className="spinner-circle"
            cx="50"
            cy="50"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] bg-transparent flex justify-center p-4">
      <div className="w-full max-w-4xl pt-0 lg:pt-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 lg:mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Settings className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Teacher Settings</h1>
              <p className="text-muted-foreground mt-1">Manage your profile information and security settings</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex bg-zinc-100 dark:bg-zinc-800/50">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile Settings
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Key className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information and contact details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label htmlFor="full_name" className="text-sm font-medium">
                      Full Name *
                    </Label>
                    <Input
                      id="full_name"
                      value={teacherData.full_name}
                      onChange={(e) => handleProfileChange("full_name", e.target.value)}
                      placeholder="Enter your full name"
                      className={errors.profile.full_name ? "border-red-500" : ""}
                    />
                    {errors.profile.full_name && (
                      <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.profile.full_name}
                      </p>
                    )}
                  </div>

                  {/* Username */}
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium">
                      Username *
                    </Label>
                    <Input
                      id="username"
                      value={teacherData.username}
                      onChange={(e) => handleProfileChange("username", e.target.value)}
                      placeholder="Enter your username"
                      className={errors.profile.username ? "border-red-500" : ""}
                    />
                    {errors.profile.username && (
                      <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.profile.username}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      Email Address *
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={teacherData.email}
                        onChange={(e) => handleProfileChange("email", e.target.value)}
                        placeholder="Enter your email address"
                        className={`pl-10 ${errors.profile.email ? "border-red-500" : ""}`}
                      />
                    </div>
                    {errors.profile.email && (
                      <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.profile.email}
                      </p>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-2">
                    <Label htmlFor="phone_number" className="text-sm font-medium">
                      Phone Number
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone_number"
                        value={teacherData.phone_number}
                        onChange={(e) => handleProfileChange("phone_number", e.target.value)}
                        placeholder="Enter your phone number"
                        className={`pl-10 ${errors.profile.phone_number ? "border-red-500" : ""}`}
                      />
                    </div>
                    {errors.profile.phone_number && (
                      <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.profile.phone_number}
                      </p>
                    )}
                  </div>

                  {/* Grade (Read Only) */}
                  <div className="space-y-2">
                    <Label htmlFor="grade_id" className="text-sm font-medium">
                      Assigned Grade
                    </Label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="grade_id"
                        value={teacherData.grade_name || "Not assigned"}
                        readOnly
                        className="pl-10 bg-zinc-50 dark:bg-zinc-800/50 text-muted-foreground"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Grade assignment is managed by administrator</p>
                  </div>

                  {/* Subject (Read Only) */}
                  <div className="space-y-2">
                    <Label htmlFor="subject_id" className="text-sm font-medium">
                      Assigned Subject
                    </Label>
                    <div className="relative">
                      <BookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="subject_id"
                        value={teacherData.subject_name || "Not assigned"}
                        readOnly
                        className="pl-10 bg-zinc-50 dark:bg-zinc-800/50 text-muted-foreground"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Subject assignment is managed by administrator</p>
                  </div>
                </div>

                {/* Section (Read Only) */}
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="section" className="text-sm font-medium">
                    Section
                  </Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="section"
                      value={teacherData.section || "Not assigned"}
                      readOnly
                      className="pl-10 bg-zinc-50 dark:bg-zinc-800/50 text-muted-foreground"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Section assignment is managed by administrator</p>
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleSaveProfile} 
                    size="lg" 
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                    disabled={saving}
                  >
                    <Save className="h-5 w-5" />
                    {saving ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  {/* Current Password */}
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-sm font-medium">
                      Current Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={passwordData.currentPassword}
                        onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
                        placeholder="Enter your current password"
                        className={`pr-10 ${errors.password.currentPassword ? "border-red-500" : ""}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {errors.password.currentPassword && (
                      <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.password.currentPassword}
                      </p>
                    )}
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-sm font-medium">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
                        placeholder="Enter your new password"
                        className={`pr-10 ${errors.password.newPassword ? "border-red-500" : ""}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    
                    {/* Password Strength Indicator */}
                    {passwordData.newPassword && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Password strength:</span>
                          <span className={`font-medium ${
                            strengthInfo.label === "Very Weak" ? "text-red-600 dark:text-red-400" :
                            strengthInfo.label === "Weak" ? "text-orange-600 dark:text-orange-400" :
                            strengthInfo.label === "Fair" ? "text-yellow-600 dark:text-yellow-400" :
                            strengthInfo.label === "Good" ? "text-blue-600 dark:text-blue-400" :
                            "text-green-600 dark:text-green-400"
                          }`}>
                            {strengthInfo.label}
                          </span>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${strengthInfo.color}`}
                            style={{ 
                              width: passwordData.newPassword ? `${(passwordStrength().strength / 5) * 100}%` : '0%' 
                            }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {errors.password.newPassword && (
                      <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.password.newPassword}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
                        placeholder="Confirm your new password"
                        className={`pr-10 ${errors.password.confirmPassword ? "border-red-500" : ""}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {errors.password.confirmPassword && (
                      <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.password.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>

                {/* Password Requirements */}
                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                    <strong>Password must contain:</strong>
                    <ul className="mt-1 space-y-1">
                      <li className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${passwordData.newPassword.length >= 8 ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                        At least 8 characters
                      </li>
                      <li className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${/(?=.*[a-z])/.test(passwordData.newPassword) ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                        One lowercase letter
                      </li>
                      <li className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${/(?=.*[A-Z])/.test(passwordData.newPassword) ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                        One uppercase letter
                      </li>
                      <li className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${/(?=.*\d)/.test(passwordData.newPassword) ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                        One number
                      </li>
                      <li className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${/(?=.*[@$!%*?&])/.test(passwordData.newPassword) ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                        One special character (@$!%*?&)
                      </li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleChangePassword} 
                    size="lg" 
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                    disabled={saving}
                  >
                    <Key className="h-5 w-5" />
                    {saving ? "Updating..." : "Change Password"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}