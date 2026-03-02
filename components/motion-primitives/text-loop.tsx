"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface TextLoopProps {
  children: React.ReactNode[];
  interval?: number;
  className?: string;
}

/**
 * Text loop – cycles through items with smooth transition.
 * Used for displaying new risk events in live monitor.
 */
export function TextLoop({
  children,
  interval = 3,
  className = "",
}: TextLoopProps) {
  const [index, setIndex] = useState(0);
  const items = Array.isArray(children) ? children : [children];

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, interval * 1000);
    return () => clearInterval(id);
  }, [items.length, interval]);

  if (items.length === 0) return null;
  if (items.length === 1) return <span className={className}>{items[0]}</span>;

  return (
    <span className={`relative inline-block overflow-hidden ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={index}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="block"
        >
          {items[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
