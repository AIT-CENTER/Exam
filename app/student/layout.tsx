import type React from "react";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Inter, Poppins } from "next/font/google";
import { SidebarProvider } from "@/components/ui/sidebar";
import StudentLayoutClient from "./layout-client";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Student Dashboard",
  openGraph: {
    title: "Student Results & Dashboard",
    description: "",
    siteName: "School Platform",
    type: "website",
  },
};

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest-student.json" />
        <meta name="theme-color" content="#1a73e8" />
      </head>
      <body className={`${inter.variable} ${poppins.variable} font-inter antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <SidebarProvider>
            <StudentLayoutClient>{children}</StudentLayoutClient>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

