"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
} from "lucide-react";
import { toast } from "sonner";
import { createBrowserClient } from "@supabase/ssr";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export default function GradesPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sections, setSections] = useState<GradeSection[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentGrade, setCurrentGrade] = useState<Grade>(emptyGrade);
  const [gradeToDelete, setGradeToDelete] = useState<Grade | null>(null);
  const [selectedGradeForSubjects, setSelectedGradeForSubjects] =
    useState<Grade | null>(null);
  const [selectedGradeForSections, setSelectedGradeForSections] =
    useState<Grade | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [sectionInput, setSectionInput] = useState("");
  const [assignedSubjects, setAssignedSubjects] = useState<
    Record<number, number[]>
  >({});
  const [assignedSections, setAssignedSections] = useState<
    Record<number, GradeSection[]>
  >({});

  useEffect(() => {
    fetchGrades();
    fetchSubjects();
    fetchSections();
    fetchAssignedSubjects();
  }, []);

  useEffect(() => {
    if (selectedGradeForSections) {
      fetchSectionsForGrade(selectedGradeForSections.id!);
    }
  }, [selectedGradeForSections]);

  const fetchGrades = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("grades")
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        console.error("Error fetching grades:", error);
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
      console.error("Unexpected error fetching grades:", error);
      toast.error("Unexpected error loading grades. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .order("subject_name", { ascending: true });

      if (error) {
        console.error("Error fetching subjects:", error);
        return;
      }

      setSubjects(data || []);
    } catch (error) {
      console.error("Unexpected error fetching subjects:", error);
    }
  };

  const fetchSections = async () => {
    try {
      const { data, error } = await supabase
        .from("grade_sections")
        .select("*")
        .order("section_name", { ascending: true });

      if (error) {
        console.error("Error fetching sections:", error);
        return;
      }

      setSections(data || []);
    } catch (error) {
      console.error("Unexpected error fetching sections:", error);
    }
  };

  const fetchSectionsForGrade = async (gradeId: number) => {
    try {
      const { data, error } = await supabase
        .from("grade_sections")
        .select("*")
        .eq("grade_id", gradeId)
        .order("section_name", { ascending: true });

      if (error) {
        console.error("Error fetching sections for grade:", error);
        return;
      }

      setAssignedSections((prev) => ({
        ...prev,
        [gradeId]: data || [],
      }));
    } catch (error) {
      console.error("Unexpected error fetching sections for grade:", error);
    }
  };

  const fetchAssignedSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from("grade_subjects")
        .select("grade_id, subject_id");

      if (error) {
        console.error("Error fetching assigned subjects:", error);
        return;
      }

      const grouped: Record<number, number[]> = {};
      data.forEach((assignment) => {
        if (!grouped[assignment.grade_id]) {
          grouped[assignment.grade_id] = [];
        }
        grouped[assignment.grade_id].push(assignment.subject_id);
      });

      setAssignedSubjects(grouped);
    } catch (error) {
      console.error("Unexpected error fetching assigned subjects:", error);
    }
  };

  const naturalSubjects = useMemo(() => {
    return subjects.filter((s) => s.stream === "Natural");
  }, [subjects]);

  const socialSubjects = useMemo(() => {
    return subjects.filter((s) => s.stream === "Social");
  }, [subjects]);

  const commonSubjects = useMemo(() => {
    return subjects.filter((s) => !s.stream || s.stream === "Common");
  }, [subjects]);

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
        console.error("Save error:", error);
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
      console.error("Unexpected save error:", err);
      toast.error("Unexpected error saving grade. Please try again.");
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
        console.error("Delete error:", deleteError);
        toast.error(`Failed to delete grade: ${deleteError.message}`);
      } else {
        toast.success("Grade deleted successfully");
        fetchGrades();
        fetchAssignedSubjects();
      }
    } catch (err) {
      console.error("Unexpected delete error:", err);
      toast.error("Unexpected error deleting grade. Please try again.");
    } finally {
      setIsDeleteDialogOpen(false);
      setGradeToDelete(null);
    }
  };

  const handleSaveSubjects = async () => {
    if (!selectedGradeForSubjects) return;

    try {
      // Delete existing assignments
      await supabase
        .from("grade_subjects")
        .delete()
        .eq("grade_id", selectedGradeForSubjects.id);

      // Insert new assignments if any
      if (selectedSubjectIds.length > 0) {
        const newAssignments = selectedSubjectIds.map((subjectId) => ({
          grade_id: selectedGradeForSubjects.id,
          subject_id: subjectId,
        }));

        const { error } = await supabase
          .from("grade_subjects")
          .insert(newAssignments);

        if (error) {
          console.error("Error assigning subjects:", error);
          toast.error(`Failed to assign subjects: ${error.message}`);
          return;
        }
      }

      toast.success("Subjects assigned successfully");
      fetchAssignedSubjects();
      setIsSubjectModalOpen(false);
      setSelectedGradeForSubjects(null);
    } catch (error) {
      console.error("Unexpected error saving subjects:", error);
      toast.error("Unexpected error assigning subjects. Please try again.");
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
        console.error("Error adding section:", error);
        toast.error(`Failed to add section: ${error.message}`);
        return;
      }

      toast.success("Section added successfully");
      setSectionInput("");
      fetchSectionsForGrade(selectedGradeForSections.id!);
      fetchSections();
    } catch (error) {
      console.error("Unexpected error adding section:", error);
      toast.error("Unexpected error adding section. Please try again.");
    }
  };

  const handleDeleteSection = async (sectionId: number) => {
    try {
      const { error } = await supabase
        .from("grade_sections")
        .delete()
        .eq("id", sectionId);

      if (error) {
        console.error("Error deleting section:", error);
        toast.error(`Failed to delete section: ${error.message}`);
        return;
      }

      toast.success("Section deleted successfully");
      if (selectedGradeForSections) {
        fetchSectionsForGrade(selectedGradeForSections.id!);
      }
      fetchSections();
    } catch (error) {
      console.error("Unexpected error deleting section:", error);
      toast.error("Unexpected error deleting section. Please try again.");
    }
  };

  const toggleSubject = (subjectId: number) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

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
                      <Skeleton
                        key={i}
                        className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"
                      />
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 truncate">
            Grades
          </h1>
          <p className="text-muted-foreground mt-1 truncate">
            Manage your grades and assign subjects and sections to them.
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2 w-full sm:w-auto">
          <PlusCircle className="h-4 w-4" />
          Create Grade
        </Button>
      </div>

      {grades.length === 0 ? (
        <Card className="text-center py-12">
          <BookMarked className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <CardTitle className="text-xl">No grades yet</CardTitle>
          <CardDescription>
            Create your first grade to get started.
          </CardDescription>
          <Button onClick={handleCreate} className="mt-4">
            Create First Grade
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {grades.map((grade) => {
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
                className="flex flex-col hover:shadow-lg transition-shadow duration-200"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1 pr-2">
                      <CardTitle className="text-xl text-gray-900 truncate">
                        {grade.name}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground truncate block w-[200px]">
                        {grade.description || "No description"}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 flex-shrink-0"
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            handleEdit(grade);
                          }}
                          className="cursor-pointer"
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          <span className="truncate">Update</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            handleOpenAssignSubjects(grade);
                          }}
                          className="cursor-pointer"
                        >
                          <BookMarked className="mr-2 h-4 w-4" />
                          <span className="truncate">Assign Subjects</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            handleOpenAssignSections(grade);
                          }}
                          className="cursor-pointer"
                        >
                          <Users className="mr-2 h-4 w-4" />
                          <span className="truncate">Manage Sections</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            handleDelete(grade);
                          }}
                          className="text-red-600 focus:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span className="truncate">Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow space-y-4 pt-0">
                  {/* Assigned Subjects Section */}
                  <div className="space-y-2">
                    {/* Header Section */}
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-gray-900 truncate min-w-0">
                        Assigned Subjects
                      </h4>
                      {allAssigned.length > 0 && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {allAssigned.length}
                        </Badge>
                      )}
                    </div>

                    {allAssigned.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic truncate">
                        No subjects assigned
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {/* Natural Science Subjects */}
                        {natural.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-green-700 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                              <span className="truncate">Natural Science</span>
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {natural.map((subject) => (
                                <Badge
                                  key={subject.id}
                                  variant="outline"
                                  className="text-xs bg-green-50 text-green-700 border-green-200 max-w-[120px]"
                                >
                                  <span className="truncate block w-full">
                                    {subject.subject_name}
                                  </span>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Social Science Subjects - Akka kan Natural Science oliitti sirreessi */}
                        {social.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-blue-700 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                              <span className="truncate">Social Science</span>
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {social.map((subject) => (
                                <Badge
                                  key={subject.id}
                                  variant="outline"
                                  className="text-xs bg-blue-50 text-blue-700 border-blue-200 max-w-[120px]"
                                >
                                  <span className="truncate block w-full">
                                    {subject.subject_name}
                                  </span>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Common Subjects */}
                        {common.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-700 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0" />
                              <span className="truncate">Common</span>
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {common.map((subject) => (
                                <Badge
                                  key={subject.id}
                                  variant="outline"
                                  className="text-xs bg-gray-50 text-gray-700 border-gray-200 max-w-[120px]"
                                >
                                  <span className="truncate block w-full">
                                    {subject.subject_name}
                                  </span>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Assigned Sections Section */}
                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">
                        Assigned Sections
                      </h4>
                      {gradeSections.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {gradeSections.length}
                        </Badge>
                      )}
                    </div>
                    {gradeSections.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic truncate">
                        No sections assigned
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {gradeSections.map((section) => (
                          <Badge
                            key={section.id}
                            variant="secondary"
                            className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 max-w-[100px] truncate"
                          >
                            {section.section_name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Grade Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl truncate">
              {currentGrade.id ? "Update Grade" : "Create Grade"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground truncate">
              {currentGrade.id
                ? "Update the details of the grade."
                : "Add a new grade to the system."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label
                htmlFor="name"
                className="text-sm font-medium text-gray-700 truncate"
              >
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
              <Label
                htmlFor="description"
                className="text-sm font-medium text-gray-700 truncate"
              >
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
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <DialogClose asChild disabled={isSaving}>
              <Button
                type="button"
                variant="outline"
                className="border-gray-300 hover:bg-gray-100 bg-transparent w-full sm:w-auto"
                disabled={isSaving}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !currentGrade.name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto"
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
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="truncate">
              This action cannot be undone. This will permanently delete the{" "}
              <span className="font-bold">{gradeToDelete?.name}</span> grade and
              any associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
            >
              Delete Grade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Subjects Dialog */}
      <Dialog open={isSubjectModalOpen} onOpenChange={setIsSubjectModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="truncate">
              Assign Subjects to {selectedGradeForSubjects?.name}
            </DialogTitle>
            <DialogDescription className="truncate">
              Select the subjects you want to assign to this grade. All subjects
              are shown in a single list.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="all" className="text-xs truncate">
                All Subjects ({allSubjects.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <ScrollArea className="h-[300px] pr-4 border rounded-md p-3">
                <div className="space-y-3">
                  {allSubjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 truncate">
                      No subjects available.
                    </p>
                  ) : (
                    allSubjects.map((subject) => {
                      // Get stream badge color
                      const getStreamColor = () => {
                        if (subject.stream === "Natural")
                          return "bg-green-100 text-green-800 border-green-200";
                        if (subject.stream === "Social")
                          return "bg-blue-100 text-blue-800 border-blue-200";
                        return "bg-gray-100 text-gray-800 border-gray-200";
                      };

                      return (
                        <label
                          key={subject.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedSubjectIds.includes(subject.id)}
                            onCheckedChange={() => toggleSubject(subject.id)}
                          />
                          <div className="flex-1 flex items-center justify-between min-w-0">
                            <span className="text-sm text-gray-700 truncate">
                              {subject.subject_name}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getStreamColor()} flex-shrink-0 truncate`}
                            >
                              {subject.stream || "Common"}
                            </Badge>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t gap-3">
            <p className="text-sm text-muted-foreground truncate">
              {selectedSubjectIds.length} subject(s) selected
            </p>
            <div className="flex gap-2 w-full sm:w-auto">
              <DialogClose asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={handleSaveSubjects}
                className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto"
              >
                Save Subjects
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Sections Dialog */}
      <Dialog open={isSectionModalOpen} onOpenChange={setIsSectionModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="truncate">
              Manage Sections for {selectedGradeForSections?.name}
            </DialogTitle>
            <DialogDescription className="truncate">
              Add or remove sections for this grade. Sections help organize
              students within the same grade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Add Section Form */}
            <div className="space-y-2">
              <Label
                htmlFor="section"
                className="text-sm font-medium text-gray-700 truncate"
              >
                Add New Section
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
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
                  className="w-full sm:w-auto"
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Existing Sections List */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 truncate">
                Existing Sections
              </Label>
              <ScrollArea className="h-48 border rounded-md">
                {assignedSections[selectedGradeForSections?.id!]?.length ===
                0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 truncate">
                    No sections added yet.
                  </p>
                ) : (
                  <div className="divide-y">
                    {assignedSections[selectedGradeForSections?.id!]?.map(
                      (section) => (
                        <div
                          key={section.id}
                          className="flex items-center justify-between p-3 hover:bg-gray-50 min-w-0"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                              <Users className="h-4 w-4 text-indigo-600" />
                            </div>
                            <span className="font-medium truncate">
                              {section.section_name}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSection(section.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
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

          <DialogFooter>
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
