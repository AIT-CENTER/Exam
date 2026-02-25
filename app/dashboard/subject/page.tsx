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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const emptySubject = { id: null, name: "", description: "" };
const PAGE_SIZE = 6;

// Premium spinner matching the dashboard
function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[70vh] w-full bg-transparent">
      <style>{`
        .spinner-svg {
          animation: spinner-rotate 2s linear infinite;
        }
        .spinner-circle {
          stroke-dasharray: 1, 200;
          stroke-dashoffset: 0;
          animation: spinner-stretch 1.5s ease-in-out infinite;
          stroke-linecap: round;
        }
        @keyframes spinner-rotate {
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes spinner-stretch {
          0% {
            stroke-dasharray: 1, 200;
            stroke-dashoffset: 0;
          }
          50% {
            stroke-dasharray: 90, 200;
            stroke-dashoffset: -35px;
          }
          100% {
            stroke-dasharray: 90, 200;
            stroke-dashoffset: -124px;
          }
        }
      `}</style>
      
      <svg
        className="h-10 w-10 text-zinc-800 dark:text-zinc-200 spinner-svg"
        viewBox="25 25 50 50"
      >
        <circle
          className="spinner-circle"
          cx="50"
          cy="50"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        />
      </svg>
    </div>
  );
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentSubject, setCurrentSubject] = useState(emptySubject);
  const [subjectToDelete, setSubjectToDelete] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalSubjects, setTotalSubjects] = useState(0);

  useEffect(() => {
    fetchSubjects(page);
  }, [page]);

  const fetchSubjects = async (pageNumber: number) => {
    setIsLoading(true);
    try {
      const from = (pageNumber - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: subjectsData, error: subjectsError, count } = await supabase
        .from("subjects")
        .select("*", { count: "exact" })
        .order("subject_name", { ascending: true })
        .range(from, to);

      if (subjectsError) {
        console.error("Error fetching subjects:", subjectsError);
        toast.error(`Failed to load subjects: ${subjectsError.message}`);
        return;
      }

      const subjectsWithExams = await Promise.all(
        (subjectsData ?? []).map(async (subj) => {
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
              .select("id, title, exam_date")
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
              recent_exams: recentExams ? recentExams.map(e => ({
                id: e.id,
                name: e.title,
                start_time: e.exam_date
              })) : [],
            };
          } catch (error) {
            console.error(`Error processing subject ${subj.id}:`, error);
            return { ...subj, name: subj.subject_name, exam_count: 0, recent_exams: [] };
          }
        })
      );

      setSubjects(subjectsWithExams);
      setTotalSubjects(count ?? 0);
    } catch (error) {
      console.error("Unexpected error fetching subjects:", error);
      toast.error("Unexpected error loading subjects. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil((totalSubjects || 0) / PAGE_SIZE) || 1);

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    setPage(nextPage);
  };

  const handleCreate = () => {
    setCurrentSubject(emptySubject);
    setIsFormOpen(true);
  };

  const handleEdit = (subject: any) => {
    setCurrentSubject({
      id: subject.id,
      name: subject.subject_name || subject.name,
      description: subject.description || "",
    });
    setIsFormOpen(true);
  };

  const handleDelete = (subject: any) => {
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
        fetchSubjects(page);
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

      if (examCount && examCount > 0) {
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
        // Adjust page if deleting last item on page
        if (subjects.length === 1 && page > 1) {
          setPage(page - 1);
        } else {
          fetchSubjects(page);
        }
      }
    } catch (err) {
      console.error("Unexpected delete error:", err);
      toast.error("Unexpected error deleting subject. Please try again.");
    } finally {
      setIsDeleteDialogOpen(false);
      setSubjectToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return <PageSpinner />;
  }

  return (
    <div className="flex-1 space-y-8 p-4 lg:p-8 bg-transparent">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Subjects</h1>
          <p className="text-muted-foreground mt-1">Manage your academic subjects and their details.</p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Create Subject
        </Button>
      </div>

      {subjects.length === 0 ? (
        <Card className="py-12 text-center shadow-sm">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-muted rounded-full">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <CardTitle className="text-xl mb-2">No subjects yet</CardTitle>
          <CardDescription className="mb-6 max-w-sm mx-auto">
            Create your first subject to get started adding exams and managing your curriculum.
          </CardDescription>
          <Button onClick={handleCreate}>
            Create First Subject
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subj) => (
            <Card key={subj.id} className="flex flex-col transition-all duration-200 hover:shadow-lg shadow-sm border-muted/60">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-semibold text-foreground line-clamp-1" title={subj.name}>
                      {subj.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 min-h-[40px]">
                      {subj.description || "No description provided."}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 -mr-2">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleEdit(subj)}>
                        <Edit className="mr-2 h-4 w-4" />
                        <span>Edit</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(subj)} 
                        className="text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="grow pt-0">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm py-2 border-t border-b border-muted/40">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <BookOpen className="h-4 w-4" />
                      <span>Total Exams</span>
                    </div>
                    <span className="font-semibold bg-muted px-2 py-0.5 rounded text-xs">
                      {subj.exam_count}
                    </span>
                  </div>
                  
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Exams</h4>
                    {subj.recent_exams.length > 0 ? (
                      <div className="space-y-2">
                        {subj.recent_exams.map((exam: any) => (
                          <div
                            key={exam.id}
                            className="text-sm flex justify-between items-center group"
                          >
                            <span className="truncate flex-1 text-foreground/80 group-hover:text-foreground transition-colors">
                              {exam.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-2 bg-muted/50 px-1.5 py-0.5 rounded">
                              {formatDate(exam.start_time)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic py-1">No recent exams found.</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {subjects.length > 0 && totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handlePageChange(page - 1);
                  }}
                  className={page === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>

              {Array.from({ length: totalPages }).map((_, index) => {
                const pageNumber = index + 1;
                // Simple pagination logic to show limited page numbers
                if (
                  pageNumber === 1 ||
                  pageNumber === totalPages ||
                  (pageNumber >= page - 1 && pageNumber <= page + 1)
                ) {
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href="#"
                        isActive={pageNumber === page}
                        onClick={(e) => {
                          e.preventDefault();
                          handlePageChange(pageNumber);
                        }}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                } else if (
                  (pageNumber === page - 2 && page > 3) ||
                  (pageNumber === page + 2 && page < totalPages - 2)
                ) {
                  return (
                    <PaginationItem key={pageNumber}>
                      <span className="px-4 py-2">...</span>
                    </PaginationItem>
                  );
                }
                return null;
              })}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handlePageChange(page + 1);
                  }}
                  className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Create/Edit Subject Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{currentSubject.id ? "Edit Subject" : "Create Subject"}</DialogTitle>
            <DialogDescription>
              {currentSubject.id ? "Update the details of the subject." : "Add a new subject to the system."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Subject Name <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                value={currentSubject.name}
                onChange={(e) =>
                  setCurrentSubject({
                    ...currentSubject,
                    name: e.target.value,
                  })
                }
                placeholder="e.g. Mathematics, Physics"
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description <span className="text-muted-foreground font-normal text-xs">(Optional)</span></Label>
              <Textarea
                id="description"
                value={currentSubject.description}
                onChange={(e) =>
                  setCurrentSubject({
                    ...currentSubject,
                    description: e.target.value,
                  })
                }
                className="resize-none min-h-[100px]"
                placeholder="Brief description about this subject..."
                disabled={isSaving}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild disabled={isSaving}>
              <Button type="button" variant="outline" disabled={isSaving}>
                Cancel
              </Button>
            </DialogClose>
            <Button 
              type="button" 
              onClick={handleSave} 
              disabled={isSaving || !currentSubject.name.trim()}
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
              This action cannot be undone. This will permanently delete <span className="font-semibold text-foreground">{subjectToDelete?.name}</span> and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Subject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}