"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  PlusCircle,
  MoreHorizontal,
  Edit,
  Trash2,
  BookMarked,
  Users,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Eye,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { createBrowserClient } from "@supabase/ssr";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Grade {
  id: number | null;
  name: string;
  description: string;
}

interface Subject {
  id: number;
  subject_name: string;
  stream: string | null;
}

interface GradeSection {
  id: number;
  grade_id: number;
  section_name: string;
}

const emptyGrade: Grade = { id: null, name: "", description: "" };
const ITEMS_PER_PAGE = 6;

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

export default function GradesPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isViewSubjectsModalOpen, setIsViewSubjectsModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentGrade, setCurrentGrade] = useState<Grade>(emptyGrade);
  const [gradeToDelete, setGradeToDelete] = useState<Grade | null>(null);
  
  // Selection states for modals
  const [selectedGradeForSubjects, setSelectedGradeForSubjects] = useState<Grade | null>(null);
  const [selectedGradeForViewSubjects, setSelectedGradeForViewSubjects] = useState<Grade | null>(null);
  const [selectedGradeForSections, setSelectedGradeForSections] = useState<Grade | null>(null);
  
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [sectionInput, setSectionInput] = useState("");
  
  // Data Maps
  const [assignedSubjects, setAssignedSubjects] = useState<Record<number, number[]>>({});
  const [assignedSections, setAssignedSections] = useState<Record<number, GradeSection[]>>({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchGrades(),
      fetchSubjects(),
      fetchSections(),
      fetchAssignedSubjects()
    ]);
    setIsLoading(false);
  };

  const fetchGrades = async () => {
    try {
      const { data, error } = await supabase
        .from("grades")
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        toast.error(`Failed to load grades: ${error.message}`);
        return;
      }

      setGrades(
        data.map((grade) => ({
          id: grade.id,
          name: grade.grade_name,
          description: grade.description,
        }))
      );
    } catch (error) {
      console.error("Error fetching grades:", error);
    }
  };

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .order("subject_name", { ascending: true });

      if (error) return;
      setSubjects(data || []);
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
  };

  const fetchSections = async () => {
    try {
      // Fetch ALL sections at once to populate cards correctly
      const { data, error } = await supabase
        .from("grade_sections")
        .select("*")
        .order("section_name", { ascending: true });

      if (error) return;

      // Group sections by grade_id
      const grouped: Record<number, GradeSection[]> = {};
      (data || []).forEach(section => {
        if (!grouped[section.grade_id]) {
          grouped[section.grade_id] = [];
        }
        grouped[section.grade_id].push(section);
      });

      setAssignedSections(grouped);
    } catch (error) {
      console.error("Error fetching sections:", error);
    }
  };

  const fetchAssignedSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from("grade_subjects")
        .select("grade_id, subject_id");

      if (error) return;

      const grouped: Record<number, number[]> = {};
      data.forEach((assignment) => {
        if (!grouped[assignment.grade_id]) {
          grouped[assignment.grade_id] = [];
        }
        grouped[assignment.grade_id].push(assignment.subject_id);
      });

      setAssignedSubjects(grouped);
    } catch (error) {
      console.error("Error fetching assigned subjects:", error);
    }
  };

  const allSubjects = useMemo(() => {
    return subjects;
  }, [subjects]);

  // Get assigned subjects grouped by stream for a grade
  const getAssignedSubjectsByStream = (gradeId: number) => {
    const assignedIds = assignedSubjects[gradeId] || [];
    const natural = subjects.filter(
      (s) => assignedIds.includes(s.id) && s.stream === "Natural"
    );
    const social = subjects.filter(
      (s) => assignedIds.includes(s.id) && s.stream === "Social"
    );
    const common = subjects.filter(
      (s) => assignedIds.includes(s.id) && (!s.stream || s.stream === "Common")
    );
    const all = subjects.filter((s) => assignedIds.includes(s.id));
    return { natural, social, common, all };
  };

  // Get assigned sections for a grade
  const getAssignedSections = (gradeId: number) => {
    return assignedSections[gradeId] || [];
  };

  // Pagination logic
  const totalPages = Math.ceil(grades.length / ITEMS_PER_PAGE);
  const paginatedGrades = grades.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
    setCurrentPage(nextPage);
  };

  const handleCreate = () => {
    setCurrentGrade(emptyGrade);
    setIsFormOpen(true);
  };

  const handleEdit = (grade: Grade) => {
    setCurrentGrade({
      id: grade.id,
      name: grade.name,
      description: grade.description,
    });
    setIsFormOpen(true);
  };

  const handleDelete = (grade: Grade) => {
    setGradeToDelete(grade);
    setIsDeleteDialogOpen(true);
  };

  const handleOpenAssignSubjects = (grade: Grade) => {
    setSelectedGradeForSubjects(grade);
    setSelectedSubjectIds(assignedSubjects[grade.id!] || []);
    setIsSubjectModalOpen(true);
  };

  const handleOpenViewSubjects = (grade: Grade) => {
    setSelectedGradeForViewSubjects(grade);
    setIsViewSubjectsModalOpen(true);
  };

  const handleOpenAssignSections = (grade: Grade) => {
    setSelectedGradeForSections(grade);
    setSectionInput("");
    setIsSectionModalOpen(true);
  };

  const handleSave = async () => {
    if (!currentGrade.name.trim()) {
      toast.error("Grade name is required");
      return;
    }

    setIsSaving(true);
    let error;

    try {
      if (currentGrade.id) {
        const { error: updateError } = await supabase
          .from("grades")
          .update({
            grade_name: currentGrade.name.trim(),
            description: currentGrade.description || null,
          })
          .eq("id", currentGrade.id);

        error = updateError;
      } else {
        const { error: insertError } = await supabase.from("grades").insert({
          grade_name: currentGrade.name.trim(),
          description: currentGrade.description || null,
        });

        error = insertError;
      }

      if (error) {
        toast.error(`Failed to save grade: ${error.message}`);
      } else {
        toast.success(
          currentGrade.id
            ? "Grade updated successfully"
            : "Grade created successfully"
        );
        fetchGrades();
        setIsFormOpen(false);
        setCurrentGrade(emptyGrade);
      }
    } catch (err) {
      toast.error("Unexpected error saving grade.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!gradeToDelete) return;

    try {
      const { error: deleteError } = await supabase
        .from("grades")
        .delete()
        .eq("id", gradeToDelete.id);

      if (deleteError) {
        toast.error(`Failed to delete grade: ${deleteError.message}`);
      } else {
        toast.success("Grade deleted successfully");
        fetchGrades();
        fetchAssignedSubjects();
        // Reset to first page if current page becomes empty
        if (paginatedGrades.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1);
        }
      }
    } catch (err) {
      toast.error("Unexpected error deleting grade.");
    } finally {
      setIsDeleteDialogOpen(false);
      setGradeToDelete(null);
    }
  };

  const handleSaveSubjects = async () => {
    if (!selectedGradeForSubjects) return;

    try {
      await supabase
        .from("grade_subjects")
        .delete()
        .eq("grade_id", selectedGradeForSubjects.id);

      if (selectedSubjectIds.length > 0) {
        const newAssignments = selectedSubjectIds.map((subjectId) => ({
          grade_id: selectedGradeForSubjects.id,
          subject_id: subjectId,
        }));

        const { error } = await supabase
          .from("grade_subjects")
          .insert(newAssignments);

        if (error) {
          toast.error(`Failed to assign subjects: ${error.message}`);
          return;
        }
      }

      toast.success("Subjects assigned successfully");
      fetchAssignedSubjects();
      setIsSubjectModalOpen(false);
      setSelectedGradeForSubjects(null);
    } catch (error) {
      toast.error("Unexpected error assigning subjects.");
    }
  };

  const handleAddSection = async () => {
    if (!selectedGradeForSections || !sectionInput.trim()) {
      toast.error("Section name is required");
      return;
    }

    try {
      const { error } = await supabase.from("grade_sections").insert({
        grade_id: selectedGradeForSections.id,
        section_name: sectionInput.trim(),
      });

      if (error) {
        toast.error(`Failed to add section: ${error.message}`);
        return;
      }

      toast.success("Section added successfully");
      setSectionInput("");
      fetchSections(); // Re-fetch all to update state
    } catch (error) {
      toast.error("Unexpected error adding section.");
    }
  };

  const handleDeleteSection = async (sectionId: number) => {
    try {
      const { error } = await supabase
        .from("grade_sections")
        .delete()
        .eq("id", sectionId);

      if (error) {
        toast.error(`Failed to delete section: ${error.message}`);
        return;
      }

      toast.success("Section deleted successfully");
      fetchSections(); // Re-fetch all to update state
    } catch (error) {
      toast.error("Unexpected error deleting section.");
    }
  };

  const toggleSubject = (subjectId: number) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  if (isLoading) {
    return <PageSpinner />;
  }

  return (
    <div className="flex-1 space-y-8 p-4 lg:p-8 bg-transparent min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Grades
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your grades and assign subjects and sections to them.
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2 w-full sm:w-auto">
          <PlusCircle className="h-4 w-4" />
          Create Grade
        </Button>
      </div>

      {grades.length === 0 ? (
        <Card className="py-16 text-center border-dashed border-2 rounded-xl bg-muted/30 shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <BookMarked className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">No grades yet</CardTitle>
          <CardDescription className="mt-2 max-w-sm mx-auto">
            Create your first grade to get started managing subjects and sections.
          </CardDescription>
          <Button onClick={handleCreate} className="mt-6">
            Create First Grade
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {paginatedGrades.map((grade) => {
              const {
                natural,
                social,
                common,
                all: allAssigned,
              } = getAssignedSubjectsByStream(grade.id!);
              const gradeSections = getAssignedSections(grade.id!);
              
              return (
                <Card
                  key={grade.id}
                  className="flex flex-col transition-all duration-200 hover:shadow-lg shadow-sm border-muted/60"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-semibold text-foreground line-clamp-1">
                          {grade.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 min-h-[40px]">
                          {grade.description || "No description provided"}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 -mr-2"
                          >
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-lg">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => handleEdit(grade)}
                            className="cursor-pointer"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Update
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenAssignSubjects(grade)}
                            className="cursor-pointer"
                          >
                            <BookMarked className="mr-2 h-4 w-4" />
                            Assign Subjects
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenAssignSections(grade)}
                            className="cursor-pointer"
                          >
                            <Users className="mr-2 h-4 w-4" />
                            Manage Sections
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenViewSubjects(grade)}
                            className="cursor-pointer"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(grade)}
                            className="text-destructive focus:text-destructive focus:bg-red-50 dark:focus:bg-red-950/50 cursor-pointer"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent className="grow pt-0">
                    <div className="space-y-4">
                      {/* Stat Row */}
                      <div className="flex justify-between items-center text-sm py-2 border-t border-b border-muted/40">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <BookMarked className="h-4 w-4" />
                          <span>Total Subjects</span>
                        </div>
                        <span className="font-semibold bg-muted px-2 py-0.5 rounded text-xs">
                          {allAssigned.length}
                        </span>
                      </div>
                      
                      {/* Overview List (Replacing Recent Exams list style) */}
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Overview
                        </h4>
                        <div className="space-y-2">
                           {/* Natural */}
                           <div className="text-sm flex justify-between items-center group">
                             <span className="text-foreground/80 group-hover:text-foreground transition-colors">Natural Sciences</span>
                             <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                               {natural.length} Subj.
                             </Badge>
                           </div>

                           {/* Social */}
                           <div className="text-sm flex justify-between items-center group">
                             <span className="text-foreground/80 group-hover:text-foreground transition-colors">Social Sciences</span>
                             <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                               {social.length} Subj.
                             </Badge>
                           </div>

                           {/* Common */}
                           <div className="text-sm flex justify-between items-center group">
                             <span className="text-foreground/80 group-hover:text-foreground transition-colors">Common Subjects</span>
                             <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-700 border-gray-200">
                               {common.length} Subj.
                             </Badge>
                           </div>

                           {/* Link to view detailed subjects */}
                           <div 
                             className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-1 pt-1"
                             onClick={() => handleOpenViewSubjects(grade)}
                           >
                             View full subject list <ArrowRight className="h-3 w-3" />
                           </div>

                           {/* Sections Row */}
                           <div className="text-sm flex justify-between items-center group pt-2 border-t border-dashed border-muted/60 mt-2">
                             <span className="text-foreground/80 font-medium group-hover:text-foreground transition-colors flex items-center gap-1.5">
                               <Users className="h-3 w-3 text-muted-foreground" />
                               Active Sections
                             </span>
                             <div className="flex gap-1 flex-wrap justify-end">
                                {gradeSections.length > 0 ? (
                                    gradeSections.slice(0, 3).map(sec => (
                                        <Badge key={sec.id} variant="secondary" className="text-[10px] px-1.5 h-5">
                                            {sec.section_name}
                                        </Badge>
                                    ))
                                ) : (
                                    <span className="text-[10px] text-muted-foreground italic">None</span>
                                )}
                                {gradeSections.length > 3 && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 h-5">+{gradeSections.length - 3}</Badge>
                                )}
                             </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(currentPage - 1);
                      }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>

                  {Array.from({ length: totalPages }).map((_, index) => {
                    const pageNumber = index + 1;
                    if (
                      pageNumber === 1 ||
                      pageNumber === totalPages ||
                      (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                    ) {
                      return (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            href="#"
                            isActive={pageNumber === currentPage}
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
                      (pageNumber === currentPage - 2 && currentPage > 3) ||
                      (pageNumber === currentPage + 2 && currentPage < totalPages - 2)
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
                        handlePageChange(currentPage + 1);
                      }}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Grade Dialog - Modern Shadcn Design */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {currentGrade.id ? "Edit grade" : "Create grade"}
            </DialogTitle>
            <DialogDescription>
              {currentGrade.id
                ? "Make changes to your grade here. Click save when you're done."
                : "Add a new grade to the system. Click save when you're done."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Name
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
                placeholder="e.g., Grade 10"
                disabled={isSaving}
                className="focus-visible:ring-primary"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">
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
                placeholder="Enter a description (optional)"
                disabled={isSaving}
                className="min-h-[100px] focus-visible:ring-primary"
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-end border-t pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !currentGrade.name.trim()}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog - Modern Shadcn Design */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <span className="font-semibold">{gradeToDelete?.name}</span> and
              remove all associated data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 border-t pt-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Grade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Subjects Dialog - Modern Shadcn Design */}
      <Dialog open={isSubjectModalOpen} onOpenChange={setIsSubjectModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Assign subjects to {selectedGradeForSubjects?.name}
            </DialogTitle>
            <DialogDescription>
              Select the subjects you want to assign to this grade. Click save when you're done.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {allSubjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No subjects available.
                  </p>
                ) : (
                  allSubjects.map((subject) => {
                    const getStreamColor = () => {
                      if (subject.stream === "Natural")
                        return "bg-emerald-100 text-emerald-700 border-emerald-200";
                      if (subject.stream === "Social")
                        return "bg-blue-100 text-blue-700 border-blue-200";
                      return "bg-gray-100 text-gray-700 border-gray-200";
                    };

                    return (
                      <div
                        key={subject.id}
                        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          id={`subject-${subject.id}`}
                          checked={selectedSubjectIds.includes(subject.id)}
                          onCheckedChange={() => toggleSubject(subject.id)}
                        />
                        <Label
                          htmlFor={`subject-${subject.id}`}
                          className="flex-1 flex items-center justify-between cursor-pointer"
                        >
                          <span className="text-sm font-medium">
                            {subject.subject_name}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${getStreamColor()}`}
                          >
                            {subject.stream || "Common"}
                          </Badge>
                        </Label>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              {selectedSubjectIds.length} subject(s) selected
            </p>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSaveSubjects}>
                Save changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View All Subjects Dialog - Modern Shadcn Design */}
      <Dialog open={isViewSubjectsModalOpen} onOpenChange={setIsViewSubjectsModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Subjects in {selectedGradeForViewSubjects?.name}
            </DialogTitle>
            <DialogDescription>
              All subjects assigned to this grade, organized by stream.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {selectedGradeForViewSubjects && (
              <div className="space-y-6">
                {(() => {
                  const { natural, social, common } = getAssignedSubjectsByStream(
                    selectedGradeForViewSubjects.id!
                  );
                  
                  return (
                    <>
                      {/* Natural Stream */}
                      {natural.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <h3 className="text-sm font-semibold text-emerald-700">Natural Sciences</h3>
                            <Badge variant="secondary" className="text-xs">
                              {natural.length}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {natural.map((subject) => (
                              <div
                                key={subject.id}
                                className="flex items-center p-2 rounded-lg bg-emerald-50 border border-emerald-100"
                              >
                                <span className="text-sm text-emerald-700">{subject.subject_name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Social Stream */}
                      {social.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <h3 className="text-sm font-semibold text-blue-700">Social Sciences</h3>
                            <Badge variant="secondary" className="text-xs">
                              {social.length}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {social.map((subject) => (
                              <div
                                key={subject.id}
                                className="flex items-center p-2 rounded-lg bg-blue-50 border border-blue-100"
                              >
                                <span className="text-sm text-blue-700">{subject.subject_name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Common Stream */}
                      {common.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-gray-500" />
                            <h3 className="text-sm font-semibold text-gray-700">Common Subjects</h3>
                            <Badge variant="secondary" className="text-xs">
                              {common.length}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {common.map((subject) => (
                              <div
                                key={subject.id}
                                className="flex items-center p-2 rounded-lg bg-gray-50 border border-gray-100"
                              >
                                <span className="text-sm text-gray-700">{subject.subject_name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {natural.length === 0 && social.length === 0 && common.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No subjects assigned to this grade yet.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-end border-t pt-4">
            <DialogClose asChild>
              <Button type="button">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Sections Dialog - Modern Shadcn Design */}
      <Dialog open={isSectionModalOpen} onOpenChange={setIsSectionModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Manage sections for {selectedGradeForSections?.name}
            </DialogTitle>
            <DialogDescription>
              Add or remove sections for this grade. Sections help organize students
              within the same grade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Add Section Form */}
            <div className="space-y-2">
              <Label htmlFor="section">Add new section</Label>
              <div className="flex gap-2">
                <Input
                  id="section"
                  value={sectionInput}
                  onChange={(e) => setSectionInput(e.target.value)}
                  placeholder="Enter section name (e.g., A, B, C)"
                  className="flex-1"
                />
                <Button
                  onClick={handleAddSection}
                  disabled={!sectionInput.trim()}
                >
                  Add
                </Button>
              </div>
            </div>

            <Separator />

            {/* Existing Sections List */}
            <div className="space-y-2">
              <Label>Existing sections</Label>
              <ScrollArea className="h-48 rounded-md border">
                {assignedSections[selectedGradeForSections?.id!]?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No sections added yet.
                  </p>
                ) : (
                  <div className="divide-y">
                    {assignedSections[selectedGradeForSections?.id!]?.map(
                      (section) => (
                        <div
                          key={section.id}
                          className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                              <Users className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium">
                              Section {section.section_name}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSection(section.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}