"use client"

import type React from "react"

import { Upload } from "lucide-react"
import { useRef } from "react"
import type { Editor } from "@tiptap/react"

interface FileUploadAreaProps {
  editor: Editor
  onClose: () => void
}

export function FileUploadArea({ editor, onClose }: FileUploadAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])

    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        alert(`File ${file.name} is too large. Maximum size is 5MB.`)
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        if (file.type.startsWith("image/")) {
          editor.chain().focus().setImage({ src: result }).run()
        }
      }
      reader.readAsDataURL(file)
    })

    onClose()
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files)

    if (files.length > 3) {
      alert("Maximum 3 files allowed")
      return
    }

    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 5MB.`)
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        if (file.type.startsWith("image/")) {
          editor.chain().focus().setImage({ src: result }).run()
        }
      }
      reader.readAsDataURL(file)
    })

    onClose()
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  return (
    <div className="my-8">
      <div
        className="border-2 border-dashed border-purple-300 rounded-lg p-12 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
            <Upload className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-gray-700">
              <span className="underline font-medium">Click to upload</span> or drag and drop
            </p>
            <p className="text-gray-500 text-sm mt-1">Maximum 3 files, 5MB each.</p>
          </div>
        </div>
      </div>
      <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="image/*" multiple />
    </div>
  )
}
