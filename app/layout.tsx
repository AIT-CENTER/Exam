// app/layout.tsx
import type React from "react";
import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip"; // Itti dabalamee jira
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
  title: "Student & Exam Management Platform",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "School data Managing and monitoring",
    description: "Manage and monitor school and student data",
    siteName: "School Platform",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest-student.json" />
        <meta name="theme-color" content="#1a73e8" />
        <style>{`
          html {
            font-family: ${inter.style.fontFamily}, system-ui, sans-serif;
            --font-inter: ${inter.variable};
            --font-poppins: ${poppins.variable};
          }
        `}</style>
      </head>
      <body
        className={`${inter.variable} ${poppins.variable} font-inter antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {/* TooltipProvider ashaaraa haaraatiif asitti dabalameera */}
          <TooltipProvider>
            {children}
            <Toaster richColors position="top-center" />
          </TooltipProvider>

          <Script
            src="https://3Dmol.org/build/3Dmol-min.js"
            strategy="afterInteractive"
          />
        </ThemeProvider>

        <SpeedInsights />
      </body>
    </html>
  );
}