"use client"

import { useState, useCallback } from "react"

interface UsePDFViewerOptions {
  onDownload?: (filename: string) => void
}

/**
 * usePDFViewer - Custom hook for managing PDF viewer state
 * Provides open/close state, PDF URL management, and download functionality
 * Features: Memory cleanup, smooth transitions, document title tracking
 */
export const usePDFViewer = (options?: UsePDFViewerOptions) => {
  const [isOpen, setIsOpen] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [title, setTitle] = useState<string>("")

  const openPDF = useCallback((url: string, documentTitle = "Document") => {
    setPdfUrl(url)
    setTitle(documentTitle)
    setIsOpen(true)
  }, [])

  const closePDF = useCallback(() => {
    setIsOpen(false)
    // Wait for animation to complete before cleanup
    setTimeout(() => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
      setPdfUrl(null)
      setTitle("")
    }, 300)
  }, [pdfUrl])

  const downloadPDF = useCallback(() => {
    if (!pdfUrl) return

    const link = document.createElement("a")
    link.href = pdfUrl
    link.download = `${title || "document"}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    options?.onDownload?.(title)
  }, [pdfUrl, title, options])

  return {
    isOpen,
    pdfUrl,
    title,
    openPDF,
    closePDF,
    downloadPDF,
  }
}
