import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Book, Plus, Shield, Settings, UserCheck } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { CookieOptions } from '@supabase/ssr';
import { Suspense } from 'react';
import { DashboardSpinner } from '@/components/ui/dashboard-spinner';

async function DashboardContent() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete(name);
        },
      },
    }
  );

  // Fetch all data
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/`);
  }

  // Additional check: Ensure user exists in admin table
  const { data: adminRow } = await supabase.from('admin').select('id, role').eq('id', user.id).maybeSingle();
  if (!adminRow) {
    redirect('/unauthorized');
  }

  const role = (adminRow.role as "super_admin" | "admin" | null) ?? "super_admin";

  // Lock dashboard home for Admin role; redirect them to a safe page
  if (role === "admin") {
    redirect("/dashboard/students");
  }

  // Fetch total students
  const { data: studentsData } = await supabase.from('students').select('id', { count: 'exact' });
  const totalStudents = studentsData?.length || 0;

  // Fetch total subjects
  const { data: subjectsData } = await supabase.from('subjects').select('id', { count: 'exact' });
  const totalSubjects = subjectsData?.length || 0;

  // Fetch total teachers
  const { data: teachersData } = await supabase.from('teacher').select('id', { count: 'exact' });
  const totalTeachers = teachersData?.length || 0;

  // Fetch teachers with grade information for the table
  const { data: teachersListData } = await supabase
    .from('teacher')
    .select(`
      id,
      username,
      full_name,
      phone_number,
      section,
      grade_id,
      subject_id,
      grades!teacher_grade_id_fkey(grade_name),
      subjects!teacher_subject_id_fkey(subject_name)
    `)
    .limit(10)
    .order('full_name');

  const teachers = teachersListData?.map(teacher => ({
    id: teacher.id,
    username: teacher.username,
    full_name: teacher.full_name,
    phone_number: teacher.phone_number || 'N/A',
    section: teacher.section || 'N/A',
    grade_name: teacher.grades?.grade_name || 'N/A',
    subject_name: teacher.subjects?.subject_name || 'N/A',
  })) || [];

  const adminStats = [
    {
      title: "Total Students",
      value: totalStudents.toLocaleString(),
      change: "Active students",
      icon: Users,
    },
    {
      title: "Total Teachers",
      value: totalTeachers.toLocaleString(),
      change: "Registered teachers",
      icon: UserCheck,
    },
    {
      title: "Subjects",
      value: totalSubjects.toLocaleString(),
      change: "Available subjects",
      icon: Book,
    },
  ];

  const quickAccessLinks = [
    { icon: Plus, label: "New Student", href: "/dashboard/students/new" },
    { icon: Shield, label: "Teacher Create Page", href: "/dashboard/teachers" },
    { icon: Settings, label: "Settings", href: "/dashboard/settings" },
  ];

  return (
    <div className="flex-1 space-y-6 bg-transparent p-6 lg:p-8">
      {/* Page Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground">
          A comprehensive summary of student performance, exam activity, and system metrics.
        </p>
      </div>

      {/* Stat Cards - Enhanced Spacing */}
      <div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {adminStats.map((stat, index) => (
            <Card key={stat.title} className="transition-shadow duration-200 hover:shadow-md shadow-sm border-muted/50">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{stat.title}</CardTitle>
                <stat.icon className="h-5 w-5 text-muted-foreground/70 flex-shrink-0" />
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.change}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Teachers Table Section */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Teachers</h2>
            <p className="text-xs text-muted-foreground mt-1">
              List of active teachers in the system ({totalTeachers} total)
            </p>
          </div>
          <Link href="/dashboard/teachers">
            <Button variant="outline" size="sm" className="text-xs h-8">
              View All
            </Button>
          </Link>
        </div>
        <Card className="shadow-sm border-muted/50">
          <CardContent className="pt-6">
            {teachers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No teachers found.</p>
            ) : (
              <div className="rounded-md border border-muted/40 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-xs font-semibold">Full Name</TableHead>
                      <TableHead className="text-xs font-semibold">Username</TableHead>
                      <TableHead className="text-xs font-semibold">Phone Number</TableHead>
                      <TableHead className="text-xs font-semibold">Section</TableHead>
                      <TableHead className="text-xs font-semibold">Grade</TableHead>
                      <TableHead className="text-xs font-semibold">Subject</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachers.map((teacher, index) => (
                      <TableRow
                        key={teacher.id}
                        className="hover:bg-muted/25 border-b border-muted/30 last:border-b-0"
                      >
                        <TableCell className="font-medium text-sm py-3">
                          {teacher.full_name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground py-3">
                          {teacher.username}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground py-3">
                          {teacher.phone_number}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground py-3">
                          {teacher.section}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground py-3">
                          {teacher.grade_name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground py-3">
                          {teacher.subject_name}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Section */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Quick Access</h2>
          <p className="text-xs text-muted-foreground mt-1">Common actions and shortcuts</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {quickAccessLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-muted shadow-sm border-muted/50 h-full">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-8">
                  <div className="p-2 rounded-lg bg-muted/40">
                    <link.icon className="h-6 w-6 text-foreground/70" />
                  </div>
                  <p className="text-center text-sm font-medium text-foreground">{link.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main page component
export default async function AdminDashboardPage() {
  return (
    <div className="bg-transparent h-full w-full">
      <Suspense fallback={<DashboardSpinner />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
