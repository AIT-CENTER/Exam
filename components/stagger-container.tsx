"use client"

import type React from "react"

import { useInView } from "react-intersection-observer"
import { Children, cloneElement, isValidElement } from "react"
import { cn } from "@/lib/utils"

interface StaggerContainerProps {
  children: React.ReactNode
  staggerDelay?: number
  className?: string
}

export function StaggerContainer({ children, staggerDelay = 100, className }: StaggerContainerProps) {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  })

  return (
    <div ref={ref} className={cn(className)}>
      {Children.map(children, (child, index) => {
        if (isValidElement(child)) {
          return cloneElement(child, {
            ...child.props,
            style: {
              ...child.props.style,
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(20px)",
              transition: `all 600ms cubic-bezier(0.4, 0, 0.2, 1) ${index * staggerDelay}ms`,
            },
          })
        }
        return child
      })}
    </div>
  )
}
