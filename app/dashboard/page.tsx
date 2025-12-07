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
import { Users, Book, TrendingUp, Plus, Shield, Settings, UserCheck } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { CookieOptions } from '@supabase/ssr';
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from 'react';

// Loading skeleton component
function DashboardSkeleton() {
  return (
    <div className="flex-1 space-y-8 p-4 lg:p-8 bg-gradient-to-b from-gray-50 to-white min-h-screen">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        <Skeleton className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <Skeleton className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
              <Skeleton className="h-3 w-24 bg-gray-200 rounded animate-pulse mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Teachers Table Skeleton */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            <Skeleton className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
          <Skeleton className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {[...Array(6)].map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {[...Array(6)].map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quick Access Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
                <Skeleton className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                <Skeleton className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

async function DashboardContent() {
  // Move cookies() call inside the component function
  const cookieStore = cookies();

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
  const { data: admin } = await supabase.from('admin').select('id').eq('id', user.id).single();
  if (!admin) {
    redirect('/unauthorized');
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
    <div className="flex-1 space-y-8 p-4 lg:p-8 bg-gradient-to-b from-gray-50 to-white min-h-screen">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">
            A comprehensive summary of student performance, exam activity, and system metrics.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        {adminStats.map((stat, index) => (
          <Card key={stat.title} className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">{stat.title}</CardTitle>
              <stat.icon className="h-5 w-5 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Teachers Table */}
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl text-gray-900">Teachers</CardTitle>
            <CardDescription className="text-muted-foreground">
              List of active teachers in the system ({totalTeachers} total)
            </CardDescription>
          </div>
          <Link href="/dashboard/teachers">
            <Button variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {teachers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No teachers found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="text-gray-700">Full Name</TableHead>
                  <TableHead className="text-gray-700">Username</TableHead>
                  <TableHead className="text-gray-700">Phone Number</TableHead>
                  <TableHead className="text-gray-700">Section</TableHead>
                  <TableHead className="text-gray-700">Grade</TableHead>
                  <TableHead className="text-gray-700">Subject</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher) => (
                  <TableRow key={teacher.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium text-gray-900 truncate max-w-[150px]">
                      {teacher.full_name}
                    </TableCell>
                   <TableCell className="text-muted-foreground truncate max-w-[120px] overflow-hidden whitespace-nowrap">
                    {teacher.username}
                  </TableCell>

                  <TableCell className="text-muted-foreground truncate max-w-[120px] overflow-hidden whitespace-nowrap">
                    {teacher.phone_number}
                  </TableCell>

                  <TableCell className="text-muted-foreground truncate max-w-[120px] overflow-hidden whitespace-nowrap">
                    {teacher.section}
                  </TableCell>

                  <TableCell className="text-muted-foreground truncate max-w-[120px] overflow-hidden whitespace-nowrap">
                    {teacher.grade_name}
                  </TableCell>

                  <TableCell className="text-muted-foreground truncate max-w-[120px] overflow-hidden whitespace-nowrap">
                    {teacher.subject_name}
                  </TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Quick Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickAccessLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer hover:bg-indigo-50">
                <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
                  <link.icon className="h-8 w-8 text-indigo-500" />
                  <p className="text-center font-medium text-gray-900">{link.label}</p>
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
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}