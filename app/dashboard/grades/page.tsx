"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PlusCircle, MoreHorizontal, Edit, Trash2, BookMarked, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createBrowserClient } from "@supabase/ssr"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface Grade {
  id: number | null
  name: string
  description: string
}

interface Subject {
  id: number
  subject_name: string
  stream: string | null
}

const emptyGrade: Grade = { id: null, name: "", description: "" }

export default function GradesPage() {
  const [grades, setGrades] = useState<Grade[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [currentGrade, setCurrentGrade] = useState<Grade>(emptyGrade)
  const [gradeToDelete, setGradeToDelete] = useState<Grade | null>(null)
  const [selectedGradeForSubjects, setSelectedGradeForSubjects] = useState<Grade | null>(null)
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([])
  const [assignedSubjects, setAssignedSubjects] = useState<Record<number, number[]>>({})

  useEffect(() => {
    fetchGrades()
    fetchSubjects()
    fetchAssignedSubjects()
  }, [])

  const fetchGrades = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.from("grades").select("*").order("id", { ascending: true })

      if (error) {
        console.error("Error fetching grades:", error)
        toast.error(`Failed to load grades: ${error.message}`)
        return
      }

      setGrades(
        data.map((grade) => ({
          id: grade.id,
          name: grade.grade_name,
          description: grade.description,
        })),
      )
    } catch (error) {
      console.error("Unexpected error fetching grades:", error)
      toast.error("Unexpected error loading grades. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase.from("subjects").select("*").order("subject_name", { ascending: true })

      if (error) {
        console.error("Error fetching subjects:", error)
        return
      }

      setSubjects(data || [])
    } catch (error) {
      console.error("Unexpected error fetching subjects:", error)
    }
  }

  const fetchAssignedSubjects = async () => {
    try {
      const { data, error } = await supabase.from("grade_subjects").select("grade_id, subject_id")

      if (error) {
        console.error("Error fetching assigned subjects:", error)
        return
      }

      const grouped: Record<number, number[]> = {}
      data.forEach((assignment) => {
        if (!grouped[assignment.grade_id]) {
          grouped[assignment.grade_id] = []
        }
        grouped[assignment.grade_id].push(assignment.subject_id)
      })

      setAssignedSubjects(grouped)
    } catch (error) {
      console.error("Unexpected error fetching assigned subjects:", error)
    }
  }

  const naturalSubjects = useMemo(() => {
    return subjects.filter((s) => s.stream === "Natural")
  }, [subjects])

  const socialSubjects = useMemo(() => {
    return subjects.filter((s) => s.stream === "Social")
  }, [subjects])

  const commonSubjects = useMemo(() => {
    return subjects.filter((s) => !s.stream || s.stream === "Common")
  }, [subjects])

  // Get assigned subjects grouped by stream for a grade
  const getAssignedSubjectsByStream = (gradeId: number) => {
    const assignedIds = assignedSubjects[gradeId] || []
    const natural = subjects.filter((s) => assignedIds.includes(s.id) && s.stream === "Natural")
    const social = subjects.filter((s) => assignedIds.includes(s.id) && s.stream === "Social")
    const common = subjects.filter((s) => assignedIds.includes(s.id) && (!s.stream || s.stream === "Common"))
    return { natural, social, common }
  }

  const handleCreate = () => {
    setCurrentGrade(emptyGrade)
    setIsFormOpen(true)
  }

  const handleEdit = (grade: Grade) => {
    setCurrentGrade({
      id: grade.id,
      name: grade.name,
      description: grade.description,
    })
    setIsFormOpen(true)
  }

  const handleDelete = (grade: Grade) => {
    setGradeToDelete(grade)
    setIsDeleteDialogOpen(true)
  }

  const handleOpenAssignSubjects = (grade: Grade) => {
    setSelectedGradeForSubjects(grade)
    setSelectedSubjectIds(assignedSubjects[grade.id!] || [])
    setIsSubjectModalOpen(true)
  }

  const handleSave = async () => {
    if (!currentGrade.name.trim()) {
      toast.error("Grade name is required")
      return
    }

    setIsSaving(true)
    let error

    try {
      if (currentGrade.id) {
        const { error: updateError } = await supabase
          .from("grades")
          .update({
            grade_name: currentGrade.name.trim(),
            description: currentGrade.description || null,
          })
          .eq("id", currentGrade.id)

        error = updateError
      } else {
        const { error: insertError } = await supabase.from("grades").insert({
          grade_name: currentGrade.name.trim(),
          description: currentGrade.description || null,
        })

        error = insertError
      }

      if (error) {
        console.error("Save error:", error)
        toast.error(`Failed to save grade: ${error.message}`)
      } else {
        toast.success(currentGrade.id ? "Grade updated successfully" : "Grade created successfully")
        fetchGrades()
        setIsFormOpen(false)
        setCurrentGrade(emptyGrade)
      }
    } catch (err) {
      console.error("Unexpected save error:", err)
      toast.error("Unexpected error saving grade. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!gradeToDelete) return

    try {
      const { error: deleteError } = await supabase.from("grades").delete().eq("id", gradeToDelete.id)

      if (deleteError) {
        console.error("Delete error:", deleteError)
        toast.error(`Failed to delete grade: ${deleteError.message}`)
      } else {
        toast.success("Grade deleted successfully")
        fetchGrades()
        fetchAssignedSubjects()
      }
    } catch (err) {
      console.error("Unexpected delete error:", err)
      toast.error("Unexpected error deleting grade. Please try again.")
    } finally {
      setIsDeleteDialogOpen(false)
      setGradeToDelete(null)
    }
  }

  const handleSaveSubjects = async () => {
    if (!selectedGradeForSubjects) return

    try {
      await supabase.from("grade_subjects").delete().eq("grade_id", selectedGradeForSubjects.id)

      if (selectedSubjectIds.length > 0) {
        const newAssignments = selectedSubjectIds.map((subjectId) => ({
          grade_id: selectedGradeForSubjects.id,
          subject_id: subjectId,
        }))

        const { error } = await supabase.from("grade_subjects").insert(newAssignments)

        if (error) {
          console.error("Error assigning subjects:", error)
          toast.error(`Failed to assign subjects: ${error.message}`)
          return
        }
      }

      toast.success("Subjects assigned successfully")
      fetchAssignedSubjects()
      setIsSubjectModalOpen(false)
      setSelectedGradeForSubjects(null)
    } catch (error) {
      console.error("Unexpected error saving subjects:", error)
      toast.error("Unexpected error assigning subjects. Please try again.")
    }
  }

  const toggleSubject = (subjectId: number) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId],
    )
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="flex-1 space-y-8 p-4 lg:p-8 bg-gradient-to-b from-gray-50 to-white min-h-screen">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
            <Skeleton className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
          </div>
          <Skeleton className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <Card key={index} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-6 w-3/4 bg-gray-200 rounded animate-pulse" />
                    <Skeleton className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                  </div>
                  <Skeleton className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                </div>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="flex flex-wrap gap-1">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-8 p-4 lg:p-8 bg-gradient-to-b from-gray-50 to-white min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Grades</h1>
          <p className="text-muted-foreground mt-1">Manage your grades and assign subjects to them.</p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Create Grade
        </Button>
      </div>

      {grades.length === 0 ? (
        <Card className="text-center py-12">
          <BookMarked className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <CardTitle className="text-xl">No grades yet</CardTitle>
          <CardDescription>Create your first grade to get started.</CardDescription>
          <Button onClick={handleCreate} className="mt-4">
            Create First Grade
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {grades.map((grade) => {
            const { natural, social, common } = getAssignedSubjectsByStream(grade.id!)
            return (
              <Card key={grade.id} className="flex flex-col hover:shadow-lg transition-shadow duration-200">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl text-gray-900">{grade.name}</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {grade.description || "No description"}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            handleEdit(grade)
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          <span>Update</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            handleOpenAssignSubjects(grade)
                          }}
                        >
                          <BookMarked className="mr-2 h-4 w-4" />
                          <span>Assign Subjects</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            handleDelete(grade)
                          }}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900">Assigned Subjects</h4>

                    {natural.length === 0 && social.length === 0 && common.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No subjects assigned</p>
                    ) : (
                      <div className="space-y-3">
                        {/* Natural Science Subjects */}
                        {natural.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              Natural Science
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {natural.map((subject) => (
                                <Badge
                                  key={subject.id}
                                  variant="outline"
                                  className="text-xs bg-green-50 text-green-700 border-green-200"
                                >
                                  {subject.subject_name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Social Science Subjects */}
                        {social.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              Social Science
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {social.map((subject) => (
                                <Badge
                                  key={subject.id}
                                  variant="outline"
                                  className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                >
                                  {subject.subject_name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Common Subjects */}
                        {common.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-gray-500" />
                              Common
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {common.map((subject) => (
                                <Badge
                                  key={subject.id}
                                  variant="outline"
                                  className="text-xs bg-gray-50 text-gray-700 border-gray-200"
                                >
                                  {subject.subject_name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit Grade Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">{currentGrade.id ? "Update Grade" : "Create Grade"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {currentGrade.id ? "Update the details of the grade." : "Add a new grade to the system."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Name *
              </Label>
              <Input
                id="name"
                value={currentGrade.name}
                onChange={(e) =>
                  setCurrentGrade({
                    ...currentGrade,
                    name: e.target.value,
                  })
                }
                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Enter grade name"
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                Description
              </Label>
              <Textarea
                id="description"
                value={currentGrade.description}
                onChange={(e) =>
                  setCurrentGrade({
                    ...currentGrade,
                    description: e.target.value,
                  })
                }
                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 min-h-[100px]"
                placeholder="Enter grade description (optional)"
                disabled={isSaving}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <DialogClose asChild disabled={isSaving}>
              <Button
                type="button"
                variant="outline"
                className="border-gray-300 hover:bg-gray-100 bg-transparent"
                disabled={isSaving}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !currentGrade.name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the{" "}
              <span className="font-bold">{gradeToDelete?.name}</span> grade and any associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete Grade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isSubjectModalOpen} onOpenChange={setIsSubjectModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Subjects to {selectedGradeForSubjects?.name}</DialogTitle>
            <DialogDescription>
              Select the subjects you want to assign to this grade. Subjects are organized by stream.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="natural" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="natural" className="text-xs">
                Natural ({naturalSubjects.length})
              </TabsTrigger>
              <TabsTrigger value="social" className="text-xs">
                Social ({socialSubjects.length})
              </TabsTrigger>
              <TabsTrigger value="common" className="text-xs">
                Common ({commonSubjects.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="natural">
              <ScrollArea className="h-64 pr-4 border rounded-md p-3">
                <div className="space-y-3">
                  {naturalSubjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No Natural Science subjects available.
                    </p>
                  ) : (
                    naturalSubjects.map((subject) => (
                      <label
                        key={subject.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-green-50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedSubjectIds.includes(subject.id)}
                          onCheckedChange={() => toggleSubject(subject.id)}
                          className="border-green-400 data-[state=checked]:bg-green-600"
                        />
                        <span className="text-sm text-gray-700">{subject.subject_name}</span>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="social">
              <ScrollArea className="h-64 pr-4 border rounded-md p-3">
                <div className="space-y-3">
                  {socialSubjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No Social Science subjects available.
                    </p>
                  ) : (
                    socialSubjects.map((subject) => (
                      <label
                        key={subject.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-blue-50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedSubjectIds.includes(subject.id)}
                          onCheckedChange={() => toggleSubject(subject.id)}
                          className="border-blue-400 data-[state=checked]:bg-blue-600"
                        />
                        <span className="text-sm text-gray-700">{subject.subject_name}</span>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="common">
              <ScrollArea className="h-64 pr-4 border rounded-md p-3">
                <div className="space-y-3">
                  {commonSubjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No Common subjects available.</p>
                  ) : (
                    commonSubjects.map((subject) => (
                      <label
                        key={subject.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedSubjectIds.includes(subject.id)}
                          onCheckedChange={() => toggleSubject(subject.id)}
                        />
                        <span className="text-sm text-gray-700">{subject.subject_name}</span>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-sm text-muted-foreground">{selectedSubjectIds.length} subject(s) selected</p>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSaveSubjects} className="bg-indigo-600 hover:bg-indigo-700">
                Save Subjects
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
