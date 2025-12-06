"use client"

import type React from "react"
import { useEffect, useRef, useCallback } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface StandardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  children?: React.ReactNode
  size?: "sm" | "md" | "lg" | "xl"
  footer?: React.ReactNode
  onClose?: () => void
  closeButton?: boolean
}

/**
 * StandardModal: A reusable modal component with proper centering, animations, and accessibility
 * - Centered vertically and horizontally on screen
 * - Smooth fade-in backdrop and slide-up modal animation
 * - Focus trapping for keyboard navigation
 * - ARIA attributes for screen readers
 * - ESC key support to close
 * - Responsive design across all devices
 */
export function StandardModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
  footer,
  onClose,
  closeButton = true,
}: StandardModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previousActiveElement.current = document.activeElement as HTMLElement
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false)
        onClose?.()
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        const firstElement = focusableElements[0] as HTMLElement
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"

    // Auto focus on first focusable element
    setTimeout(() => {
      const firstFocusable = modalRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) as HTMLElement
      firstFocusable?.focus()
    }, 100)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "unset"
      previousActiveElement.current?.focus()
    }
  }, [open, onOpenChange, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onOpenChange(false)
        onClose?.()
      }
    },
    [onOpenChange, onClose],
  )

  if (!open) return null

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
        <div
          ref={modalRef}
          className={`bg-background border border-border rounded-lg shadow-lg w-full ${sizeClasses[size]} animate-in fade-in slide-in-from-bottom-4 duration-300`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "modal-title" : undefined}
          aria-describedby={description ? "modal-description" : undefined}
        >
          <div className="flex items-start justify-between p-6 border-b border-border">
            <div className="flex-1">
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold text-foreground">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-description" className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
            {closeButton && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8 ml-2 hover:bg-muted"
                onClick={() => {
                  onOpenChange(false)
                  onClose?.()
                }}
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="p-6">{children}</div>

          {footer && (
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/30">{footer}</div>
          )}
        </div>
      </div>
    </>
  )
}
