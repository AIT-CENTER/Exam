"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import type { Department } from "@/types/exam"

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loadingDepartments, setLoadingDepartments] = useState(true)
  const [errorDepartments, setErrorDepartments] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchDepartments() {
      try {
        setLoadingDepartments(true)
        const { data, error } = await supabase.from("departments").select("*").order("name", { ascending: true })

        if (error) throw error

        setDepartments(data || [])
        setErrorDepartments(null)
      } catch (err) {
        console.error("[v0] Error fetching departments:", err)
        setErrorDepartments(err as Error)
      } finally {
        setLoadingDepartments(false)
      }
    }

    fetchDepartments()
  }, [])

  return { departments, loadingDepartments, errorDepartments }
}
