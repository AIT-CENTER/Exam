// "use client";

// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import Link from "next/link";
// import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogDescription,
//   DialogFooter,
// } from "@/components/ui/dialog";
// import { toast } from "sonner";
// import { Shield, User, Mail, Phone, Lock, Loader2, ArrowRight } from "lucide-react";

// export default function CreateAdminPage() {
//   const router = useRouter();
//   const [formData, setFormData] = useState({
//     username: "",
//     fullName: "",
//     email: "",
//     phone: "",
//     password: "",
//     confirmPassword: "",
//   });
//   const [isLoading, setIsLoading] = useState(false);
//   const [successOpen, setSuccessOpen] = useState(false);

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const { name, value } = e.target;
//     setFormData((prev) => ({ ...prev, [name]: value }));
//   };

//   const validate = () => {
//     if (!formData.username?.trim()) {
//       toast.error("Username is required");
//       return false;
//     }
//     if (!formData.fullName?.trim()) {
//       toast.error("Full name is required");
//       return false;
//     }
//     if (!formData.email?.trim()) {
//       toast.error("Email is required");
//       return false;
//     }
//     if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
//       toast.error("Please enter a valid email address");
//       return false;
//     }
//     if (!formData.phone?.trim()) {
//       toast.error("Phone number is required");
//       return false;
//     }
//     if (formData.password.length < 8) {
//       toast.error("Password must be at least 8 characters");
//       return false;
//     }
//     if (formData.password !== formData.confirmPassword) {
//       toast.error("Passwords do not match");
//       return false;
//     }
//     return true;
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!validate()) return;

//     setIsLoading(true);
//     try {
//       const res = await fetch("/api/admin/signup", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           username: formData.username.trim(),
//           fullName: formData.fullName.trim(),
//           email: formData.email.trim(),
//           phone: formData.phone.trim(),
//           password: formData.password,
//         }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         toast.error(data.error || "Failed to create admin");
//         setIsLoading(false);
//         return;
//       }

//       toast.success(data.message || "Admin created successfully");
//       setFormData({
//         username: "",
//         fullName: "",
//         email: "",
//         phone: "",
//         password: "",
//         confirmPassword: "",
//       });
//       setSuccessOpen(true);
//     } catch (err) {
//       toast.error("Network error. Please try again.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-linear-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12 px-4">
//       <Card className="w-full max-w-md shadow-lg border-slate-200 dark:border-slate-800">
//         <CardHeader className="space-y-1 text-center pb-2">
//           <div className="flex justify-center">
//             <div className="rounded-full bg-primary/10 p-3">
//               <Shield className="h-8 w-8 text-primary" />
//             </div>
//           </div>
//           <CardTitle className="text-xl font-semibold">Create Admin Account</CardTitle>
//           <CardDescription>
//             Use this page to create a new admin account. You can sign in after creation.
//           </CardDescription>
//         </CardHeader>
//         <CardContent>
//           <form onSubmit={handleSubmit} className="space-y-4">
//             <div className="space-y-2">
//               <Label htmlFor="username">Username</Label>
//               <div className="relative">
//                 <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//                 <Input
//                   id="username"
//                   name="username"
//                   type="text"
//                   placeholder="e.g. admin1"
//                   value={formData.username}
//                   onChange={handleChange}
//                   className="pl-9"
//                   disabled={isLoading}
//                   autoComplete="username"
//                 />
//               </div>
//             </div>

//             <div className="space-y-2">
//               <Label htmlFor="fullName">Full Name</Label>
//               <div className="relative">
//                 <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//                 <Input
//                   id="fullName"
//                   name="fullName"
//                   type="text"
//                   placeholder="e.g. John Doe"
//                   value={formData.fullName}
//                   onChange={handleChange}
//                   className="pl-9"
//                   disabled={isLoading}
//                   autoComplete="name"
//                 />
//               </div>
//             </div>

//             <div className="space-y-2">
//               <Label htmlFor="email">Email</Label>
//               <div className="relative">
//                 <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//                 <Input
//                   id="email"
//                   name="email"
//                   type="email"
//                   placeholder="admin@example.com"
//                   value={formData.email}
//                   onChange={handleChange}
//                   className="pl-9"
//                   disabled={isLoading}
//                   autoComplete="email"
//                 />
//               </div>
//             </div>

//             <div className="space-y-2">
//               <Label htmlFor="phone">Phone Number</Label>
//               <div className="relative">
//                 <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//                 <Input
//                   id="phone"
//                   name="phone"
//                   type="tel"
//                   placeholder="e.g. 251912345678"
//                   value={formData.phone}
//                   onChange={handleChange}
//                   className="pl-9"
//                   disabled={isLoading}
//                   autoComplete="tel"
//                 />
//               </div>
//             </div>

//             <div className="space-y-2">
//               <Label htmlFor="password">Password</Label>
//               <div className="relative">
//                 <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//                 <Input
//                   id="password"
//                   name="password"
//                   type="password"
//                   placeholder="Min 8 characters"
//                   value={formData.password}
//                   onChange={handleChange}
//                   className="pl-9"
//                   disabled={isLoading}
//                   autoComplete="new-password"
//                 />
//               </div>
//               <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
//             </div>

//             <div className="space-y-2">
//               <Label htmlFor="confirmPassword">Confirm Password</Label>
//               <div className="relative">
//                 <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//                 <Input
//                   id="confirmPassword"
//                   name="confirmPassword"
//                   type="password"
//                   placeholder="Repeat password"
//                   value={formData.confirmPassword}
//                   onChange={handleChange}
//                   className="pl-9"
//                   disabled={isLoading}
//                   autoComplete="new-password"
//                 />
//               </div>
//             </div>

//             <Button type="submit" className="w-full" disabled={isLoading}>
//               {isLoading ? (
//                 <>
//                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                   Creating...
//                 </>
//               ) : (
//                 <>
//                   Create Admin Account
//                   <ArrowRight className="ml-2 h-4 w-4" />
//                 </>
//               )}
//             </Button>
//           </form>

//           <p className="text-center text-sm text-muted-foreground mt-4">
//             Already have an account?{" "}
//             <Link href="/auth/alpha" className="text-primary font-medium hover:underline">
//               Sign in
//             </Link>
//           </p>
//         </CardContent>
//       </Card>

//       <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
//         <DialogContent className="sm:max-w-sm">
//           <DialogHeader>
//             <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-500">
//               <Shield className="h-5 w-5" />
//               Success
//             </DialogTitle>
//             <DialogDescription>
//               The admin account has been created. You can now sign in with the email and password you provided.
//             </DialogDescription>
//           </DialogHeader>
//           <DialogFooter className="sm:justify-center">
//             <Button onClick={() => router.push("/auth/alpha")}>
//               Go to Sign in
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }
