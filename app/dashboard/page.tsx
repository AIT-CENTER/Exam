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

// Advanced spinner that rotates and changes the arc length dynamically
function DashboardSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[70vh] w-full bg-transparent">
      {/* 
        The outer SVG rotates linearly.
        The inner circle's stroke expands and contracts using dasharray and dashoffset.
      */}
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

async function DashboardContent() {
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
    <div className="flex-1 space-y-8 bg-transparent p-4 lg:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">
            A comprehensive summary of student performance, exam activity, and system metrics.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {adminStats.map((stat, index) => (
          <Card key={stat.title} className="transition-shadow duration-200 hover:shadow-lg shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-5 w-5 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Teachers Table */}
      <Card className="transition-shadow duration-200 hover:shadow-lg shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl text-foreground">Teachers</CardTitle>
            <CardDescription className="text-muted-foreground">
              List of active teachers in the system ({totalTeachers} total)
            </CardDescription>
          </div>
          <Link href="/dashboard/teachers">
            <Button variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50">
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
                  <TableHead>Full Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Subject</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher) => (
                  <TableRow key={teacher.id} className="transition-colors hover:bg-muted/40">
                    <TableCell className="max-w-[150px] truncate font-medium">
                      {teacher.full_name}
                    </TableCell>
                    <TableCell className="max-w-[120px] overflow-hidden whitespace-nowrap text-muted-foreground">
                      {teacher.username}
                    </TableCell>

                    <TableCell className="max-w-[120px] overflow-hidden whitespace-nowrap text-muted-foreground">
                      {teacher.phone_number}
                    </TableCell>

                    <TableCell className="max-w-[120px] overflow-hidden whitespace-nowrap text-muted-foreground">
                      {teacher.section}
                    </TableCell>

                    <TableCell className="max-w-[120px] overflow-hidden whitespace-nowrap text-muted-foreground">
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
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Quick Access</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {quickAccessLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="cursor-pointer transition-shadow duration-200 hover:bg-muted/60 hover:shadow-lg shadow-sm">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-8">
                  <link.icon className="h-8 w-8 text-indigo-500" />
                  <p className="text-center font-medium text-foreground">{link.label}</p>
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