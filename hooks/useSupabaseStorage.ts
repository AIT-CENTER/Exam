"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export function useSupabaseStorage() {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadFile = async (file: File, bucket = "exam_images"): Promise<string | null> => {
    try {
      setIsUploading(true)
      setError(null)

      // Generate unique filename
      const fileExt = file.name.split(".").pop()
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      console.log("[v0] Uploading file:", filePath)

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

      if (uploadError) {
        console.error("[v0] Upload error:", uploadError)
        throw uploadError
      }

      console.log("[v0] File uploaded successfully:", uploadData)

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath)

      console.log("[v0] Public URL:", urlData.publicUrl)

      return urlData.publicUrl
    } catch (err: any) {
      console.error("[v0] Error in uploadFile:", err)
      setError(err.message || "Failed to upload file")
      return null
    } finally {
      setIsUploading(false)
    }
  }

  return { uploadFile, isUploading, error }
}
