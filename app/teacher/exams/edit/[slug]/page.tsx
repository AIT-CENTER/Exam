"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from 'next/navigation';
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

// Helper function to parse question text from database
const parseQuestionText = (questionText: string) => {
  if (!questionText) return { passage: "", passageHtml: "", question: questionText };
  
  // Check for PASSAGE_HTML format
  if (questionText.includes('[PASSAGE_HTML]')) {
    const passageMatch = questionText.match(/\[PASSAGE_HTML\](.*?)\[\/PASSAGE_HTML\]/s);
    if (passageMatch) {
      const passageHtml = passageMatch[1].trim();
      const remainingText = questionText.replace(/\[PASSAGE_HTML\].*?\[\/PASSAGE_HTML\]\s*/s, '').trim();
      return { 
        passage: passageHtml.replace(/<[^>]*>/g, ''), // Extract text from HTML
        passageHtml: passageHtml,
        question: remainingText
      };
    }
  }
  
  // Fallback: Check for newline separation
  const lines = questionText.split('\n\n');
  if (lines.length > 1 && (lines[0].length > 100 || lines[0].includes('\n'))) {
    return {
      passage: lines[0],
      passageHtml: lines[0].replace(/\n/g, '<br>'), // Convert newlines to HTML
      question: lines.slice(1).join('\n\n').trim()
    };
  }
  
  return { passage: "", passageHtml: "", question: questionText };
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
  const bucketName = process.env.NEXT_PUBLIC_SUPABASE_IMAGE_BUCKET || "exam_images";

  const showBucketCreationToast = useCallback(() => {
    toast.error(
      <div className="space-y-3 max-w-md">
        <p className="font-bold text-red-700">📁 Storage Bucket Missing</p>
        <p className="text-sm">The required storage bucket <code className="bg-gray-200 px-2 py-1 rounded font-mono">{bucketName}</code> does not exist.</p>
        <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
          <p className="font-medium text-sm mb-2">🔧 How to fix:</p>
          <ol className="list-decimal ml-4 text-sm space-y-1">
            <li>Login to <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">Supabase Dashboard</a></li>
            <li>Select your project</li>
            <li>Click <strong>Storage</strong> in left menu</li>
            <li>Click <strong>Create New Bucket</strong> button</li>
            <li>Bucket Name: <code className="bg-gray-100 px-1 font-mono">{bucketName}</code></li>
            <li>Set to <strong>Public</strong> access</li>
            <li>Click <strong>Create Bucket</strong></li>
            <li>Refresh this page after creation</li>
          </ol>
          <p className="text-xs mt-3 text-gray-600">💡 Bucket name can be changed in .env.local as NEXT_PUBLIC_SUPABASE_IMAGE_BUCKET</p>
        </div>
      </div>,
      { 
        duration: 20000,
        dismissible: true
      }
    );
  }, [bucketName]);

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
        toast.error("❌ Please drop an image file (PNG, JPG, GIF, etc.)");
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith("image/")) {
      uploadFile(selectedFile);
    } else {
      toast.error("❌ Please select an image file");
    }
  };

  const checkBucketExists = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.storage.from(bucketName).list();
      
      if (error) {
        if (error.message?.includes('not found') || error.statusCode === '404' || error.code === '404') {
          return false;
        }
        console.error("Bucket check error:", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Bucket check exception:", err);
      return false;
    }
  };

  const uploadFile = async (selectedFile: File) => {
    setUploading(true);
    try {
      const bucketExists = await checkBucketExists();
      if (!bucketExists) {
        showBucketCreationToast();
        return;
      }

      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `exam-images/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error("Upload error:", error);
        
        if (error.message?.includes('row-level security') || error.message?.includes('policy')) {
          toast.error(
            <div className="text-left max-w-md">
              <p className="font-semibold mb-2">🔐 Storage Policy Issue</p>
              <p className="mb-3">Bucket exists but upload permissions are missing.</p>
              <div className="text-sm space-y-2">
                <p><strong>To fix in Supabase Dashboard:</strong></p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Go to <strong>Storage</strong> → <strong>Policies</strong></li>
                  <li>Click <strong>Create Policy</strong> for {bucketName}</li>
                  <li>Select <strong>Enable INSERT for all users</strong></li>
                  <li>Save policy and try again</li>
                </ol>
              </div>
            </div>,
            { duration: 15000 }
          );
        } else if (error.message?.includes('File size exceeds')) {
          toast.error("❌ File size exceeds limit (max 5MB)");
        } else {
          toast.error(`Upload failed: ${error.message || 'Unknown error'}`);
        }
        return;
      }

      const { data: publicData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      const imageUrl = publicData.publicUrl;
      
      onUpload(imageUrl);
      toast.success("✅ Image uploaded successfully!");
      onClose();
    } catch (err) {
      console.error("Upload exception:", err);
      toast.error("❌ Failed to upload image. Please try again or use URL upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleUrlUpload = () => {
    if (url.trim()) {
      try {
        new URL(url);
        onUpload(url);
        setUrl("");
        onClose();
        toast.success("✅ Image URL added!");
      } catch {
        toast.error("❌ Please enter a valid URL");
      }
    } else {
      toast.error("❌ Please enter an image URL");
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            {title}
          </DialogTitle>
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
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Uploading...</p>
                  <p className="text-xs text-muted-foreground">Please wait</p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag & drop an image here
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Supports: JPG, PNG, GIF, WebP (Max 5MB)
                </p>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Choose from computer
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
              <span className="bg-background px-3 text-muted-foreground font-medium">Or</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="image-url">Enter image URL</Label>
            <div className="flex gap-2">
              <Input
                id="image-url"
                placeholder="https://example.com/image.jpg"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleUrlUpload} 
                disabled={!url.trim()}
                className="gap-2"
              >
                <ImageIcon className="h-4 w-4" />
                Add URL
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter a direct image URL (must end with .jpg, .png, .gif, etc.)
            </p>
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
  createdOrder: number; // NEW: Track creation order
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

export default function EditExamPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.slug as string;
  
  const [currentStep, setCurrentStep] = useState(1);
  const [examTitle, setExamTitle] = useState("");
  const [examCode, setExamCode] = useState("");
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
  const [showResults, setShowResults] = useState(true);
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
  const [savingExam, setSavingExam] = useState(false);
  const [optionPreview, setOptionPreview] = useState<string[]>([]);
  const [examDate, setExamDate] = useState("");
  const [questionCounter, setQuestionCounter] = useState(1); // Track question order

  // TipTap editor for passage with rich text support
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
    immediatelyRender: false,
  });

  // Update editor content when editing a question
  useEffect(() => {
    if (passageEditor && newQuestion.passageHtml !== passageEditor.getHTML()) {
      passageEditor.commands.setContent(newQuestion.passageHtml || '');
    }
  }, [editingIndex, passageEditor, newQuestion.passageHtml]);

  // Update option preview when options change
  useEffect(() => {
    const previews = newQuestion.options.map(opt => opt.text);
    setOptionPreview(previews);
  }, [newQuestion.options]);

  const questionTypes = [
    { value: "mcq", label: "Multiple Choice" },
    { value: "passage", label: "Passage-based Multiple Choice" },
    { value: "tf", label: "True/False" },
  ];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const teacher = await getTeacherDataFromCookie();
        
        if (!teacher || !teacher.teacherId) {
          toast.error("❌ Please login as a teacher");
          router.push("/login/tech");
          return;
        }

        setTeacherData(teacher);

        // Fetch exam data
        const { data: examData, error: examError } = await supabase
          .from("exams")
          .select("*")
          .eq("id", examId)
          .single();

        if (examError || !examData) {
          toast.error("❌ Exam not found");
          router.push("/teacher/exams");
          return;
        }

        // Verify ownership
        if (examData.created_by !== teacher.teacherId) {
          toast.error("❌ Unauthorized access");
          router.push("/teacher/exams");
          return;
        }

        // Set exam data
        setExamTitle(examData.title);
        setExamCode(examData.exam_code);
        setExamDate(examData.exam_date?.split("T")[0] || "");
        setExamInstructions(examData.description || "");
        setExamSubject(examData.subject_id.toString());
        setExamGrade(examData.grade_id.toString());
        setExamTime(examData.duration || 60);
        setFullscreenRequired(examData.fullscreen_required || false);
        setShuffleQuestions(examData.questions_shuffled || false);
        setShuffleOptions(examData.options_shuffled || false);
        setShowResults(examData.show_results !== false);

        // Fetch teacher's assigned grade and subject names
        const { data: teacherDbData } = await supabase
          .from("teacher")
          .select("grade_id, subject_id")
          .eq("id", teacher.teacherId)
          .single();

        if (teacherDbData) {
          if (teacherDbData.grade_id) {
            const { data: gradeData } = await supabase
              .from("grades")
              .select("grade_name")
              .eq("id", teacherDbData.grade_id)
              .single();
            setTeacherGradeName(gradeData?.grade_name || "");
          }
          
          if (teacherDbData.subject_id) {
            const { data: subjectData } = await supabase
              .from("subjects")
              .select("subject_name")
              .eq("id", teacherDbData.subject_id)
              .single();
            setTeacherSubjectName(subjectData?.subject_name || "");
          }
        }

        // Fetch grades and subjects
        const [gradesResult, subjectsResult] = await Promise.all([
          supabase.from("grades").select("id, grade_name"),
          supabase.from("subjects").select("id, subject_name")
        ]);

        setGrades(gradesResult.data || []);
        setSubjects(subjectsResult.data || []);

        // Fetch questions
        const { data: questionsData, error: questionsError } = await supabase
          .from("questions")
          .select("*")
          .eq("exam_id", examId)
          .order("id");

        if (questionsError) {
          toast.error("❌ Failed to load questions");
          return;
        }

        const processedQuestions: Question[] = questionsData.map((q, index) => {
          let options: Array<{ text: string; image: string | null }> = [];
          let correctAnswer = 0;
          
          // Parse question text using helper function
          const { passage, passageHtml, question } = parseQuestionText(q.question_text);
          
          // Determine question type based on content
          let type = "mcq";
          if (passageHtml) {
            type = "passage";
          } else if (q.question_type === "true_false") {
            type = "tf";
          }
          
          // Parse options
          if (q.options) {
            try {
              const parsed = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
              if (parsed.options && parsed.correct_option_id !== undefined) {
                options = parsed.options.map((text: string, idx: number) => ({ 
                  text, 
                  image: parsed.option_images ? parsed.option_images[idx] || null : null 
                }));
                correctAnswer = parsed.correct_option_id;
              }
            } catch (e) {
              console.error("Error parsing options:", e);
            }
          }

          return {
            id: q.id,
            type: type,
            question: question,
            passage: passage,
            passageHtml: passageHtml,
            options: options.length > 0 ? options : Array(4).fill({ text: "", image: null }),
            correctAnswer: correctAnswer,
            points: q.marks || 1,
            questionImage: q.image_url || null,
            createdOrder: index + 1, // Preserve database order
          };
        });

        setQuestions(processedQuestions);
        setQuestionCounter(processedQuestions.length > 0 ? processedQuestions.length + 1 : 1);

      } catch (error) {
        console.error("Error fetching exam data:", error);
        toast.error("❌ Failed to load exam data. Please try again.");
        router.push("/teacher/exams");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [examId, router]);

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
        if (newQuestion.options.length < 4) {
          updatedOptions = Array(4).fill(null).map(() => ({ text: "", image: null }));
        } else {
          updatedOptions = newQuestion.options;
        }
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
    toast.success("🗑️ Image removed!");
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
    if (!isAddQuestionValid()) {
      toast.error("❌ Please fill all required fields");
      return;
    }
    
    if (editingIndex === -1) {
      // Add new question with order tracking
      const newQ: Question = { 
        ...newQuestion, 
        id: Date.now(),
        createdOrder: questionCounter // Use current counter
      };
      setQuestions([...questions, newQ]);
      setQuestionCounter(questionCounter + 1); // Increment counter
      toast.success(`✅ Question ${questionCounter} added successfully!`);
    } else {
      // Update existing question - preserve order
      const updated = [...questions];
      updated[editingIndex] = { 
        ...newQuestion, 
        id: updated[editingIndex].id,
        createdOrder: updated[editingIndex].createdOrder // Keep original order
      };
      setQuestions(updated);
      setEditingIndex(-1);
      toast.success("✅ Question updated successfully!");
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
    setOptionPreview([]);
  };

  const editQuestion = (index: number) => {
    const q = questions[index];
    setNewQuestion({ ...q });
    passageEditor?.commands.setContent(q.passageHtml || '');
    setEditingIndex(index);
    setIsSidebarOpen(false);
    toast.info(`📝 Editing question ${q.createdOrder}...`);
  };

  const deleteQuestion = (index: number) => {
    const deletedOrder = questions[index].createdOrder;
    setQuestions(questions.filter((_, i) => i !== index));
    
    // Reorder remaining questions
    const reorderedQuestions = questions
      .filter((_, i) => i !== index)
      .map((q, idx) => ({
        ...q,
        createdOrder: idx + 1
      }));
    
    setQuestions(reorderedQuestions);
    setQuestionCounter(reorderedQuestions.length + 1);
    toast.error(`🗑️ Question ${deletedOrder} deleted!`);
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
      toast.success("✅ Information saved! Moving to questions.");
    } else if (currentStep === 2 && isStep2Valid()) {
      setCurrentStep(3);
      toast.success("✅ Questions saved! Moving to settings.");
    } else if (currentStep === 1 && !isStep1Valid()) {
      toast.error("❌ Please fill all required fields");
    } else if (currentStep === 2 && !isStep2Valid()) {
      toast.error("❌ Please add at least one question");
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!teacherData) {
      toast.error("❌ Teacher data not loaded. Please refresh the page.");
      return;
    }

    if (questions.length === 0) {
      toast.error("❌ Please add at least one question.");
      return;
    }

    setSavingExam(true);

    try {
      const total_marks = questions.reduce((sum, q) => sum + q.points, 0);

      // Update exam
      const { error: examError } = await supabase
        .from("exams")
        .update({
          title: examTitle,
          description: examInstructions,
          subject_id: parseInt(examSubject),
          grade_id: parseInt(examGrade),
          exam_date: examDate || new Date().toISOString().split("T")[0],
          duration: examTime,
          total_marks,
          fullscreen_required: fullscreenRequired,
          questions_shuffled: shuffleQuestions,
          options_shuffled: shuffleOptions,
          show_results: showResults,
          updated_at: new Date().toISOString(),
        })
        .eq("id", examId);

      if (examError) {
        console.error("Exam update error:", examError);
        toast.error("❌ Failed to update exam: " + examError.message);
        return;
      }

      // Get existing questions
      const { data: existingQuestions } = await supabase
        .from("questions")
        .select("id")
        .eq("exam_id", examId);

      const existingQuestionIds = existingQuestions?.map(q => q.id) || [];
      const currentQuestionIds = questions.map(q => q.id).filter(id => id && id > 0);

      // Delete removed questions
      const questionsToDelete = existingQuestionIds.filter(id => !currentQuestionIds.includes(id));
      if (questionsToDelete.length > 0) {
        await supabase
          .from("questions")
          .delete()
          .in("id", questionsToDelete);
      }

      // Update/insert questions in order
      const questionPromises = questions.map(async (q, index) => {
        let question_type;
        if (q.type === "mcq" || q.type === "passage") {
          question_type = "multiple_choice";
        } else if (q.type === "tf") {
          question_type = "true_false";
        }

        let question_text = q.question;
        if (q.type === "passage") {
          if (q.passageHtml) {
            // Use HTML format for passages with rich text
            question_text = `[PASSAGE_HTML]${q.passageHtml}[/PASSAGE_HTML]\n\n${q.question}`;
          } else if (q.passage) {
            // Use plain text format
            question_text = q.passage + "\n\n" + q.question;
          }
        }

        let options = null;
        if (question_type === "multiple_choice" || question_type === "true_false") {
          options = {
            options: q.options.map(opt => opt.text),
            correct_option_id: q.correctAnswer,
            option_images: q.options.map(opt => opt.image)
          };
        }

        if (q.id > 0 && existingQuestionIds.includes(q.id)) {
          // Update existing
          return supabase.from("questions").update({
            question_text,
            question_type,
            marks: q.points,
            options: options ? JSON.stringify(options) : null,
            correct_option_id: q.correctAnswer,
            image_url: q.questionImage || null,
            updated_at: new Date().toISOString(),
          }).eq("id", q.id);
        } else {
          // Insert new
          return supabase.from("questions").insert({
            exam_id: examId,
            question_text,
            question_type,
            marks: q.points,
            options: options ? JSON.stringify(options) : null,
            correct_option_id: q.correctAnswer,
            image_url: q.questionImage || null,
          });
        }
      });

      const questionResults = await Promise.allSettled(questionPromises);
      
      const errors = questionResults.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );
      
      if (errors.length > 0) {
        console.error("Some questions failed to save:", errors);
        toast.warning(`⚠️ ${errors.length} questions had issues, but exam was updated.`);
      } else {
        toast.success("✅ Exam updated successfully!");
      }

      setTimeout(() => {
        router.push("/teacher/exams");
      }, 1500);

    } catch (error) {
      console.error("Error updating exam:", error);
      toast.error("❌ Failed to update exam. Please try again.");
    } finally {
      setSavingExam(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex justify-between items-center mb-6">
      <div className={`flex items-center ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
          1
        </div>
        <span className="ml-2 hidden sm:inline font-medium">Information</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <div className={`flex items-center ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
          2
        </div>
        <span className="ml-2 hidden sm:inline font-medium">Questions</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <div className={`flex items-center ${currentStep >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
          3
        </div>
        <span className="ml-2 hidden sm:inline font-medium">Settings</span>
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
        className="w-full flex flex-row items-center justify-between px-3 py-3 hover:bg-muted/50 transition cursor-pointer border"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary font-semibold flex-shrink-0">
            {q.createdOrder}
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-medium truncate">
              {q.type === "passage" && (
                <span className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[10px] mr-1">
                  Passage
                </span>
              )}
              {q.question.length > 35 ? `${q.question.substring(0, 35)}...` : q.question}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{q.type.toUpperCase()}</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium">
                {q.points} point{q.points !== 1 ? 's' : ''}
              </span>
              {q.questionImage && (
                <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> Image
                </span>
              )}
            </div>
          </div>
        </div>
        <div
          className={`flex items-center gap-1 shrink-0 ml-2 transition-opacity duration-200 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onEdit(idx); }}
            className="h-7 w-7 p-0 hover:bg-muted"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onDelete(idx); }}
            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
          >
            <Trash className="h-3.5 w-3.5" />
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
        className="max-w-full h-20 w-auto object-cover rounded border shadow-sm" 
      />
      {imageHover === type && (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(type)}
          className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full shadow-md"
        >
          <XIcon className="h-3 w-3" />
        </Button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col w-full items-center p-4 bg-background min-h-screen">
        <div className="flex flex-col justify-center items-center h-64 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="text-center space-y-1">
            <p className="font-medium">Loading exam data...</p>
            <p className="text-sm text-muted-foreground">Please wait</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
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
                className="fixed top-4 left-4 z-50 shadow-md" 
                size="sm"
              >
                <Menu className="h-4 w-4 mr-2" />
                Questions ({questions.length})
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-96 p-0">
              <SheetHeader className="px-6 py-4 border-b">
                <SheetTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Question Bank
                  </div>
                  <div className="text-sm font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                    {questions.length} Questions
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
                {questions.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Eye className="h-8 w-8 text-muted-foreground/70" />
                    </div>
                    <p className="font-medium mb-2">No questions yet</p>
                    <p className="text-sm">Add questions in the main panel</p>
                  </div>
                ) : (
                  questions
                    .sort((a, b) => a.createdOrder - b.createdOrder) // Sort by creation order
                    .map((q, idx) => (
                      <QuestionBankCard
                        key={q.id}
                        q={q}
                        idx={idx}
                        onEdit={editQuestion}
                        onDelete={deleteQuestion}
                      />
                    ))
                )}
              </div>
            </SheetContent>
          </Sheet>
        )}

        <Card className="w-full max-w-4xl shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold mb-2">
              Edit Exam
            </CardTitle>
            <p className="text-muted-foreground text-base mb-2">
              Update your exam information
            </p>
            {teacherData && (
              <div className="flex items-center justify-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <p className="text-sm text-green-700 font-medium">
                  Teacher: {teacherData.fullName}
                </p>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <StepIndicator />

            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="id" className="flex items-center gap-1">
                    Exam ID
                    <span className="text-xs text-muted-foreground">(Auto-generated)</span>
                  </Label>
                  <div className="mt-1 p-3 border rounded-md bg-muted/30 font-mono font-medium">
                    {examCode}
                  </div>
                </div>
                <div>
                  <Label htmlFor="title" className="required">Exam Title</Label>
                  <Input 
                    id="title" 
                    value={examTitle} 
                    onChange={(e) => setExamTitle(e.target.value)} 
                    className="mt-1"
                    placeholder="e.g., Mid-term Mathematics Exam"
                  />
                </div>
                <div>
                  <Label htmlFor="grade">Grade</Label>
                  <div className="mt-1 p-3 border rounded-md bg-muted/50">
                    <p className="font-medium">{teacherGradeName || grades.find(g => g.id.toString() === examGrade)?.grade_name || "Loading..."}</p>
                    <p className="text-xs text-muted-foreground mt-1">Auto-selected based on your assignment</p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <div className="mt-1 p-3 border rounded-md bg-muted/50">
                    <p className="font-medium">{teacherSubjectName || subjects.find(s => s.id.toString() === examSubject)?.subject_name || "Loading..."}</p>
                    <p className="text-xs text-muted-foreground mt-1">Auto-selected based on your assignment</p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="instructions">Exam Instructions</Label>
                  <textarea 
                    id="instructions" 
                    value={examInstructions} 
                    onChange={(e) => setExamInstructions(e.target.value)} 
                    className="mt-1 w-full min-h-[100px] max-h-[200px] overflow-y-auto p-3 border rounded-md resize-none bg-background"
                    placeholder="Enter exam instructions for students..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date">Exam Date</Label>
                    <Input 
                      id="date" 
                      type="date" 
                      value={examDate} 
                      onChange={(e) => setExamDate(e.target.value)} 
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="time" className="required">Time Limit (minutes)</Label>
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
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-xl flex items-center gap-2">
                      {editingIndex === -1 ? "Add Question" : "Edit Question"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {editingIndex === -1 
                        ? `Next question will be #${questionCounter}`
                        : `Editing question #${questions[editingIndex]?.createdOrder || 1}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Live Preview</Label>
                    <Switch checked={showPreview} onCheckedChange={setShowPreview} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
                
                {/* Rich text editor for passage */}
                {newQuestion.type === "passage" && (
                  <div>
                    <Label>Passage/Paragraph (Rich Text)</Label>
                    <div className="mt-1 border rounded-md overflow-hidden shadow-sm">
                      <EditorToolbar editor={passageEditor} />
                      <EditorContent 
                        editor={passageEditor} 
                        className="prose prose-sm max-w-none p-4 min-h-[150px] max-h-[300px] overflow-y-auto focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:bg-white"
                      />
                    </div>
                    {showPreview && newQuestion.passageHtml && (
                      <div className="mt-2 p-3 bg-muted/30 rounded-md border">
                        <p className="text-sm font-medium mb-2">Passage Preview:</p>
                        <div 
                          className="prose prose-sm max-w-none bg-white p-2 rounded"
                          dangerouslySetInnerHTML={{ __html: newQuestion.passageHtml }}
                        />
                      </div>
                    )}
                  </div>
                )}
                
                <div>
                  <Label htmlFor="question" className="required">Question Text</Label>
                  <p className="text-xs text-muted-foreground mb-1">
                    Supports KaTeX: $inline$ or $$block$$ math notation
                  </p>
                  <textarea 
                    id="question" 
                    value={newQuestion.question} 
                    onChange={handleQuestionChange} 
                    className="mt-1 w-full min-h-[100px] max-h-[200px] overflow-y-auto p-3 border rounded-md resize-none bg-background"
                    placeholder="Enter your question here..."
                  />
                  {showPreview && newQuestion.question && (
                    <div className="mt-2 p-3 bg-muted/30 rounded-md border">
                      <p className="text-sm font-medium mb-1">Preview:</p>
                      <div className="whitespace-pre-wrap">{renderWithMath(newQuestion.question)}</div>
                    </div>
                  )}
                </div>
                <div>
                  <Label>Question Image (Optional)</Label>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openImageModal("question")}
                      className="mt-1 w-fit gap-2"
                    >
                      <ImageIcon className="h-4 w-4" />
                      {newQuestion.questionImage ? "Change Image" : "Upload Image"}
                    </Button>
                    {newQuestion.questionImage && (
                      <div className="mt-1">
                        <ImagePreview 
                          src={newQuestion.questionImage || "/placeholder.svg"} 
                          onDelete={clearImage} 
                          type="question"
                          className="mt-2"
                        />
                      </div>
                    )}
                  </div>
                </div>
                {newQuestion.type !== "short" && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="required">Options</Label>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={addOption} 
                        disabled={newQuestion.type === "tf"}
                        className="gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Option
                      </Button>
                    </div>
                    {newQuestion.options.map((opt, idx) => (
                      <div key={idx} className="space-y-2 p-3 border rounded-md bg-white">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <div className="min-w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 text-primary font-semibold flex-shrink-0">
                              {String.fromCharCode(65 + idx)}
                            </div>
                            <span className="text-xs text-muted-foreground">Option {String.fromCharCode(65 + idx)}</span>
                          </div>
                          <div className="relative flex-1">
                            <Input 
                              placeholder={`Enter option ${String.fromCharCode(65 + idx)} text`} 
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
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeOption(idx)} 
                              className="text-destructive flex-shrink-0 hover:bg-destructive/10"
                            >
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
                    
                    {/* Option Preview Section - Bottom after all options */}
                    {showPreview && optionPreview.some(opt => opt.trim() !== "") && (
                      <div className="mt-4 p-3 bg-muted/30 rounded-md border">
                        <p className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          Options Preview
                        </p>
                        <div className="space-y-2">
                          {newQuestion.options.map((opt, idx) => (
                            opt.text.trim() && (
                              <div key={idx} className="flex items-start gap-3 p-2 bg-white rounded border">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex-shrink-0 mt-0.5">
                                  {String.fromCharCode(65 + idx)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{opt.text}</span>
                                    {newQuestion.correctAnswer === idx && (
                                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium">
                                        ✓ Correct Answer
                                      </span>
                                    )}
                                  </div>
                                  {opt.image && (
                                    <div className="mt-2">
                                      <img 
                                        src={opt.image || "/placeholder.svg"} 
                                        alt={`Option ${String.fromCharCode(65 + idx)}`}
                                        className="max-w-32 h-auto object-cover rounded border shadow-sm"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {newQuestion.type !== "short" && (
                  <div>
                    <Label className="required">Correct Answer</Label>
                    <RadioGroup 
                      value={newQuestion.correctAnswer.toString()} 
                      onValueChange={(val) => setNewQuestion({ ...newQuestion, correctAnswer: parseInt(val) })} 
                      className="flex flex-wrap gap-3 mt-2"
                    >
                      {newQuestion.options.map((_, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <RadioGroupItem value={idx.toString()} id={`correct-${idx}`} className="sr-only" />
                          <Label 
                            htmlFor={`correct-${idx}`} 
                            className={`cursor-pointer px-4 py-2 rounded-lg border-2 transition-all ${
                              newQuestion.correctAnswer === idx 
                                ? "border-primary bg-primary/10 text-primary font-medium" 
                                : "border-muted bg-white hover:border-primary/30"
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <Button 
                    onClick={addOrUpdateQuestion} 
                    disabled={!isAddQuestionValid()}
                    className="disabled:opacity-50 disabled:cursor-not-allowed gap-2 flex-1"
                    size="lg"
                  >
                    <Plus className="h-5 w-5" /> 
                    {editingIndex === -1 ? `Add Question ${questionCounter}` : "Update Question"}
                  </Button>
                  {editingIndex !== -1 && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setEditingIndex(-1);
                        resetNewQuestion();
                        toast.info("✏️ Edit cancelled");
                      }}
                      className="flex-1"
                    >
                      Cancel Edit
                    </Button>
                  )}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/20 transition-colors">
                  <div className="space-y-1">
                    <Label className="font-medium text-base">Shuffle Questions</Label>
                    <p className="text-sm text-muted-foreground">Randomize the order of questions for each student</p>
                  </div>
                  <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/20 transition-colors">
                  <div className="space-y-1">
                    <Label className="font-medium text-base">Shuffle Options</Label>
                    <p className="text-sm text-muted-foreground">Randomize the order of options for each question</p>
                  </div>
                  <Switch checked={shuffleOptions} onCheckedChange={setShuffleOptions} />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/20 transition-colors">
                  <div className="space-y-1">
                    <Label className="font-medium text-base">Require Fullscreen</Label>
                    <p className="text-sm text-muted-foreground">Students must take the exam in fullscreen mode</p>
                  </div>
                  <Switch checked={fullscreenRequired} onCheckedChange={setFullscreenRequired} />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/20 transition-colors">
                  <div className="space-y-1">
                    <Label className="font-medium text-base">Show Results at the End</Label>
                    <p className="text-sm text-muted-foreground">Show results to students after submitting exam</p>
                  </div>
                  <Switch checked={showResults} onCheckedChange={setShowResults} />
                </div>
                <div className="bg-primary/5 p-5 rounded-lg border border-primary/20">
                  <h4 className="font-bold text-lg mb-3 text-primary">Exam Summary</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium">Total Questions:</span>
                        <span className="font-bold">{questions.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Total Points:</span>
                        <span className="font-bold">{questions.reduce((sum, q) => sum + q.points, 0)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium">Time Limit:</span>
                        <span className="font-bold">{examTime} minutes</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Exam Date:</span>
                        <span className="font-bold">{examDate || "Not set"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-primary/20">
                    <div className="flex flex-wrap gap-2">
                      <div className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                        {shuffleQuestions ? "Questions Shuffled" : "Fixed Order"}
                      </div>
                      <div className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                        {fullscreenRequired ? "Fullscreen Required" : "Fullscreen Optional"}
                      </div>
                      <div className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                        {showResults ? "Results Visible" : "Results Hidden"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t">
              <div className="flex gap-3">
                {currentStep > 1 && (
                  <Button 
                    variant="outline" 
                    onClick={handleBack}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                )}
              </div>
              {currentStep < 3 ? (
                <Button 
                  onClick={handleNext} 
                  className="gap-2"
                  disabled={currentStep === 1 ? !isStep1Valid() : !isStep2Valid()}
                >
                  <ChevronRight className="h-4 w-4" />
                  Next Step
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit} 
                  disabled={savingExam || questions.length === 0}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {savingExam ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Updating Exam...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      Update Exam
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}