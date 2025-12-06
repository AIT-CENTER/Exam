"use client"

import { Button } from "@/components/ui/button"
import { Home, ArrowLeft, Search, FileQuestion, Compass } from "lucide-react"
import { useRouter } from "next/navigation"

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-100 flex items-center justify-center p-6">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-200/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Icon */}
        <div className="relative mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-white shadow-xl shadow-indigo-200/50 border border-indigo-100">
            <FileQuestion className="h-12 w-12 text-indigo-600" />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-gray-900/5 rounded-full blur-sm" />
        </div>

        {/* 404 Numbers */}
        <div className="mb-6">
          <h1 className="text-8xl md:text-9xl font-black tracking-tighter">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              404
            </span>
          </h1>
        </div>

        {/* Main Message */}
        <div className="space-y-3 mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Page Not Found</h2>
          <p className="text-gray-600 text-lg max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved to a different location.
          </p>
        </div>

        {/* Suggestions Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 mb-8">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center justify-center gap-2">
            <Compass className="h-5 w-5 text-indigo-600" />
            What you can do
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Search className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="font-medium text-gray-900 text-sm">Check URL</p>
              <p className="text-xs text-gray-500 mt-1">Verify the address for typos</p>
            </div>

            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <ArrowLeft className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="font-medium text-gray-900 text-sm">Go Back</p>
              <p className="text-xs text-gray-500 mt-1">Return to previous page</p>
            </div>

            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Home className="h-5 w-5 text-purple-600" />
              </div>
              <p className="font-medium text-gray-900 text-sm">Go Home</p>
              <p className="text-xs text-gray-500 mt-1">Start from the beginning</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="lg"
            className="gap-2 px-6 border-gray-200 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <Button
            onClick={() => router.push("/")}
            size="lg"
            className="gap-2 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Button>
        </div>

        {/* Help Text */}
        <p className="text-sm text-gray-500 mt-8">If you believe this is an error, please contact support</p>
      </div>
    </div>
  )
}
