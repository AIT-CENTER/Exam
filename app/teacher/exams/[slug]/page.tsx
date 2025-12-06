"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle, Plus, Edit, Trash, Eye, Menu, ImageIcon, ChevronLeft, ChevronRight, Upload, XIcon, Loader2, Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { toast, Toaster } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { getTeacherDataFromCookie } from "@/utils/teacherCookie";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import UnderlineExtension from '@tiptap/extension-underline';

const renderWithMath = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
  return parts.map((part, index) => {
    if (part.startsWith("$$") && part.endsWith("$$")) {
      return <BlockMath key={index} math={part.slice(2, -2)} />;
    } else if (part.startsWith("$") && part.endsWith("$")) {
      return <InlineMath key={index} math={part.slice(1, -1)} />;
    } else {
      return <span key={index}>{part}</span>;
    }
  });
};

const generateExamId = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Rich Text Editor Toolbar Component
const EditorToolbar = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
      <Button
        type="button"
        variant={editor.isActive('bold') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className="h-8 w-8 p-0"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive('italic') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className="h-8 w-8 p-0"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive('underline') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className="h-8 w-8 p-0"
      >
        <Underline className="h-4 w-4" />
      </Button>
      <div className="w-px h-6 bg-border mx-1 self-center" />
      <Button
        type="button"
        variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className="h-8 w-8 p-0"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className="h-8 w-8 p-0"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <div className="w-px h-6 bg-border mx-1 self-center" />
      <Button
        type="button"
        variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className="h-8 w-8 p-0"
      >
        <AlignLeft className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className="h-8 w-8 p-0"
      >
        <AlignCenter className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className="h-8 w-8 p-0"
      >
        <AlignRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Image Upload Modal with real Supabase upload
const ImageUploadModal = ({ isOpen, onClose, onUpload, title }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onUpload: (url: string) => void; 
  title: string;
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.type.startsWith("image/")) {
        uploadFile(selectedFile);
      } else {
        toast.error("Please drop an image file.");
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith("image/")) {
      uploadFile(selectedFile);
    } else {
      toast.error("Please select an image file.");
    }
  };

  const uploadFile = async (selectedFile: File) => {
    setUploading(true);
    try {
      const fileName = `exam-images/${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
      
      // Try to upload directly
      const { data, error } = await supabase.storage
        .from("images")
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        if (error.message.includes('not found') || error.message.includes('row-level security')) {
          toast.error(
            <div className="text-left">
              <p className="font-semibold mb-2">Storage Setup Required:</p>
              <p className="mb-3">Please create 'images' bucket in Supabase Dashboard:</p>
              <ol className="list-decimal ml-4 space-y-1 text-sm">
                <li>Go to Supabase Dashboard</li>
                <li>Select your project</li>
                <li>Click <strong>Storage</strong> in left sidebar</li>
                <li>Click <strong>Create a new bucket</strong></li>
                <li>Name: <code className="bg-gray-100 px-1 rounded">images</code></li>
                <li>Set to <strong>Public</strong></li>
                <li>Click <strong>Create bucket</strong></li>
              </ol>
              <p className="mt-3 text-sm">Or use URL upload option below.</p>
            </div>,
            { duration: 10000 }
          );
          return;
        }
        toast.error("Failed to upload image: " + error.message);
        return;
      }

      // Get public URL
      const { data: publicData } = supabase.storage
        .from("images")
        .getPublicUrl(fileName);

      const imageUrl = publicData.publicUrl;
      
      onUpload(imageUrl);
      toast.success("Image uploaded successfully!");
      onClose();
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleUrlUpload = () => {
    if (url.trim()) {
      onUpload(url);
      setUrl("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Drag & drop an image here
                </p>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  Or choose from computer
                </Button>
              </>
            )}
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Paste image URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button onClick={handleUrlUpload} disabled={!url.trim()}>
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface Question {
  id: number;
  question: string;
  passage: string;
  passageHtml: string;
  questionImage: string | null;
  type: string;
  points: number;
  options: Array<{ text: string; image: string | null }>;
  correctAnswer: number;
}

interface TeacherData {
  teacherId: string;
  fullName: string;
  gradeId?: string;
  subjectId?: string;
  sections?: string[];
  gradeName?: string;
  subjectName?: string;
}

export default function CreateExamPage() {
  const router = useRouter();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [examId] = useState(generateExamId());
  const [examTitle, setExamTitle] = useState("");
  const [examGrade, setExamGrade] = useState("");
  const [examSubject, setExamSubject] = useState("");
  const [examInstructions, setExamInstructions] = useState("");
  const [examTime, setExamTime] = useState(60);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState({
    question: "",
    passage: "",
    passageHtml: "",
    questionImage: null as string | null,
    type: "mcq",
    points: 1,
    options: [{ text: "", image: null }, { text: "", image: null }, { text: "", image: null }, { text: "", image: null }] as Array<{ text: string; image: string | null }>,
    correctAnswer: 0,
  });
  const [editingIndex, setEditingIndex] = useState(-1);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [fullscreenRequired, setFullscreenRequired] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUploadType, setImageUploadType] = useState<string | null>(null);
  const [imageHover, setImageHover] = useState<string | null>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [teacherData, setTeacherData] = useState<TeacherData | null>(null);
  const [teacherGradeName, setTeacherGradeName] = useState("");
  const [teacherSubjectName, setTeacherSubjectName] = useState("");
  const [showResults, setShowResults] = useState(true);

  // TipTap editor for passage with rich text support - FIXED SSR ISSUE
  const passageEditor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: newQuestion.passageHtml || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      setNewQuestion(prev => ({
        ...prev,
        passageHtml: html,
        passage: text
      }));
    },
    // FIX: Add this line to fix SSR hydration error
    immediatelyRender: false,
  });

  // Update editor content when editing a question
  useEffect(() => {
    if (passageEditor && newQuestion.passageHtml !== passageEditor.getHTML()) {
      passageEditor.commands.setContent(newQuestion.passageHtml || '');
    }
  }, [editingIndex, passageEditor, newQuestion.passageHtml]);

  const questionTypes = [
    { value: "mcq", label: "Multiple Choice" },
    { value: "passage", label: "Passage-based Multiple Choice" },
    { value: "tf", label: "True/False" },
  ];

  useEffect(() => {
    const fetchTeacherData = async () => {
      setLoading(true);
      try {
        const teacher = await getTeacherDataFromCookie();
        
        if (!teacher || !teacher.teacherId) {
          toast.error("Please login as teacher");
          router.push("/teacher/login");
          return;
        }

        setTeacherData(teacher);

        if (teacher.gradeId) {
          setExamGrade(teacher.gradeId.toString());
          setTeacherGradeName(teacher.gradeName || "Not assigned");
        }

        if (teacher.subjectId) {
          setExamSubject(teacher.subjectId.toString());
          setTeacherSubjectName(teacher.subjectName || "Not assigned");
        }

        const { data: gradesData } = await supabase
          .from("grades")
          .select("id, grade_name");

        const { data: subjectsData } = await supabase
          .from("subjects")
          .select("id, subject_name");

        setGrades(gradesData || []);
        setSubjects(subjectsData || []);

      } catch (error) {
        console.error("Error fetching teacher data:", error);
        toast.error("Failed to load teacher data. Please login again.");
        router.push("/teacher/login");
      } finally {
        setLoading(false);
      }
    };

    fetchTeacherData();
  }, [router]);

  useEffect(() => {
    let updatedOptions: Array<{ text: string; image: string | null }> = [];
    let updatedCorrect = newQuestion.correctAnswer;

    switch (newQuestion.type) {
      case "tf":
        updatedOptions = [
          { text: "True", image: null },
          { text: "False", image: null },
        ];
        updatedCorrect = updatedCorrect > 1 ? 0 : updatedCorrect;
        break;
      case "mcq":
      case "passage":
        updatedOptions = newQuestion.options.length < 4 
          ? Array(4).fill(null).map(() => ({ text: "", image: null })) 
          : newQuestion.options;
        break;
      default:
        updatedOptions = newQuestion.options;
        break;
    }

    setNewQuestion(prev => ({
      ...prev,
      options: updatedOptions,
      correctAnswer: updatedCorrect,
    }));
  }, [newQuestion.type]);

  const handleQuestionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewQuestion({ ...newQuestion, question: e.target.value });
  };

  const openImageModal = (type: string) => {
    setImageUploadType(type);
    setShowImageModal(true);
  };

  const handleImageUpload = (imageUrl: string) => {
    if (imageUploadType === "question") {
      setNewQuestion({ ...newQuestion, questionImage: imageUrl });
    } else if (imageUploadType && imageUploadType.startsWith("option-")) {
      const idx = parseInt(imageUploadType.split("-")[1]);
      const newOptions = [...newQuestion.options];
      newOptions[idx].image = imageUrl;
      setNewQuestion({ ...newQuestion, options: newOptions });
    }
  };

  const clearImage = (type: string) => {
    if (type === "question") {
      setNewQuestion({ ...newQuestion, questionImage: null });
    } else if (type && type.startsWith("option-")) {
      const idx = parseInt(type.split("-")[1]);
      const newOptions = [...newQuestion.options];
      newOptions[idx].image = null;
      setNewQuestion({ ...newQuestion, options: newOptions });
    }
    setImageHover(null);
    toast.success("Image removed!");
  };

  const handleOptionChange = (index: number, value: string) => {
    if (newQuestion.type === "tf") return;
    const newOptions = [...newQuestion.options];
    newOptions[index].text = value;
    setNewQuestion({ ...newQuestion, options: newOptions });
  };

  const addOption = () => {
    if (newQuestion.type === "tf") return;
    setNewQuestion({ ...newQuestion, options: [...newQuestion.options, { text: "", image: null }] });
  };

  const removeOption = (index: number) => {
    if (newQuestion.type === "tf" || newQuestion.options.length <= 2) return;
    const newOptions = newQuestion.options.filter((_, i) => i !== index);
    setNewQuestion({ 
      ...newQuestion, 
      options: newOptions,
      correctAnswer: newQuestion.correctAnswer >= newOptions.length ? 0 : newQuestion.correctAnswer
    });
  };

  const isAddQuestionValid = () => {
    if (newQuestion.type === "passage" && newQuestion.passage.trim() === "") {
      return false;
    }
    return newQuestion.question.trim() !== "" && 
           newQuestion.options.every(opt => opt.text.trim() !== "") && 
           newQuestion.options.length >= 2 &&
           newQuestion.correctAnswer >= 0;
  };

  const addOrUpdateQuestion = () => {
    if (!isAddQuestionValid()) return;
    if (editingIndex === -1) {
      const newQ: Question = { ...newQuestion, id: Date.now() };
      setQuestions([...questions, newQ]);
      toast.success("Question added successfully!");
    } else {
      const updated = [...questions];
      updated[editingIndex] = { ...newQuestion, id: updated[editingIndex].id };
      setQuestions(updated);
      setEditingIndex(-1);
      toast.success("Question updated successfully!");
    }
    resetNewQuestion();
  };

  const resetNewQuestion = () => {
    setNewQuestion({
      question: "",
      passage: "",
      passageHtml: "",
      questionImage: null,
      type: "mcq",
      points: 1,
      options: [{ text: "", image: null }, { text: "", image: null }, { text: "", image: null }, { text: "", image: null }],
      correctAnswer: 0,
    });
    passageEditor?.commands.setContent('');
  };

  const editQuestion = (index: number) => {
    const q = questions[index];
    setNewQuestion({ ...q });
    passageEditor?.commands.setContent(q.passageHtml || '');
    setEditingIndex(index);
    setIsSidebarOpen(false);
    toast.info("Editing question...");
  };

  const deleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
    toast.error("Question deleted!");
  };

  const isStep1Valid = () => {
    return examTitle.trim() !== "" && examGrade !== "" && examSubject !== "" && examTime > 0;
  };

  const isStep2Valid = () => {
    return questions.length > 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && isStep1Valid()) {
      setCurrentStep(2);
      toast.success("Information saved! Moving to questions.");
    } else if (currentStep === 2 && isStep2Valid()) {
      setCurrentStep(3);
      toast.success("Questions saved! Moving to settings.");
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!teacherData) {
      toast.error("Teacher data not loaded. Please refresh the page.");
      return;
    }

    if (questions.length === 0) {
      toast.error("Please add at least one question.");
      return;
    }

    setLoading(true);

    try {
      const total_marks = questions.reduce((sum, q) => sum + q.points, 0);

      const examData = {
        exam_code: examId,
        title: examTitle,
        description: examInstructions,
        subject_id: parseInt(examSubject),
        grade_id: parseInt(examGrade),
        section: teacherData.sections && teacherData.sections.length > 0 ? teacherData.sections[0] : '',
        exam_date: new Date().toISOString().split("T")[0],
        duration: examTime,
        total_marks,
        fullscreen_required: fullscreenRequired,
        questions_shuffled: shuffleQuestions,
        options_shuffled: shuffleOptions,
        show_results: showResults,
        created_by: teacherData.teacherId,
        image_url: null,
        exam_active: true,
      };

      const { data: exam, error: examError } = await supabase
        .from("exams")
        .insert(examData)
        .select()
        .single();

      if (examError) {
        toast.error("Failed to create exam: " + examError.message);
        return;
      }

      // Insert questions
      for (const q of questions) {
        let question_type;
        if (q.type === "mcq" || q.type === "passage") {
          question_type = "multiple_choice";
        } else if (q.type === "tf") {
          question_type = "true_false";
        }

        // Store passage HTML for proper rendering
        let question_text = q.question;
        if (q.type === "passage" && q.passageHtml) {
          question_text = `[PASSAGE_HTML]${q.passageHtml}[/PASSAGE_HTML]\n\n${q.question}`;
        } else if (q.passage) {
          question_text = q.passage + "\n\n" + q.question;
        }

        let options = null;
        if (question_type === "multiple_choice" || question_type === "true_false") {
          options = {
            options: q.options.map(opt => opt.text),
            correct_option_id: q.correctAnswer,
            option_images: q.options.map(opt => opt.image)
          };
        }

        const { error: questionError } = await supabase.from("questions").insert({
          exam_id: exam.id,
          question_text,
          question_type,
          marks: q.points,
          options: options ? JSON.stringify(options) : null,
          correct_option_id: q.correctAnswer,
          image_url: q.questionImage || null,
        });

        if (questionError) {
          console.error("Error inserting question:", questionError);
          toast.error("Failed to add some questions. Please check the data.");
        }
      }

      toast.success("Exam created successfully!");
      router.push("/teacher/exams");

    } catch (error) {
      console.error("Error creating exam:", error);
      toast.error("Failed to create exam. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex justify-between items-center mb-6">
      <div className={`flex items-center ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>1</div>
        <span className="ml-2 hidden sm:inline">Information</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <div className={`flex items-center ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>2</div>
        <span className="ml-2 hidden sm:inline">Questions</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <div className={`flex items-center ${currentStep >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>3</div>
        <span className="ml-2 hidden sm:inline">Settings</span>
      </div>
    </div>
  );

  const QuestionBankCard = ({ q, idx, onEdit, onDelete }: { 
    q: Question; 
    idx: number; 
    onEdit: (index: number) => void; 
    onDelete: (index: number) => void;
  }) => {
    const [hovered, setHovered] = useState(false);

    return (
      <Card
        className="w-full h-14 flex flex-row items-center justify-between px-3 hover:bg-muted/50 transition cursor-pointer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-xs text-muted-foreground shrink-0">{idx + 1}.</span>
          <p className="text-xs font-medium truncate">
            {q.type === "passage" && <span className="text-primary">[Passage] </span>}
            {q.question}
          </p>
        </div>
        <div
          className={`flex items-center gap-1 shrink-0 ml-4 transition-opacity duration-200 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onEdit(idx); }}
            className="h-6 w-6 p-0"
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onDelete(idx); }}
            className="h-6 w-6 p-0 text-destructive"
          >
            <Trash className="h-3 w-3" />
          </Button>
        </div>
      </Card>
    );
  };

  const ImagePreview = ({ src, onDelete, type, className = "" }: { 
    src: string; 
    onDelete: (type: string) => void; 
    type: string; 
    className?: string;
  }) => (
    <div 
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setImageHover(type)}
      onMouseLeave={() => setImageHover(null)}
    >
      <img 
        src={src || "/placeholder.svg"} 
        alt="Preview" 
        className="max-w-full h-20 w-auto object-cover rounded border" 
      />
      {imageHover === type && (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(type)}
          className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full"
        >
          <XIcon className="h-3 w-3" />
        </Button>
      )}
    </div>
  );

  if (loading && currentStep === 1) {
    return (
      <div className="flex flex-col w-full items-center p-4 bg-background min-h-screen">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading teacher data and subjects...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <ImageUploadModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onUpload={handleImageUpload}
        title={imageUploadType === "question" ? "Upload Question Image" : `Upload Option Image`}
      />
      <div className="flex flex-col w-full items-center p-4 bg-background min-h-screen">
        {currentStep === 2 && (
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="outline" 
                className="fixed top-4 left-4 z-50" 
                size="sm"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <SheetHeader className="px-4 py-4 border-b">
                <SheetTitle>Question Bank ({questions.length})</SheetTitle>
              </SheetHeader>
              <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-100px)]">
                {questions.map((q, idx) => (
                  <QuestionBankCard
                    key={q.id}
                    q={q}
                    idx={idx}
                    onEdit={editQuestion}
                    onDelete={deleteQuestion}
                  />
                ))}
              </div>
            </SheetContent>
          </Sheet>
        )}

        <Card className="w-full max-w-4xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold mb-2">
              Create New Exam
            </CardTitle>
            <p className="text-muted-foreground text-base mb-2">
              Complete each step to create your exam
            </p>
            {teacherData && (
              <p className="text-sm text-green-600">
                Teacher: {teacherData.fullName}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <StepIndicator />

            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="id">Exam ID (Auto-generated)</Label>
                  <Input 
                    id="id" 
                    value={examId} 
                    disabled
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="title">Exam Title</Label>
                  <Input 
                    id="title" 
                    value={examTitle} 
                    onChange={(e) => setExamTitle(e.target.value)} 
                    className="mt-1"
                    placeholder="Enter exam title"
                  />
                </div>
                <div>
                  <Label htmlFor="grade">Grade</Label>
                  <div className="mt-1 p-3 border rounded-md bg-muted/50">
                    <p className="font-medium">{teacherGradeName || "Loading..."}</p>
                    <p className="text-xs text-muted-foreground mt-1">Auto-selected based on your assignment</p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <div className="mt-1 p-3 border rounded-md bg-muted/50">
                    <p className="font-medium">{teacherSubjectName || "Loading..."}</p>
                    <p className="text-xs text-muted-foreground mt-1">Auto-selected based on your assignment</p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="instructions">Exam Instructions</Label>
                  {/* Scrollable textarea */}
                  <textarea 
                    id="instructions" 
                    value={examInstructions} 
                    onChange={(e) => setExamInstructions(e.target.value)} 
                    className="mt-1 w-full min-h-[100px] max-h-[200px] overflow-y-auto p-3 border rounded-md resize-none bg-background"
                    placeholder="Enter exam instructions for students..."
                  />
                </div>
                <div>
                  <Label htmlFor="time">Time Limit (minutes)</Label>
                  <Input 
                    id="time" 
                    type="number" 
                    value={examTime} 
                    onChange={(e) => setExamTime(parseInt(e.target.value) || 0)} 
                    className="mt-1"
                    min="1"
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-xl flex items-center gap-2">
                    Add Question
                  </h3>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Live Preview</Label>
                    <Switch checked={showPreview} onCheckedChange={setShowPreview} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="question-type">Question Type</Label>
                  <Select 
                    value={newQuestion.type} 
                    onValueChange={(value) => {
                      setNewQuestion({ 
                        ...newQuestion, 
                        type: value 
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {questionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="points">Points</Label>
                  <Input 
                    id="points" 
                    type="number" 
                    value={newQuestion.points} 
                    onChange={(e) => setNewQuestion({ ...newQuestion, points: parseInt(e.target.value) || 1 })} 
                    className="mt-1"
                    min="1"
                  />
                </div>
                
                {/* Rich text editor for passage */}
                {newQuestion.type === "passage" && (
                  <div>
                    <Label>Passage/Paragraph (Rich Text)</Label>
                    <div className="mt-1 border rounded-md overflow-hidden">
                      <EditorToolbar editor={passageEditor} />
                      <EditorContent 
                        editor={passageEditor} 
                        className="prose prose-sm max-w-none p-4 min-h-[150px] max-h-[300px] overflow-y-auto focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[120px]"
                      />
                    </div>
                    {showPreview && newQuestion.passageHtml && (
                      <div className="mt-2 p-3 bg-muted/50 rounded-md border">
                        <p className="text-sm font-medium mb-2">Passage Preview:</p>
                        <div 
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: newQuestion.passageHtml }}
                        />
                      </div>
                    )}
                  </div>
                )}
                
                <div>
                  <Label htmlFor="question">Question Text (Supports KaTeX: $inline$ or $$block$$)</Label>
                  {/* Scrollable textarea for question */}
                  <textarea 
                    id="question" 
                    value={newQuestion.question} 
                    onChange={handleQuestionChange} 
                    className="mt-1 w-full min-h-[100px] max-h-[200px] overflow-y-auto p-3 border rounded-md resize-none bg-background"
                    placeholder="Enter your question here. Use $...$ for inline math and $$...$$ for block math."
                  />
                  {showPreview && newQuestion.question && (
                    <div className="mt-2 p-3 bg-muted/50 rounded-md border">
                      <p className="text-sm font-medium mb-1">Preview:</p>
                      <div className="whitespace-pre-wrap">{renderWithMath(newQuestion.question)}</div>
                    </div>
                  )}
                </div>
                <div>
                  <Label>Upload Question Image</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openImageModal("question")}
                    className="mt-1"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" /> Upload Image
                  </Button>
                  {newQuestion.questionImage && (
                    <ImagePreview 
                      src={newQuestion.questionImage || "/placeholder.svg"} 
                      onDelete={clearImage} 
                      type="question"
                      className="mt-2"
                    />
                  )}
                </div>
                {newQuestion.type !== "short" && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label>Options</Label>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={addOption} 
                        disabled={newQuestion.type === "tf"}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Option
                      </Button>
                    </div>
                    {newQuestion.options.map((opt, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="min-w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold flex-shrink-0">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <div className="relative flex-1">
                            <Input 
                              placeholder={`Enter option ${String.fromCharCode(65 + idx)}`} 
                              value={opt.text} 
                              onChange={(e) => handleOptionChange(idx, e.target.value)} 
                              disabled={newQuestion.type === "tf"}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openImageModal(`option-${idx}`)}
                              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                            >
                              <ImageIcon className="h-4 w-4" />
                            </Button>
                          </div>
                          {newQuestion.options.length > 2 && newQuestion.type !== "tf" && (
                            <Button variant="ghost" size="sm" onClick={() => removeOption(idx)} className="text-destructive flex-shrink-0">
                              <Trash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {opt.image && (
                          <div className="ml-10">
                            <ImagePreview 
                              src={opt.image || "/placeholder.svg"} 
                              onDelete={clearImage} 
                              type={`option-${idx}`}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {newQuestion.type !== "short" && (
                  <div>
                    <Label>Correct Answer</Label>
                    <RadioGroup 
                      value={newQuestion.correctAnswer.toString()} 
                      onValueChange={(val) => setNewQuestion({ ...newQuestion, correctAnswer: parseInt(val) })} 
                      className="flex flex-wrap gap-4 mt-2"
                    >
                      {newQuestion.options.map((_, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <RadioGroupItem value={idx.toString()} id={`correct-${idx}`} className="sr-only" />
                          <Label 
                            htmlFor={`correct-${idx}`} 
                            className={`cursor-pointer px-4 py-2 rounded-full border-2 transition-all ${
                              newQuestion.correctAnswer === idx 
                                ? "border-primary bg-primary/10 text-primary" 
                                : "border-muted bg-transparent hover:border-primary/50"
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}
                <Button 
                  onClick={addOrUpdateQuestion} 
                  disabled={!isAddQuestionValid()}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4 mr-2" /> 
                  {editingIndex === -1 ? "Add Question" : "Update Question"}
                </Button>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Shuffle Questions</Label>
                    <p className="text-sm text-muted-foreground">Randomize the order of questions for each student</p>
                  </div>
                  <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Shuffle Options</Label>
                    <p className="text-sm text-muted-foreground">Randomize the order of options for each question</p>
                  </div>
                  <Switch checked={shuffleOptions} onCheckedChange={setShuffleOptions} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Require Fullscreen</Label>
                    <p className="text-sm text-muted-foreground">Students must take the exam in fullscreen mode</p>
                  </div>
                  <Switch checked={fullscreenRequired} onCheckedChange={setFullscreenRequired} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Show Results</Label>
                    <p className="text-sm text-muted-foreground">Show results to students after submitting exam</p>
                  </div>
                  <Switch checked={showResults} onCheckedChange={setShowResults} />
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Exam Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Total Questions:</span> {questions.length}
                    </div>
                    <div>
                      <span className="font-medium">Total Points:</span> {questions.reduce((sum, q) => sum + q.points, 0)}
                    </div>
                    <div>
                      <span className="font-medium">Time Limit:</span> {examTime} minutes
                    </div>
                    <div>
                      <span className="font-medium">Exam ID:</span> {examId}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4">
              {currentStep > 1 && (
                <Button 
                  variant="outline" 
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
              )}
              {currentStep < 3 ? (
                <Button 
                  onClick={handleNext} 
                  className="ml-auto"
                  disabled={currentStep === 1 ? !isStep1Valid() : !isStep2Valid()}
                >
                  <ChevronRight className="h-4 w-4 mr-2" /> Next
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit} 
                  disabled={loading}
                  className="ml-auto"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {loading ? "Creating..." : "Create Exam"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}