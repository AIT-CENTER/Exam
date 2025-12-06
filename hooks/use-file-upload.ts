"use client"

import type React from "react"

import { useCallback, useState } from "react"

export interface FileMetadata {
  id: string
  name: string
  size: number
  type: string
  url: string
}

export interface FileWithPreview {
  id: string
  file: File
  preview?: string
}

interface UseFileUploadOptions {
  maxFiles?: number
  maxSize?: number
  accept?: string
  multiple?: boolean
  initialFiles?: FileMetadata[]
  onFilesChange?: (files: FileWithPreview[]) => void
}

interface UseFileUploadState {
  isDragging: boolean
  errors: string[]
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

export function useFileUpload({
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB
  accept = "*",
  multiple = true,
  initialFiles = [],
  onFilesChange,
}: UseFileUploadOptions = {}) {
  const [files, setFiles] = useState<FileWithPreview[]>(() =>
    initialFiles.map((file) => ({
      id: file.id,
      file: new File([], file.name, { type: file.type }),
      preview: file.url,
    })),
  )
  const [isDragging, setIsDragging] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxSize) {
        return `File "${file.name}" is too large. Maximum size is ${formatBytes(maxSize)}.`
      }

      if (accept !== "*") {
        const acceptedTypes = accept.split(",").map((type) => type.trim())
        const isAccepted = acceptedTypes.some((type) => {
          if (type.startsWith(".")) {
            return file.name.toLowerCase().endsWith(type.toLowerCase())
          }
          return file.type.match(type.replace("*", ".*"))
        })

        if (!isAccepted) {
          return `File "${file.name}" is not an accepted file type.`
        }
      }

      return null
    },
    [maxSize, accept],
  )

  const addFiles = useCallback(
    (newFiles: File[]) => {
      const validationErrors: string[] = []
      const validFiles: FileWithPreview[] = []

      newFiles.forEach((file) => {
        const error = validateFile(file)
        if (error) {
          validationErrors.push(error)
          return
        }

        const fileWithPreview: FileWithPreview = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        }

        validFiles.push(fileWithPreview)
      })

      setFiles((prevFiles) => {
        const totalFiles = prevFiles.length + validFiles.length
        if (totalFiles > maxFiles) {
          validationErrors.push(`Cannot upload more than ${maxFiles} files.`)
          return prevFiles
        }

        const updatedFiles = [...prevFiles, ...validFiles]
        onFilesChange?.(updatedFiles)
        return updatedFiles
      })

      setErrors(validationErrors)
    },
    [validateFile, maxFiles, onFilesChange],
  )

  const removeFile = useCallback(
    (fileId: string) => {
      setFiles((prevFiles) => {
        const updatedFiles = prevFiles.filter((file) => file.id !== fileId)
        onFilesChange?.(updatedFiles)
        return updatedFiles
      })
    },
    [onFilesChange],
  )

  const clearFiles = useCallback(() => {
    setFiles([])
    setErrors([])
    onFilesChange?.([])
  }, [onFilesChange])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const droppedFiles = Array.from(e.dataTransfer.files)
      if (droppedFiles.length > 0) {
        addFiles(droppedFiles)
      }
    },
    [addFiles],
  )

  const openFileDialog = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = multiple
    input.accept = accept
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      if (target.files) {
        addFiles(Array.from(target.files))
      }
    }
    input.click()
  }, [multiple, accept, addFiles])

  const getInputProps = useCallback(
    () => ({
      type: "file" as const,
      multiple,
      accept,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
          addFiles(Array.from(e.target.files))
        }
      },
    }),
    [multiple, accept, addFiles],
  )

  const state: UseFileUploadState = {
    isDragging,
    errors,
  }

  const actions = {
    removeFile,
    clearFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    openFileDialog,
    getInputProps,
  }

  return [state, actions] as const
}
