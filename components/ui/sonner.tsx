"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={props.position ?? "bottom-right"}
      toastOptions={{
        classNames: {
          // Glassmorphism effect: Semi-transparent background + blur + thin border
          toast: 
            "group toast group-[.toaster]:bg-white/70 group-[.toaster]:backdrop-blur-xl " +
            "group-[.toaster]:border group-[.toaster]:border-white/20 " +
            "group-[.toaster]:shadow-[0_8px_30px_rgb(0,0,0,0.12)] " +
            "dark:group-[.toaster]:bg-slate-900/70 dark:group-[.toaster]:border-white/10 " +
            "group-[.toaster]:text-slate-900 dark:group-[.toaster]:text-slate-50",
            
          description: "group-[.toast]:text-slate-500 dark:group-[.toast]:text-slate-400",
          actionButton: "group-[.toast]:bg-slate-900 group-[.toast]:text-white dark:group-[.toast]:bg-slate-50 dark:group-[.toast]:text-slate-900",
          cancelButton: "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-500",
          
          // Icons are now slightly more vibrant to contrast with the glass background
          icon: "group-data-[type=error]:text-red-500 group-data-[type=success]:text-emerald-500 group-data-[type=warning]:text-amber-500 group-data-[type=info]:text-blue-500",
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      {...props}
    />
  )
}

export { Toaster }