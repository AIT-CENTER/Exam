"use client"

import type React from "react"

import { cn } from "@/lib/utils"

interface FloatingCardProps {
  children: React.ReactNode
  className?: string
  hoverScale?: number
  hoverRotate?: number
}

export function FloatingCard({ children, className, hoverRotate = 0 }: FloatingCardProps) {
  return (
    <div
      className={cn("transition-all duration-300 ease-out ", className)}
      style={{
        transform: "perspective(1000px)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `perspective(1000px)) rotateY(${hoverRotate}deg)`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "perspective(1000px) scale(1) rotateY(0deg)"
      }}
    >
      {children}
    </div>
  )
}
