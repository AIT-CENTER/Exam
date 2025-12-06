"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusCircle, MoreHorizontal, Edit, Trash2, BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";

const emptySubject = { id: null, name: "", description: "" };

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentSubject, setCurrentSubject] = useState(emptySubject);
  const [subjectToDelete, setSubjectToDelete] = useState(null);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setIsLoading(true);
    try {
      const { data: subjectsData, error: subjectsError } = await supabase
        .from("subjects")
        .select("*")
        .order("subject_name", { ascending: true });

      if (subjectsError) {
        console.error("Error fetching subjects:", subjectsError);
        toast.error(`Failed to load subjects: ${subjectsError.message}`);
        return;
      }

      const subjectsWithExams = await Promise.all(
        subjectsData.map(async (subj) => {
          try {
            // Count exams
            const { count: examCount, error: countError } = await supabase
              .from("exams")
              .select("*", { count: "exact", head: true })
              .eq("subject_id", subj.id);

            if (countError) {
              console.error("Error counting exams:", countError);
            }

            // Recent exams
            const { data: recentExams, error: recentError } = await supabase
              .from("exams")
              .select("id, title as name, exam_date as start_time")
              .eq("subject_id", subj.id)
              .order("exam_date", { ascending: false })
              .limit(3);

            if (recentError) {
              console.error("Error fetching recent exams:", recentError);
            }

            return {
              ...subj,
              name: subj.subject_name,
              exam_count: examCount || 0,
              recent_exams: recentExams || [],
            };
          } catch (error) {
            console.error(`Error processing subject ${subj.id}:`, error);
            return { ...subj, name: subj.subject_name, exam_count: 0, recent_exams: [] };
          }
        })
      );

      setSubjects(subjectsWithExams);
    } catch (error) {
      console.error("Unexpected error fetching subjects:", error);
      toast.error("Unexpected error loading subjects. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setCurrentSubject(emptySubject);
    setIsFormOpen(true);
  };

  const handleEdit = (subject) => {
    setCurrentSubject({
      id: subject.id,
      name: subject.subject_name || subject.name,
      description: subject.description,
    });
    setIsFormOpen(true);
  };

  const handleDelete = (subject) => {
    setSubjectToDelete(subject);
    setIsDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentSubject.name.trim()) {
      toast.error("Subject name is required");
      return;
    }

    setIsSaving(true);
    let error;

    try {
      if (currentSubject.id) {
        // Update existing subject
        const { error: updateError } = await supabase
          .from("subjects")
          .update({
            subject_name: currentSubject.name.trim(),
            description: currentSubject.description || null,
          })
          .eq("id", currentSubject.id)
          .select();

        error = updateError;
      } else {
        // Create new subject
        const { error: insertError } = await supabase
          .from("subjects")
          .insert({
            subject_name: currentSubject.name.trim(),
            description: currentSubject.description || null,
          })
          .select();

        error = insertError;
      }

      if (error) {
        console.error("Save error:", error);
        toast.error(`Failed to save subject: ${error.message}`);
      } else {
        toast.success(currentSubject.id ? "Subject updated successfully" : "Subject created successfully");
        fetchSubjects();
        setIsFormOpen(false);
        setCurrentSubject(emptySubject);
      }
    } catch (err) {
      console.error("Unexpected save error:", err);
      toast.error("Unexpected error saving subject. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!subjectToDelete) return;

    try {
      // First, check if subject has associated exams (prevent delete if has)
      const { count: examCount } = await supabase
        .from("exams")
        .select("*", { count: "exact", head: true })
        .eq("subject_id", subjectToDelete.id);

      if (examCount > 0) {
        toast.error("Cannot delete subject with associated exams. Remove exams first.");
        setIsDeleteDialogOpen(false);
        setSubjectToDelete(null);
        return;
      }

      const { error: deleteError } = await supabase
        .from("subjects")
        .delete()
        .eq("id", subjectToDelete.id);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        toast.error(`Failed to delete subject: ${deleteError.message}`);
      } else {
        toast.success("Subject deleted successfully");
        fetchSubjects();
      }
    } catch (err) {
      console.error("Unexpected delete error:", err);
      toast.error("Unexpected error deleting subject. Please try again.");
    } finally {
      setIsDeleteDialogOpen(false);
      setSubjectToDelete(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="flex-1 space-y-8 p-4 lg:p-8 bg-gradient-to-b from-gray-50 to-white min-h-screen">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
            <Skeleton className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
          </div>
          <Skeleton className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Subjects Grid Skeleton */}
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
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                    <Skeleton className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <Skeleton className="h-4 w-8 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="space-y-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <Skeleton className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />
                        <Skeleton className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-8 p-4 lg:p-8 bg-gradient-to-b from-gray-50 to-white min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Subjects</h1>
          <p className="text-muted-foreground mt-1">Manage your academic subjects and their details.</p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Create Subject
        </Button>
      </div>

      {subjects.length === 0 ? (
        <Card className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <CardTitle className="text-xl">No subjects yet</CardTitle>
          <CardDescription>Create your first subject to get started.</CardDescription>
          <Button onClick={handleCreate} className="mt-4">
            Create First Subject
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((subj) => (
            <Card key={subj.id} className="flex flex-col hover:shadow-lg transition-shadow duration-200">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl text-gray-900">{subj.name}</CardTitle>
                    <CardDescription className="text-muted-foreground">{subj.description || "No description"}</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleEdit(subj); }}>
                        <Edit className="mr-2 h-4 w-4" />
                        <span>Edit</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onSelect={(e) => { e.preventDefault(); handleDelete(subj); }} 
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
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <BookOpen className="h-4 w-4" />
                      <span>Exams</span>
                    </div>
                    <span className="font-semibold text-gray-900">{subj.exam_count}</span>
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-gray-900">Recent Exams</h4>
                    {subj.recent_exams.length > 0 ? (
                      <div className="space-y-1">
                        {subj.recent_exams.map((exam) => (
                          <div
                            key={exam.id}
                            className="text-xs text-muted-foreground flex justify-between items-center"
                          >
                            <span className="truncate flex-1">{exam.name}</span>
                            <span className="text-[10px] ml-2">{formatDate(exam.start_time)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No recent exams.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Subject Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">{currentSubject.id ? "Edit Subject" : "Create Subject"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {currentSubject.id ? "Update the details of the subject." : "Add a new subject to the system."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Name *
              </Label>
              <Input
                id="name"
                value={currentSubject.name}
                onChange={(e) =>
                  setCurrentSubject({
                    ...currentSubject,
                    name: e.target.value,
                  })
                }
                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Enter subject name"
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                Description
              </Label>
              <Textarea
                id="description"
                value={currentSubject.description}
                onChange={(e) =>
                  setCurrentSubject({
                    ...currentSubject,
                    description: e.target.value,
                  })
                }
                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 min-h-[100px]"
                placeholder="Enter subject description (optional)"
                disabled={isSaving}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <DialogClose asChild disabled={isSaving}>
              <Button type="button" variant="outline" className="border-gray-300 hover:bg-gray-100" disabled={isSaving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleSave} disabled={isSaving || !currentSubject.name.trim()} className="bg-indigo-600 hover:bg-indigo-700">
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
              <span className="font-bold">{subjectToDelete?.name}</span> subject and any associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete Subject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}