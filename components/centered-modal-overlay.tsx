"use client"

import type React from "react"
import { useEffect, useRef } from "react"

interface CenteredModalOverlayProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  size?: "sm" | "md" | "lg" | "xl" | "full"
  closeOnBackdropClick?: boolean
  closeOnEscapeKey?: boolean
  title?: string
  description?: string
  showCloseButton?: boolean
}

/**
 * CenteredModalOverlay Component
 * A fully centered modal that occupies 100% viewport with smooth animations.
 * Features: Focus trapping, keyboard support, accessibility attributes, responsive sizing.
 */
export function CenteredModalOverlay({
  isOpen,
  onClose,
  children,
  size = "md",
  closeOnBackdropClick = true,
  closeOnEscapeKey = true,
  title,
  description,
  showCloseButton = true,
}: CenteredModalOverlayProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Size mapping
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
    full: "max-w-[90vw]",
  }

  useEffect(() => {
    if (!isOpen) return

    const originalStyle = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEscapeKey && event.key === "Escape") {
        onClose()
      }

      if (event.key === "Tab" && contentRef.current && modalRef.current) {
        const focusableElements = contentRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        const firstElement = focusableElements[0] as HTMLElement
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault()
          lastElement?.focus()
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = originalStyle
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose, closeOnEscapeKey])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === modalRef.current) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        aria-hidden="true"
      />

      <div
        ref={contentRef}
        className={`relative z-10 w-full mx-4 ${sizeClasses[size]} max-h-[90vh] overflow-y-auto bg-background rounded-lg shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        aria-describedby={description ? "modal-description" : undefined}
      >
        {title && (
          <div className="sticky top-0 z-20 px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-start justify-between gap-4">
            <div>
              <h2 id="modal-title" className="text-lg font-semibold leading-tight">
                {title}
              </h2>
              {description && (
                <p id="modal-description" className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close modal"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
