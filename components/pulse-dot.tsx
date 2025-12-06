"use client"

import { cn } from "@/lib/utils"

interface PulseDotProps {
  color?: "red" | "green" | "blue" | "yellow" | "purple" | "orange" | "pink" | "indigo"
  size?: "sm" | "md" | "lg"
  className?: string
}

export function PulseDot({ color = "green", size = "md", className }: PulseDotProps) {
  const colorClasses = {
    red: "bg-red-500",
    green: "bg-green-500",
    blue: "bg-blue-500",
    yellow: "bg-yellow-500",
    purple: "bg-purple-500",
    orange: "bg-orange-500",
    pink: "bg-pink-500",
    indigo: "bg-indigo-500",
  }

  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4",
  }

  return (
    <div className={cn("relative", className)}>
      <div className={cn("rounded-full animate-pulse", colorClasses[color], sizeClasses[size])} />
      <div
        className={cn("absolute inset-0 rounded-full animate-ping opacity-75", colorClasses[color], sizeClasses[size])}
      />
    </div>
  )
}
