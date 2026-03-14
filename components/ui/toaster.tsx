"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastAction, // Ensure this is available if needed
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          // We pass ...props to include variant, duration, and onOpenChange
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            {/* The ToastClose is now built into the Toast component logic, 
                but keeping it here is standard if your hook handles specific Close UI. 
                Based on our previous refactor, the Toast component already renders ToastClose. 
                You can keep this if you want to explicitly pass it, 
                or remove it if the Toast component already handles it. */}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}