"use client"

import React, { useState, useCallback } from "react"
import { PDFViewerModal } from "./pdf-viewer-modal"

interface PDFViewerContainerProps {
  pdfUrl: string | null
  title?: string
  description?: string
}

/**
 * PDFViewerContainer - Manages PDF viewer modal state and lifecycle
 * Separates state management from UI rendering
 */
export const PDFViewerContainer: React.FC<PDFViewerContainerProps> = ({ pdfUrl, title, description }) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleDownload = useCallback(() => {
    if (!pdfUrl) return

    const link = document.createElement("a")
    link.href = pdfUrl
    link.download = `${title || "document"}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [pdfUrl, title])

  // Auto-open when pdfUrl changes
  React.useEffect(() => {
    if (pdfUrl) {
      setIsOpen(true)
    }
  }, [pdfUrl])

  return (
    <PDFViewerModal
      open={isOpen}
      onOpenChange={setIsOpen}
      pdfUrl={pdfUrl || ""}
      title={title}
      description={description}
      onDownload={handleDownload}
    />
  )
}

export default PDFViewerContainer
