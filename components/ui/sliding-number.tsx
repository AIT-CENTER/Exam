"use client"

import { motion, useSpring, useTransform } from "framer-motion"
import { useEffect } from "react"

interface SlidingNumberProps {
  value: number
  className?: string
  duration?: number
}

export function SlidingNumber({ value, className = "", duration = 0.5 }: SlidingNumberProps) {
  const spring = useSpring(0, { duration: duration * 1000 })
  const display = useTransform(spring, (current) => Math.round(current))

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  return <motion.span className={className}>{display}</motion.span>
}
