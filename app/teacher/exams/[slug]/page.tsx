"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle,
  Plus,
  Edit,
  Trash,
  Eye,
  Menu,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
  Loader2,
  Bold,
  Italic,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Link2Off,
  Minus,
  Heading2,
  Quote,
  Code,
  Undo,
  Redo,
  Strikethrough,
  Highlighter,
  Subscript,
  Superscript,
  Palette,
  Type,
} from "lucide-react";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { getTeacherDataFromCookie } from "@/utils/teacherCookie";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Heading from "@tiptap/extension-heading";
import Blockquote from "@tiptap/extension-blockquote";
import CodeBlock from "@tiptap/extension-code-block";
import Strike from "@tiptap/extension-strike";
import Highlight from "@tiptap/extension-highlight";
import SubscriptExtension from "@tiptap/extension-subscript";
import SuperscriptExtension from "@tiptap/extension-superscript";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Underline as UnderlineIcon } from "lucide-react";

// Fixed renderWithMath function to handle nested brackets properly
const renderWithMath = (text: string) => {
  if (!text) return null;

  // Use a more robust regex that handles nested brackets better
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

  return parts.map((part, index) => {
    // Count opening and closing delimiters to handle nested cases
    if (part.startsWith("$$") && part.endsWith("$$")) {
      // Check if we have balanced delimiters
      const mathContent = part.slice(2, -2);
      return <BlockMath key={index} math={mathContent} />;
    } else if (part.startsWith("$") && part.endsWith("$")) {
      // For inline math, also check balanced delimiters
      const mathContent = part.slice(1, -1);
      return <InlineMath key={index} math={mathContent} />;
    } else {
      // Return regular text with preserved line breaks
      return (
        <span key={index} style={{ whiteSpace: "pre-wrap" }}>
          {part}
        </span>
      );
    }
  });
};

const generateExamId = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Color palette for text color selection
const colorPalette = [
  "#000000",
  "#434343",
  "#666666",
  "#999999",
  "#b7b7b7",
  "#cccccc",
  "#d9d9d9",
  "#efefef",
  "#f3f3f3",
  "#ffffff",
  "#980000",
  "#ff0000",
  "#ff9900",
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#4a86e8",
  "#0000ff",
  "#9900ff",
  "#ff00ff",
  "#e6b8af",
  "#f4cccc",
  "#fce5cd",
  "#fff2cc",
  "#d9ead3",
  "#d0e0e3",
  "#c9daf8",
  "#cfe2f3",
  "#d9d2e9",
  "#ead1dc",
  "#dd7e6b",
  "#ea9999",
  "#f9cb9c",
  "#ffe599",
  "#b6d7a8",
  "#a2c4c9",
  "#a4c2f4",
  "#9fc5e8",
  "#b4a7d6",
  "#d5a6bd",
  "#cc4125",
  "#e06666",
  "#f6b26b",
  "#ffd966",
  "#93c47d",
  "#76a5af",
  "#6d9eeb",
  "#6fa8dc",
  "#8e7cc3",
  "#c27ba0",
  "#a61c00",
  "#cc0000",
  "#e69138",
  "#f1c232",
  "#6aa84f",
  "#45818e",
  "#3c78d8",
  "#3d85c6",
  "#674ea7",
  "#a64d79",
  "#85200c",
  "#990000",
  "#b45f06",
  "#bf9000",
  "#38761d",
  "#134f5c",
  "#1155cc",
  "#0b5394",
  "#351c75",
  "#741b47",
  "#5b0f00",
  "#660000",
  "#783f04",
  "#7f6000",
  "#274e13",
  "#0c343d",
  "#1c4587",
  "#073763",
  "#20124d",
  "#4c1130",
];

// --- Enhanced Rich Text Editor Toolbar ---
const EditorToolbar = ({ editor }: { editor: any }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showTextColor, setShowTextColor] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  if (!editor) return null;

  const applyTextColor = (color: string) => {
    editor.chain().focus().setColor(color).run();
    setShowTextColor(false);
  };

  const applyHighlightColor = (color: string) => {
    editor.chain().focus().setHighlight({ color }).run();
    setShowHighlightPicker(false);
  };

  const currentColor = editor.getAttributes("textStyle").color || "#000000";
  const currentHighlight =
    editor.getAttributes("highlight")?.color || "#FFFF00";

  const setLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl("");
    }
  };

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30 relative">
      <div className="flex items-center gap-1 border-r pr-2 mr-1">
        <Select
          value={
            editor.isActive("heading", { level: 2 })
              ? "h2"
              : editor.isActive("heading", { level: 3 })
              ? "h3"
              : editor.isActive("heading", { level: 4 })
              ? "h4"
              : "p"
          }
          onValueChange={(value) => {
            if (value === "p") {
              editor.chain().focus().setParagraph().run();
            } else if (value === "h2") {
              editor.chain().focus().toggleHeading({ level: 2 }).run();
            } else if (value === "h3") {
              editor.chain().focus().toggleHeading({ level: 3 }).run();
            } else if (value === "h4") {
              editor.chain().focus().toggleHeading({ level: 4 }).run();
            }
          }}
        >
          <SelectTrigger className="h-8 w-36">
            <Type className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Normal Text</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
            <SelectItem value="h4">Heading 4</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1 border-r pr-2 mr-1">
        <Button
          type="button"
          variant={editor.isActive("bold") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="h-8 w-8 p-0"
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("italic") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="h-8 w-8 p-0"
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("underline") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className="h-8 w-8 p-0"
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("strike") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className="h-8 w-8 p-0"
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 border-r pr-2 mr-1 relative">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowTextColor(!showTextColor)}
          className="h-8 px-2 gap-1"
          title="Text Color"
        >
          <Palette className="h-4 w-4" />
          <div
            className="h-3 w-3 rounded border"
            style={{ backgroundColor: currentColor }}
          />
        </Button>
        {showTextColor && (
          <div className="absolute top-10 left-0 z-50 bg-white border rounded-lg shadow-lg p-3 w-64 max-h-80 overflow-y-auto">
            <div className="grid grid-cols-10 gap-1">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="h-6 w-6 rounded border hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => applyTextColor(color)}
                  title={color}
                />
              ))}
            </div>
            <div className="mt-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => editor.chain().focus().unsetColor().run()}
                className="w-full"
              >
                Remove Color
              </Button>
            </div>
          </div>
        )}

        <Button
          type="button"
          variant={editor.isActive("highlight") ? "default" : "ghost"}
          size="sm"
          onClick={() => setShowHighlightPicker(!showHighlightPicker)}
          className="h-8 px-2 gap-1"
          title="Highlight Color"
        >
          <Highlighter className="h-4 w-4" />
          <div
            className="h-3 w-3 rounded border"
            style={{ backgroundColor: currentHighlight }}
          />
        </Button>
        {showHighlightPicker && (
          <div className="absolute top-10 left-10 z-50 bg-white border rounded-lg shadow-lg p-3 w-64 max-h-80 overflow-y-auto">
            <div className="grid grid-cols-10 gap-1">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="h-6 w-6 rounded border hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => applyHighlightColor(color)}
                  title={color}
                />
              ))}
            </div>
            <div className="mt-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => editor.chain().focus().unsetHighlight().run()}
                className="w-full"
              >
                Remove Highlight
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 border-r pr-2 mr-1">
        <Button
          type="button"
          variant={editor.isActive("subscript") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          className="h-8 w-8 p-0"
          title="Subscript"
        >
          <Subscript className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("superscript") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          className="h-8 w-8 p-0"
          title="Superscript"
        >
          <Superscript className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 border-r pr-2 mr-1">
        <Button
          type="button"
          variant={editor.isActive("bulletList") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className="h-8 w-8 p-0"
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("orderedList") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className="h-8 w-8 p-0"
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 border-r pr-2 mr-1">
        <Button
          type="button"
          variant={editor.isActive("blockquote") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className="h-8 w-8 p-0"
          title="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("codeBlock") ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className="h-8 w-8 p-0"
          title="Code Block"
        >
          <Code className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 border-r pr-2 mr-1">
        <Button
          type="button"
          variant={editor.isActive({ textAlign: "left" }) ? "default" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className="h-8 w-8 p-0"
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={
            editor.isActive({ textAlign: "center" }) ? "default" : "ghost"
          }
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className="h-8 w-8 p-0"
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={
            editor.isActive({ textAlign: "right" }) ? "default" : "ghost"
          }
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className="h-8 w-8 p-0"
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 border-r pr-2 mr-1">
        <Button
          type="button"
          variant={editor.isActive("link") ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            const url = window.prompt("Enter URL");
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          className="h-8 w-8 p-0"
          title="Add Link"
        >
          <Link2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive("link")}
          className="h-8 w-8 p-0"
          title="Remove Link"
        >
          <Link2Off className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0"
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0"
          title="Redo (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// --- Image Upload Modal (Original Logic) ---
const ImageUploadModal = ({
  isOpen,
  onClose,
  onUpload,
  title,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (url: string) => void;
  title: string;
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bucketName =
    process.env.NEXT_PUBLIC_SUPABASE_IMAGE_BUCKET || "exam_images";

  const showBucketCreationToast = useCallback(() => {
    toast.error(
      <div className="space-y-3 max-w-md">
        <p className="font-bold text-red-700">📁 Storage Bucket Missing</p>
        <p className="text-sm">
          The required storage bucket{" "}
          <code className="bg-gray-200 px-2 py-1 rounded font-mono">
            {bucketName}
          </code>{" "}
          does not exist.
        </p>
        <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
          <p className="font-medium text-sm mb-2">🔧 How to fix:</p>
          <ol className="list-decimal ml-4 text-sm space-y-1">
            <li>Login to Supabase Dashboard</li>
            <li>
              Create bucket:{" "}
              <code className="bg-gray-100 px-1 font-mono">{bucketName}</code>
            </li>
            <li>
              Set to <strong>Public</strong> access
            </li>
          </ol>
        </div>
      </div>,
      { duration: 10000, dismissible: true }
    );
  }, [bucketName]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.type.startsWith("image/")) uploadFile(selectedFile);
      else toast.error("❌ Please drop an image file (PNG, JPG, GIF, etc.)");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith("image/"))
      uploadFile(selectedFile);
    else if (selectedFile) toast.error("❌ Please select an image file");
  };

  const checkBucketExists = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.storage.from(bucketName).list();
      if (
        error &&
        (error.message?.includes("not found") || error.statusCode === "404")
      )
        return false;
      return true;
    } catch {
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

      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 15)}.${fileExt}`;
      const filePath = `exam-images/${fileName}`;

      const { error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });
      if (error) throw error;

      const { data: publicData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);
      onUpload(publicData.publicUrl);
      toast.success("✅ Image uploaded successfully!");
      onClose();
    } catch (err: any) {
      console.error("Upload exception:", err);
      toast.error(`Upload failed: ${err.message || "Unknown error"}`);
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
    } else toast.error("❌ Please enter an image URL");
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
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25"
            } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium">Uploading...</p>
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
              <span className="bg-background px-3 text-muted-foreground font-medium">
                Or
              </span>
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// --- Helper Interfaces & Components ---

interface BlankField {
  id: string;
  correctAnswer: string;
  placeholder?: string;
}

interface MatchingPair {
  sideA: string;
  sideB: string;
  correctMatch: string | null;
}

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
  blanks?: BlankField[];
  matchingInstructions?: string;
  matchingPairs?: MatchingPair[];
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

// Underlined Input Component for MCQ Options with KaTeX preview
const UnderlinedOptionInput = ({
  value,
  onChange,
  placeholder,
  showKaTeXPreview = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  showKaTeXPreview?: boolean;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to get the scroll height
      textareaRef.current.style.height = "auto";
      // Set height to scroll height (content height)
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120; // Maximum height in pixels
      textareaRef.current.style.height = `${Math.min(
        scrollHeight,
        maxHeight
      )}px`;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full px-2 py-2 text-sm border-0 border-b-2 border-dashed border-gray-300 focus:border-primary focus:outline-none bg-transparent resize-none overflow-y-auto min-h-[40px] max-h-[120px]"
        rows={1}
      />
      {showKaTeXPreview && value && value.includes("$") && (
        <div className="mt-1 p-2 bg-muted/20 rounded text-xs">
          <div className="font-medium text-xs mb-1">KaTeX Preview:</div>
          {renderWithMath(value)}
        </div>
      )}
    </div>
  );
};

// Underlined Input Component for Matching Pairs with KaTeX preview
const UnderlinedMatchingInput = ({
  value,
  onChange,
  placeholder,
  showKaTeXPreview = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  showKaTeXPreview?: boolean;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to get the scroll height
      textareaRef.current.style.height = "auto";
      // Set height to scroll height (content height)
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 100; // Maximum height in pixels
      textareaRef.current.style.height = `${Math.min(
        scrollHeight,
        maxHeight
      )}px`;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full px-2 py-2 text-sm border-0 border-b-2 border-dashed border-gray-300 focus:border-primary focus:outline-none bg-transparent resize-none overflow-y-auto min-h-[40px] max-h-[100px]"
        rows={1}
      />
    </div>
  );
};

// Correct Answer Input for Matching Preview
const CorrectAnswerInput = ({
  value,
  onChange,
  pairs,
  index,
}: {
  value: string;
  onChange: (value: string) => void;
  pairs: MatchingPair[];
  index: number;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const availableOptions = pairs.map((_, idx) => String.fromCharCode(65 + idx));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value.toUpperCase();

    // Only allow letters A-Z and ensure they're valid options
    newValue = newValue.replace(/[^A-Z]/g, "");

    // Allow same letter multiple times (for duplicate correct answers)
    // Only validate if the letter is not empty
    if (newValue && !availableOptions.includes(newValue)) {
      return; // Don't update if it's not a valid option
    }

    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent typing invalid characters
    if (
      !/^[a-zA-Z]$/.test(e.key) &&
      e.key !== "Backspace" &&
      e.key !== "Delete" &&
      e.key !== "ArrowLeft" &&
      e.key !== "ArrowRight" &&
      e.key !== "Tab"
    ) {
      e.preventDefault();
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value || ""}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="w-12 px-1 py-0.5 text-center text-sm border-0 border-b-2 border-gray-400 focus:border-primary focus:outline-none bg-transparent"
        maxLength={1}
      />
    </div>
  );
};

// Blank Preview Component
const BlankPreviewInput = ({
  value,
  onChange,
  pointsPerBlank,
}: {
  value: string;
  onChange: (value: string) => void;
  pointsPerBlank?: number;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      const tempSpan = document.createElement("span");
      tempSpan.style.visibility = "hidden";
      tempSpan.style.position = "absolute";
      tempSpan.style.font = window.getComputedStyle(inputRef.current).font;
      tempSpan.textContent = value || " ";
      document.body.appendChild(tempSpan);
      const width = tempSpan.offsetWidth;
      document.body.removeChild(tempSpan);
      inputRef.current.style.width = `${Math.max(
        80,
        Math.min(width + 20, 300)
      )}px`;
    }
  }, [value]);

  return (
    <div className="inline-flex items-center gap-1 mx-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="inline-block px-2 py-1 border-b-2 border-dashed border-gray-400 focus:border-primary focus:outline-none bg-transparent min-w-[80px] transition-all"
        placeholder="Type answer..."
        style={{ width: "80px" }}
      />
      {pointsPerBlank && (
        <span className="text-xs text-green-600 font-medium">
          ({pointsPerBlank.toFixed(1)} pts)
        </span>
      )}
    </div>
  );
};

// Matching Preview Component with correct answer input
const MatchingPreview = ({
  pairs,
  instructions,
  onCorrectAnswerChange,
  pointsPerMatch,
}: {
  pairs: MatchingPair[];
  instructions?: string;
  onCorrectAnswerChange?: (index: number, answer: string) => void;
  pointsPerMatch?: number;
}) => {
  const totalPoints = pointsPerMatch ? pointsPerMatch * pairs.length : 0;

  return (
    <div className="rounded-lg p-4 bg-background border shadow-sm">
      {instructions && (
        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded border-l-4 border-slate-300 dark:border-slate-700">
          <p className="text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">Instructions:</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{instructions}</p>
        </div>
      )}

      {pointsPerMatch && (
        <div className="mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-900">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
            Scoring: {pointsPerMatch.toFixed(1)} pts per match | Total:{" "}
            {totalPoints.toFixed(1)} pts
          </p>
        </div>
      )}

      <div className="bg-background rounded-lg border overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-x divide-border">
          {/* Column A */}
          <div className="flex flex-col">
            <div className="p-3 border-b bg-muted/50">
              <h3 className="text-center font-bold text-foreground uppercase tracking-tight">
                Column A
              </h3>
            </div>
            <div className="">
              {pairs.map((pair, idx) => (
                <div
                  key={idx}
                  className="p-4 hover:bg-muted/30 transition-colors border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {/* Input and Numbering - Perfectly Aligned */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-10">
                        <CorrectAnswerInput
                          value={pair.correctMatch || ""}
                          onChange={(value) =>
                            onCorrectAnswerChange?.(idx, value)
                          }
                          pairs={pairs}
                          index={idx}
                        />
                      </div>
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                        {idx + 1}
                      </div>
                    </div>

                    {/* Text A with KaTeX support */}
                    <div className="flex-1 min-w-0">
                      <div className="text-base text-foreground leading-relaxed break-words whitespace-pre-wrap">
                        {renderWithMath(pair.sideA)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column B */}
          <div className="flex flex-col">
            <div className="p-3 border-b bg-muted/50">
              <h3 className="text-center font-bold text-foreground uppercase tracking-tight">
                Column B
              </h3>
            </div>
            <div className="">
              {pairs.map((pair, idx) => (
                <div
                  key={idx}
                  className="p-4 hover:bg-muted/30 transition-colors border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {/* Lettering (A, B, C...) */}
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </div>

                    {/* Text B with KaTeX support */}
                    <div className="flex-1 min-w-0">
                      <div className="text-base text-foreground leading-relaxed break-words whitespace-pre-wrap">
                        {renderWithMath(pair.sideB)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const [newQuestion, setNewQuestion] = useState<Question>({
    id: 0,
    question: "",
    passage: "",
    passageHtml: "",
    questionImage: null,
    type: "mcq",
    points: 1,
    options: [
      { text: "", image: null },
      { text: "", image: null },
      { text: "", image: null },
      { text: "", image: null },
    ],
    correctAnswer: 0,
    matchingPairs: Array.from({ length: 4 }, () => ({
      sideA: "",
      sideB: "",
      correctMatch: null,
    })),
    matchingInstructions: "",
    blanks: [],
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
  const [savingExam, setSavingExam] = useState(false);
  const [optionPreview, setOptionPreview] = useState<string[]>([]);

  const [blankCursorPos, setBlankCursorPos] = useState<number | null>(null);
  const questionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const passageEditor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Underline,
      Strike,
      Highlight.configure({ multicolor: true }),
      SubscriptExtension,
      SuperscriptExtension,
      TextStyle,
      Color,
      Heading.configure({
        levels: [2, 3, 4],
      }),
      Blockquote,
      CodeBlock.configure({
        HTMLAttributes: {
          class: "code-block",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right"],
        defaultAlignment: "left",
      }),
      Placeholder.configure({
        placeholder: "Start typing your passage here...",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),
    ],
    content: newQuestion.passageHtml || "",
    onUpdate: ({ editor }) => {
      setNewQuestion((prev) => ({
        ...prev,
        passageHtml: editor.getHTML(),
        passage: editor.getText(),
      }));
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4",
        spellcheck: "false",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (passageEditor && newQuestion.passageHtml !== passageEditor.getHTML())
      passageEditor.commands.setContent(newQuestion.passageHtml || "");
  }, [editingIndex, passageEditor, newQuestion.passageHtml]);

  // Rich text editor for exam instructions (same toolset as passage editor)
  const instructionsEditor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Underline,
      Strike,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Heading.configure({
        levels: [2, 3, 4],
      }),
      Blockquote,
      CodeBlock,
      Highlight,
      SubscriptExtension,
      SuperscriptExtension,
      Color,
      TextStyle,
      Link.configure({
        openOnClick: true,
        linkOnPaste: true,
      }),
      Placeholder.configure({
        placeholder: "Write detailed exam instructions for students...",
      }),
    ],
    content: examInstructions || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[180px] max-h-[320px] overflow-y-auto px-3 py-2 focus:outline-none bg-background",
      },
    },
    onUpdate: ({ editor }) => {
      setExamInstructions(editor.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (
      instructionsEditor &&
      examInstructions &&
      examInstructions !== instructionsEditor.getHTML()
    ) {
      instructionsEditor.commands.setContent(examInstructions);
    }
  }, [instructionsEditor, examInstructions]);

  useEffect(() => {
    setOptionPreview(newQuestion.options.map((opt) => opt.text));
  }, [newQuestion.options]);

  const questionTypes = [
    { value: "mcq", label: "Multiple Choice" },
    { value: "passage", label: "Passage-based Multiple Choice" },
    { value: "tf", label: "True/False" },
    { value: "matching", label: "Matching" },
    { value: "blank", label: "Fill in the Blank" },
  ];

  useEffect(() => {
    const fetchTeacherData = async () => {
      setLoading(true);
      try {
        const teacher = await getTeacherDataFromCookie();
        if (!teacher || !teacher.teacherId) {
          toast.error("❌ Please login as a teacher");
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
        const [gradesResult, subjectsResult] = await Promise.all([
          supabase.from("grades").select("id, grade_name"),
          supabase.from("subjects").select("id, subject_name"),
        ]);
        setGrades(gradesResult.data || []);
        setSubjects(subjectsResult.data || []);
      } catch (error) {
        console.error("Error fetching teacher data:", error);
        toast.error("❌ Failed to load teacher data.");
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
    let updatedMatchingPairs = newQuestion.matchingPairs;
    let updatedBlanks = newQuestion.blanks;

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
        updatedOptions =
          newQuestion.options.length < 4
            ? Array(4)
                .fill(null)
                .map(() => ({ text: "", image: null }))
            : newQuestion.options;
        break;
      case "matching":
        updatedOptions = [];
        updatedCorrect = 0;
        if (!updatedMatchingPairs || updatedMatchingPairs.length === 0) {
          updatedMatchingPairs = Array.from({ length: 4 }, () => ({
            sideA: "",
            sideB: "",
            correctMatch: null,
          }));
        }
        break;
      case "blank":
        updatedOptions = [];
        updatedCorrect = 0;
        if (!updatedBlanks || updatedBlanks.length === 0) {
          updatedBlanks = [];
        }
        break;
      default:
        updatedOptions = newQuestion.options;
        break;
    }
    setNewQuestion((prev) => ({
      ...prev,
      options: updatedOptions,
      correctAnswer: updatedCorrect,
      matchingPairs: updatedMatchingPairs,
      blanks: updatedBlanks,
    }));
  }, [newQuestion.type]);

  const handleQuestionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewQuestion({ ...newQuestion, question: e.target.value });
    if (questionTextareaRef.current)
      setBlankCursorPos(questionTextareaRef.current.selectionStart);
  };

  const openImageModal = (type: string) => {
    setImageUploadType(type);
    setShowImageModal(true);
  };

  const handleImageUpload = (imageUrl: string) => {
    if (imageUploadType === "question")
      setNewQuestion({ ...newQuestion, questionImage: imageUrl });
    else if (imageUploadType && imageUploadType.startsWith("option-")) {
      const idx = parseInt(imageUploadType.split("-")[1]);
      const newOptions = newQuestion.options.map((opt, i) =>
        i === idx ? { ...opt, image: imageUrl } : opt
      );
      setNewQuestion({ ...newQuestion, options: newOptions });
    }
  };

  const clearImage = (type: string) => {
    if (type === "question")
      setNewQuestion({ ...newQuestion, questionImage: null });
    else if (type && type.startsWith("option-")) {
      const idx = parseInt(type.split("-")[1]);
      const newOptions = newQuestion.options.map((opt, i) =>
        i === idx ? { ...opt, image: null } : opt
      );
      setNewQuestion({ ...newQuestion, options: newOptions });
    }
    setImageHover(null);
  };

  const handleOptionChange = (index: number, value: string) => {
    if (newQuestion.type === "tf") return;
    const newOptions = newQuestion.options.map((opt, i) =>
      i === index ? { ...opt, text: value } : opt
    );
    setNewQuestion({ ...newQuestion, options: newOptions });
  };

  const addOption = () => {
    if (newQuestion.type === "tf") return;
    setNewQuestion({
      ...newQuestion,
      options: [...newQuestion.options, { text: "", image: null }],
    });
  };
  const removeOption = (index: number) => {
    if (newQuestion.type === "tf" || newQuestion.options.length <= 2) return;
    const newOptions = newQuestion.options.filter((_, i) => i !== index);
    setNewQuestion({
      ...newQuestion,
      options: newOptions,
      correctAnswer:
        newQuestion.correctAnswer >= newOptions.length
          ? 0
          : newQuestion.correctAnswer,
    });
  };

  const handleAddBlank = () => {
    if (!questionTextareaRef.current) return;
    const cursorPos =
      blankCursorPos !== null
        ? blankCursorPos
        : questionTextareaRef.current.selectionStart;
    const blankId = `blank_${Date.now()}`;
    const newQuestionText =
      newQuestion.question.slice(0, cursorPos) +
      `[BLANK:${blankId}]` +
      newQuestion.question.slice(cursorPos);
    setNewQuestion((prev) => ({
      ...prev,
      question: newQuestionText,
      blanks: [
        ...(prev.blanks || []),
        {
          id: blankId,
          correctAnswer: "",
          placeholder: "Enter correct answer...",
        },
      ],
    }));
  };

  const updateBlankAnswer = (blankId: string, answer: string) => {
    setNewQuestion((prev) => ({
      ...prev,
      blanks: (prev.blanks || []).map((blank) =>
        blank.id === blankId ? { ...blank, correctAnswer: answer } : blank
      ),
    }));
  };
  const removeBlank = (blankId: string) => {
    setNewQuestion((prev) => ({
      ...prev,
      question: prev.question.replace(`[BLANK:${blankId}]`, ""),
      blanks: (prev.blanks || []).filter((blank) => blank.id !== blankId),
    }));
  };

  const updateMatchingInstructions = (instructions: string) =>
    setNewQuestion((prev) => ({ ...prev, matchingInstructions: instructions }));

  const updateMatchingPair = (
    index: number,
    field: "sideA" | "sideB",
    value: string
  ) => {
    setNewQuestion((prev) => {
      const newPairs = [...(prev.matchingPairs || [])];
      if (!newPairs[index])
        newPairs[index] = {
          sideA: "",
          sideB: "",
          correctMatch: null,
        };
      newPairs[index] = { ...newPairs[index], [field]: value };
      return { ...prev, matchingPairs: newPairs };
    });
  };

  const updateMatchingCorrectAnswer = (index: number, answer: string) => {
    setNewQuestion((prev) => {
      const newPairs = [...(prev.matchingPairs || [])];
      if (!newPairs[index]) return prev;
      newPairs[index] = { ...newPairs[index], correctMatch: answer };
      return { ...prev, matchingPairs: newPairs };
    });
  };

  const addMatchingPair = () =>
    setNewQuestion((prev) => ({
      ...prev,
      matchingPairs: [
        ...(prev.matchingPairs || []),
        { sideA: "", sideB: "", correctMatch: null },
      ],
    }));

  const removeMatchingPair = (index: number) => {
    setNewQuestion((prev) => {
      const newPairs = [...(prev.matchingPairs || [])];
      newPairs.splice(index, 1);
      return { ...prev, matchingPairs: newPairs };
    });
  };

  const isAddQuestionValid = () => {
    if (newQuestion.type === "passage" && newQuestion.passage.trim() === "")
      return false;
    if (newQuestion.type === "matching") {
      const pairs = newQuestion.matchingPairs || [];
      return (
        pairs.length >= 2 &&
        pairs.every(
          (pair) => pair.sideA.trim() !== "" && pair.sideB.trim() !== ""
        ) &&
        pairs.every(
          (pair) => pair.correctMatch && pair.correctMatch.trim() !== ""
        ) &&
        // Ensure correct matches are valid letters (A-Z)
        pairs.every((pair) => {
          if (!pair.correctMatch) return false;
          const matchLetter = pair.correctMatch.toUpperCase();
          const validLetters = pairs.map((_, idx) =>
            String.fromCharCode(65 + idx)
          );
          return validLetters.includes(matchLetter);
        })
      );
    }
    if (newQuestion.type === "blank")
      return (
        newQuestion.question.trim() !== "" &&
        (newQuestion.blanks || []).length > 0 &&
        (newQuestion.blanks || []).every(
          (blank) => blank.correctAnswer.trim() !== ""
        )
      );
    return (
      newQuestion.question.trim() !== "" &&
      newQuestion.options.every((opt) => opt.text.trim() !== "") &&
      newQuestion.options.length >= 2 &&
      newQuestion.correctAnswer >= 0
    );
  };

  const addOrUpdateQuestion = () => {
    if (!isAddQuestionValid()) {
      toast.error("❌ Please fill all required fields");
      return;
    }

    let questionToAdd = { ...newQuestion };

    if (editingIndex === -1) {
      setQuestions([...questions, { ...questionToAdd, id: Date.now() }]);
    } else {
      const updated = [...questions];
      updated[editingIndex] = {
        ...questionToAdd,
        id: updated[editingIndex].id,
      };
      setQuestions(updated);
      setEditingIndex(-1);
    }
    resetNewQuestion();
  };

  const resetNewQuestion = () => {
    setNewQuestion({
      id: 0,
      question: "",
      passage: "",
      passageHtml: "",
      questionImage: null,
      type: "mcq",
      points: 1,
      options: [
        { text: "", image: null },
        { text: "", image: null },
        { text: "", image: null },
        { text: "", image: null },
      ],
      correctAnswer: 0,
      matchingPairs: Array.from({ length: 4 }, () => ({
        sideA: "",
        sideB: "",
        correctMatch: null,
      })),
      matchingInstructions: "",
      blanks: [],
    });
    passageEditor?.commands.setContent("");
    setOptionPreview([]);
  };

  const editQuestion = (index: number) => {
    const q = questions[index];
    setNewQuestion({ ...q });
    passageEditor?.commands.setContent(q.passageHtml || "");
    setEditingIndex(index);
    setIsSidebarOpen(false);
  };
  const deleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };
  const isStep1Valid = () =>
    examTitle.trim() !== "" &&
    examGrade !== "" &&
    examSubject !== "" &&
    examTime > 0;
  const isStep2Valid = () => questions.length > 0;

  const handleNext = () => {
    if (currentStep === 1 && isStep1Valid()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && isStep2Valid()) {
      setCurrentStep(3);
    } else if (currentStep === 1)
      toast.error("❌ Please fill all required fields");
    else if (currentStep === 2)
      toast.error("❌ Please add at least one question");
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!teacherData || questions.length === 0) return;
    setSavingExam(true);
    try {
      const total_marks = questions.reduce((sum, q) => sum + q.points, 0);
      const examData = {
        exam_code: examId,
        title: examTitle,
        description: examInstructions,
        subject_id: parseInt(examSubject),
        grade_id: parseInt(examGrade),
        section: teacherData.sections?.[0] || "",
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
      if (examError) throw examError;

      const questionPromises = questions.map(async (q) => {
        let question_type,
          question_text = q.question,
          options = null,
          metadata = null,
          correct_option_id = q.correctAnswer,
          marks = q.points;

        if (q.type === "mcq" || q.type === "passage") {
          question_type = "multiple_choice";
          if (q.type === "passage") {
            question_text = `[PASSAGE_HTML]${q.passageHtml}[/PASSAGE_HTML]\n\n${q.question}`;
          }
          options = {
            options: q.options.map((opt) => opt.text),
            option_images: q.options.map((opt) => opt.image),
          };
        } else if (q.type === "tf") {
          question_type = "true_false";
          options = {
            options: q.options.map((opt) => opt.text),
            option_images: q.options.map((opt) => opt.image),
          };
        } else if (q.type === "matching") {
          question_type = "matching";
          question_text = q.matchingInstructions || "";

          // Calculate points per correct match
          const totalPairs = q.matchingPairs?.length || 0;
          const pointsPerMatch = totalPairs > 0 ? q.points / totalPairs : 0;

          metadata = {
            pairs:
              q.matchingPairs?.map((p) => ({
                sideA: p.sideA,
                sideB: p.sideB,
                correctMatch: p.correctMatch,
                points: pointsPerMatch,
              })) || [],
            sideA_labeled: (q.matchingPairs || []).map((_, idx) =>
              (idx + 1).toString()
            ),
            sideB_labeled: (q.matchingPairs || []).map((_, idx) =>
              String.fromCharCode(65 + idx)
            ),
            totalPairs: totalPairs,
            pointsPerMatch: pointsPerMatch,
            totalPoints: q.points,
          };
          correct_option_id = 0; // Not used for matching type
        } else if (q.type === "blank") {
          question_type = "fill_blank";
          question_text = q.question;

          // Calculate points per blank
          const totalBlanks = (q.blanks || []).length;
          const pointsPerBlank = totalBlanks > 0 ? q.points / totalBlanks : 0;

          metadata = {
            blanks: (q.blanks || []).map((blank) => ({
              id: blank.id,
              correctAnswer: blank.correctAnswer,
              placeholder: blank.placeholder || "Type answer...",
              points: pointsPerBlank,
            })),
            original_text: q.question,
            totalBlanks: totalBlanks,
            pointsPerBlank: pointsPerBlank,
            totalPoints: q.points,
          };
          correct_option_id = 0; // Not used for fill_blank type
        }

        // Insert the question
        const { data: questionData, error: questionError } = await supabase
          .from("questions")
          .insert({
            exam_id: exam.id,
            question_text,
            question_type,
            marks: marks, // This is the total points for the question
            options: options ? JSON.stringify(options) : null,
            metadata: metadata ? JSON.stringify(metadata) : null,
            correct_option_id,
            image_url: q.questionImage || null,
          })
          .select()
          .single();

        if (questionError) throw questionError;

        // For matching questions, we need to store each pair as a separate option for easier grading
        if (
          q.type === "matching" &&
          q.matchingPairs &&
          q.matchingPairs.length > 0
        ) {
          // Create options for each matching pair
          const matchingOptions = {
            options: q.matchingPairs.map(
              (pair, idx) =>
                `${idx + 1}. ${pair.sideA} → ${pair.correctMatch || "?"}`
            ),
            option_images: q.matchingPairs.map(() => null),
            correctMatches: q.matchingPairs.map((pair) => pair.correctMatch),
            pointsPerMatch: q.points / q.matchingPairs.length,
          };

          // Update the question with matching options
          await supabase
            .from("questions")
            .update({
              options: JSON.stringify(matchingOptions),
            })
            .eq("id", questionData.id);
        }

        return questionData;
      });

      await Promise.all(questionPromises);
      toast.success("✅ Exam created successfully!");
      setTimeout(() => router.push("/teacher/exams"), 1500);
    } catch (error: any) {
      console.error("Error creating exam:", error);
      toast.error("❌ Failed to create exam: " + error.message);
    } finally {
      setSavingExam(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex justify-between items-center mb-6">
      <div
        className={`flex items-center ${
          currentStep >= 1 ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            currentStep === 1
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          }`}
        >
          1
        </div>
        <span className="ml-2 hidden sm:inline font-medium">Information</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <div
        className={`flex items-center ${
          currentStep >= 2 ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            currentStep === 2
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          }`}
        >
          2
        </div>
        <span className="ml-2 hidden sm:inline font-medium">Questions</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <div
        className={`flex items-center ${
          currentStep >= 3 ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            currentStep === 3
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          }`}
        >
          3
        </div>
        <span className="ml-2 hidden sm:inline font-medium">Settings</span>
      </div>
    </div>
  );

  const QuestionBankCard = ({
    q,
    idx,
    onEdit,
    onDelete,
  }: {
    q: Question;
    idx: number;
    onEdit: (index: number) => void;
    onDelete: (index: number) => void;
  }) => {
    const [hovered, setHovered] = useState(false);
    const getQuestionTypeBadge = (type: string) => {
      switch (type) {
        case "matching":
          return (
            <span className="text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded text-[10px] mr-1">
              Matching
            </span>
          );
        case "blank":
          return (
            <span className="text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded text-[10px] mr-1">
              Fill Blank
            </span>
          );
        case "passage":
          return (
            <span className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[10px] mr-1">
              Passage
            </span>
          );
        default:
          return null;
      }
    };
    return (
      <Card
        className="w-full h-14 flex flex-row items-center justify-between px-3 hover:bg-muted/50 transition cursor-pointer border"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium text-xs text-muted-foreground shrink-0">
              {idx + 1}.
            </span>
          </div>
          <p className="text-xs font-medium truncate">
            {getQuestionTypeBadge(q.type)}
            {q.question.substring(0, 40)}...
          </p>
        </div>
        <div
          className={`flex items-center gap-1 shrink-0 ml-2 transition-opacity duration-200 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(idx);
            }}
            className="h-6 w-6 p-0 hover:bg-muted"
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(idx);
            }}
            className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
          >
            <Trash className="h-3 w-3" />
          </Button>
        </div>
      </Card>
    );
  };

  const ImagePreview = ({
    src,
    onDelete,
    type,
  }: {
    src: string;
    onDelete: (type: string) => void;
    type: string;
  }) => (
    <div
      className="relative inline-block mt-2"
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
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );

  const renderQuestionWithBlanks = (
    questionText: string,
    blanks: BlankField[] = []
  ) => {
    if (!questionText) return null;
    const parts = questionText.split(/(\[BLANK:[^\]]+\])/g);
    return parts.map((part, index) => {
      const blankMatch = part.match(/\[BLANK:([^\]]+)\]/);
      if (blankMatch) {
        const blank = blanks.find((b) => b.id === blankMatch[1]);
        return blank ? (
          <span key={index} className="inline-flex items-center mx-1">
            <span className="px-2 py-1 bg-yellow-100 border border-yellow-300 rounded text-sm">
              {renderWithMath(blank.correctAnswer || "______")}
            </span>
          </span>
        ) : null;
      }
      return <span key={index}>{renderWithMath(part)}</span>;
    });
  };

  if (loading && currentStep === 1) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full bg-transparent">
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
          className="h-10 w-10 text-zinc-800 dark:text-zinc-200 spinner-svg mb-4"
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
        <p className="font-medium text-foreground">Loading teacher data...</p>
      </div>
    );
  }

  return (
    <>
      <ImageUploadModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onUpload={handleImageUpload}
        title={
          imageUploadType === "question"
            ? "Upload Question Image"
            : `Upload Option Image`
        }
      />
      {/* Ensure TipTap editor styles exist on all steps (instructions + passage) */}
      <style>{`
        .ProseMirror {
          min-height: 180px;
          padding: 1rem;
          outline: none;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .ProseMirror p {
          margin-bottom: 0.75rem;
          line-height: 1.6;
        }

        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
          margin: 0.75rem 0;
        }

        .ProseMirror ul {
          list-style-type: disc;
        }

        .ProseMirror ol {
          list-style-type: decimal;
        }

        .ProseMirror li {
          margin: 0.25rem 0;
        }

        .ProseMirror mark {
          background-color: var(--highlight-color, #ffff00);
          padding: 0.1em 0.2em;
          border-radius: 0.2em;
        }

        .ProseMirror a {
          color: #3b82f6;
          text-decoration: underline;
        }

        .ProseMirror a:hover {
          color: #1d4ed8;
        }
      `}</style>
      <div className="flex flex-col w-full items-center p-4 bg-background min-h-screen">
        {currentStep === 2 && (
          <Drawer direction="left" open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                className="fixed top-4 left-4 z-50 shadow-md"
                size="sm"
              >
                <Menu className="h-4 w-4 mr-2" />
                Questions ({questions.length})
              </Button>
            </DrawerTrigger>
            <DrawerContent className="w-80 h-full max-w-sm rounded-none border-r border-border bg-background flex flex-col m-0 p-0">
              <DrawerHeader className="px-4 py-4 border-b text-left">
                <DrawerTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" /> Question Bank ({questions.length})
                </DrawerTitle>
              </DrawerHeader>
              <div className="p-4 space-y-2 overflow-y-auto flex-1">
                {questions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="font-medium mb-2">No questions yet</p>
                    <p className="text-sm">Add questions in the main panel</p>
                  </div>
                ) : (
                  questions.map((q, idx) => (
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
            </DrawerContent>
          </Drawer>
        )}

        <Card className="w-full max-w-7xl shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold mb-2">
              Create New Exam
            </CardTitle>
            <p className="text-muted-foreground text-base mb-2">
              Complete each step to create your exam
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
                    <span className="text-xs text-muted-foreground">
                      (Auto-generated)
                    </span>
                  </Label>
                  <div className="mt-1 p-3 border rounded-md bg-muted/30 font-mono font-medium">
                    {examId}
                  </div>
                </div>
                <div>
                  <Label htmlFor="title" className="required">
                    Exam Title
                  </Label>
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
                    <p className="font-medium">
                      {teacherGradeName || "Loading..."}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-selected based on your assignment
                    </p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <div className="mt-1 p-3 border rounded-md bg-muted/50">
                    <p className="font-medium">
                      {teacherSubjectName || "Loading..."}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-selected based on your assignment
                    </p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="instructions">Exam Instructions</Label>
                  <div className="mt-1 border rounded-md overflow-hidden shadow-sm">
                    <EditorToolbar editor={instructionsEditor} />
                    {mounted && instructionsEditor ? (
                      <EditorContent
                        editor={instructionsEditor}
                        className="min-h-[180px] max-h-[320px] overflow-y-auto focus:outline-none bg-background"
                      />
                    ) : (
                      <div className="min-h-[180px] p-4 flex items-center justify-center text-muted-foreground">
                        Loading editor...
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="time" className="required">
                    Time Limit (minutes)
                  </Label>
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
                    {editingIndex === -1 ? "Add Question" : "Edit Question"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Live Preview</Label>
                    <Switch
                      checked={showPreview}
                      onCheckedChange={setShowPreview}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="question-type">Question Type</Label>
                  <Select
                    value={newQuestion.type}
                    onValueChange={(value) =>
                      setNewQuestion({ ...newQuestion, type: value })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {questionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
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
                    onChange={(e) =>
                      setNewQuestion({
                        ...newQuestion,
                        points: parseInt(e.target.value) || 1,
                      })
                    }
                    className="mt-1"
                    min="1"
                  />
                </div>

                {newQuestion.type === "passage" && (
                  <div>
                    <Label>Passage/Paragraph (Enhanced Rich Text Editor)</Label>
                    <div className="mt-1 border rounded-md overflow-hidden shadow-sm">
                      <EditorToolbar editor={passageEditor} />
                      {mounted && passageEditor ? (
                        <EditorContent
                          editor={passageEditor}
                          className="min-h-[250px] max-h-[500px] overflow-y-auto focus:outline-none"
                        />
                      ) : (
                        <div className="min-h-[250px] p-4 flex items-center justify-center text-muted-foreground">
                          Loading editor...
                        </div>
                      )}
                    </div>
                    {showPreview && newQuestion.passageHtml && (
                      <div className="mt-2 p-3 bg-muted/30 rounded-md border">
                        <p className="text-sm font-medium mb-2">
                          Passage Preview:
                        </p>
                        <div
                          className="prose prose-sm max-w-none bg-white p-2 rounded max-h-[300px] overflow-y-auto"
                          dangerouslySetInnerHTML={{
                            __html: newQuestion.passageHtml,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {newQuestion.type === "matching" && (
                  <div className="space-y-6">
                    {/* Instructions Section */}
                    <div>
                      <Label
                        htmlFor="matching-instructions"
                        className="text-sm font-semibold text-gray-700"
                      >
                        Instructions for Matching
                      </Label>
                      <textarea
                        id="matching-instructions"
                        value={newQuestion.matchingInstructions || ""}
                        onChange={(e) =>
                          updateMatchingInstructions(e.target.value)
                        }
                        className="mt-1 w-full min-h-[100px] max-h-[200px] overflow-y-auto p-3 border rounded-md resize-none bg-background"
                        placeholder="e.g., Match the items in Column A with their correct descriptions in Column B"
                      />
                      {newQuestion.matchingInstructions &&
                        newQuestion.matchingInstructions.includes("$") && (
                          <div className="mt-2 p-2 bg-muted/20 rounded text-xs">
                            <div className="font-medium text-xs mb-1">
                              KaTeX Preview:
                            </div>
                            {renderWithMath(newQuestion.matchingInstructions)}
                          </div>
                        )}
                    </div>

                    {/* Matching Pairs Editor */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <Label className="text-lg font-bold text-gray-800">
                          Matching Pairs
                        </Label>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={addMatchingPair}
                          className="bg-gray-800 hover:bg-gray-700 text-white shadow-sm gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add New Pair
                        </Button>
                      </div>

                      {/* Header Titles */}
                      <div className="grid grid-cols-2 gap-0 border-x border-t rounded-t-lg bg-gray-50 overflow-hidden">
                        <div className="p-3 text-center border-r font-bold text-gray-700 uppercase tracking-wider text-xs">
                          Column A (Numbered)
                        </div>
                        <div className="p-3 text-center font-bold text-gray-700 uppercase tracking-wider text-xs">
                          Column B (Lettered)
                        </div>
                      </div>

                      {/* Input Rows */}
                      <div className="border rounded-b-lg divide-y bg-white">
                        {newQuestion.matchingPairs?.map((pair, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-2 gap-0 group relative"
                          >
                            {/* Column A Side */}
                            <div className="p-4 border-r relative flex items-center gap-3">
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Row Number */}
                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                                  {idx + 1}
                                </div>
                              </div>
                              <div className="flex-1">
                                <UnderlinedMatchingInput
                                  value={pair.sideA}
                                  onChange={(value) =>
                                    updateMatchingPair(idx, "sideA", value)
                                  }
                                  placeholder="Enter question/term"
                                  showKaTeXPreview={true}
                                />
                              </div>
                            </div>

                            {/* Column B Side */}
                            <div className="p-4 flex items-center gap-3 relative">
                              {/* Letter Label */}
                              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm flex-shrink-0">
                                {String.fromCharCode(65 + idx)}
                              </div>
                              <div className="flex-1">
                                <UnderlinedMatchingInput
                                  value={pair.sideB}
                                  onChange={(value) =>
                                    updateMatchingPair(idx, "sideB", value)
                                  }
                                  placeholder="Enter answer/definition"
                                  showKaTeXPreview={true}
                                />
                              </div>

                              {/* Delete Button - Positioned at the very end of the row */}
                              {newQuestion.matchingPairs!.length > 2 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeMatchingPair(idx)}
                                  className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Preview Section */}
                    {showPreview &&
                      newQuestion.matchingPairs &&
                      newQuestion.matchingPairs.some(
                        (p) => p.sideA || p.sideB
                      ) && (
                        <div className="mt-8 pt-6 border-t">
                          <div className="flex items-center gap-2 mb-4 text-blue-800">
                            <Eye className="h-5 w-5" />
                            <p className="font-bold">Student View Preview</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border-2 border-dashed border-slate-200">
                            <MatchingPreview
                              pairs={newQuestion.matchingPairs || []}
                              instructions={newQuestion.matchingInstructions}
                              onCorrectAnswerChange={
                                updateMatchingCorrectAnswer
                              }
                              pointsPerMatch={
                                newQuestion.matchingPairs?.length > 0
                                  ? newQuestion.points /
                                    newQuestion.matchingPairs.length
                                  : 0
                              }
                            />
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {newQuestion.type === "blank" && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Label htmlFor="question" className="required">
                          Question Text with Blanks
                        </Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddBlank}
                          className="gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Blank
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Click where you want to add a blank, then click "Add
                        Blank". Supports KaTeX: $inline$ or $$block$$ math
                        notation
                      </p>
                      <textarea
                        ref={questionTextareaRef}
                        id="question"
                        value={newQuestion.question}
                        onChange={handleQuestionChange}
                        onClick={() => {
                          if (questionTextareaRef.current)
                            setBlankCursorPos(
                              questionTextareaRef.current.selectionStart
                            );
                        }}
                        onSelect={() => {
                          if (questionTextareaRef.current)
                            setBlankCursorPos(
                              questionTextareaRef.current.selectionStart
                            );
                        }}
                        className="mt-1 w-full min-h-[100px] max-h-[200px] overflow-y-auto p-3 border rounded-md resize-none bg-background"
                        placeholder="Enter your question here. Click to position cursor, then click 'Add Blank' to insert a blank space at that position."
                      />
                      {(newQuestion.blanks || []).length > 0 && (
                        <div className="mt-3">
                          <Label>
                            Blank Spaces ({newQuestion.blanks?.length || 0})
                          </Label>
                          <div className="mt-2 space-y-2">
                            {(newQuestion.blanks || []).map((blank, idx) => (
                              <div
                                key={blank.id}
                                className="flex items-center gap-2 p-2 border rounded bg-white"
                              >
                                <div className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 font-bold flex items-center justify-center flex-shrink-0">
                                  {idx + 1}
                                </div>
                                <div className="flex-1">
                                  <Input
                                    placeholder="Enter correct answer for this blank"
                                    value={blank.correctAnswer}
                                    onChange={(e) =>
                                      updateBlankAnswer(
                                        blank.id,
                                        e.target.value
                                      )
                                    }
                                  />
                                  {blank.correctAnswer &&
                                    blank.correctAnswer.includes("$") && (
                                      <div className="mt-1 p-1 bg-muted/10 rounded text-xs">
                                        <div className="font-medium text-xs mb-0.5">
                                          KaTeX Preview:
                                        </div>
                                        {renderWithMath(blank.correctAnswer)}
                                      </div>
                                    )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeBlank(blank.id)}
                                  className="text-destructive hover:bg-destructive/10 flex-shrink-0"
                                >
                                  <Trash className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {showPreview && newQuestion.question && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Blank Space Preview
                          </p>
                          <div className="p-4 bg-muted/30 rounded-md border">
                            <div className="mb-3">
                              <p className="text-sm font-medium mb-1">
                                Teacher View (with correct answers):
                              </p>
                              <div className="p-3 bg-white rounded border">
                                {renderQuestionWithBlanks(
                                  newQuestion.question,
                                  newQuestion.blanks || []
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!["matching", "blank"].includes(newQuestion.type) && (
                  <>
                    <div>
                      <Label htmlFor="question" className="required">
                        Question Text
                      </Label>
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
                          <div className="whitespace-pre-wrap">
                            {renderWithMath(newQuestion.question)}
                          </div>
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
                          {newQuestion.questionImage
                            ? "Change Image"
                            : "Upload Image"}
                        </Button>
                        {newQuestion.questionImage && (
                          <div className="mt-1">
                            <ImagePreview
                              src={
                                newQuestion.questionImage || "/placeholder.svg"
                              }
                              onDelete={clearImage}
                              type="question"
                              className="mt-2"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {newQuestion.type !== "short" &&
                      newQuestion.type !== "tf" &&
                      newQuestion.type !== "matching" &&
                      newQuestion.type !== "blank" && (
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
                            <div
                              key={idx}
                              className="space-y-2 p-3 border rounded-md bg-white"
                            >
                              <div className="flex items-center gap-2">
                                {/* A, B, C... Label */}
                                <div className="min-w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 text-primary font-semibold flex-shrink-0">
                                  {String.fromCharCode(65 + idx)}
                                </div>

                                {/* Input Field */}
                                <div className="flex-1">
                                  <UnderlinedOptionInput
                                    value={opt.text}
                                    onChange={(value) =>
                                      handleOptionChange(idx, value)
                                    }
                                    placeholder={`Enter option ${String.fromCharCode(
                                      65 + idx
                                    )} text`}
                                    showKaTeXPreview={true}
                                  />
                                </div>

                                {/* Action Buttons (Image & Delete) */}
                                <div className="flex items-center gap-1">
                                  {/* Image Upload Button */}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      openImageModal(`option-${idx}`)
                                    }
                                    className="h-9 w-9 p-0 flex-shrink-0"
                                  >
                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                  </Button>

                                  {/* Delete Button */}
                                  {newQuestion.options.length > 2 &&
                                    newQuestion.type !== "tf" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeOption(idx)}
                                        className="text-destructive h-9 w-9 p-0 flex-shrink-0 hover:bg-destructive/10"
                                      >
                                        <Trash className="h-4 w-4" />
                                      </Button>
                                    )}
                                </div>
                              </div>

                              {/* Image Preview Area */}
                              {opt.image && (
                                <div className="ml-10">
                                  <ImagePreview
                                    src={opt.image || "/placeholder.svg"}
                                    onDelete={() => clearImage(`option-${idx}`)} // clearImage qofa osoo hin taane id isaa waliin
                                    type={`option-${idx}`}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                          {showPreview &&
                            optionPreview.some((opt) => opt.trim() !== "") && (
                              <div className="mt-4 p-3 bg-muted/30 rounded-md border">
                                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                  <Eye className="h-4 w-4" />
                                  Options Preview
                                </p>
                                <div className="space-y-2">
                                  {newQuestion.options.map(
                                    (opt, idx) =>
                                      opt.text.trim() && (
                                        <div
                                          key={idx}
                                          className="flex items-start gap-3 p-2 bg-white rounded border"
                                        >
                                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex-shrink-0 mt-0.5">
                                            {String.fromCharCode(65 + idx)}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm font-medium">
                                                {renderWithMath(opt.text)}
                                              </div>
                                              {newQuestion.correctAnswer ===
                                                idx && (
                                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium">
                                                  ✓ Correct Answer
                                                </span>
                                              )}
                                            </div>
                                            {opt.image && (
                                              <div className="mt-2">
                                                <img
                                                  src={
                                                    opt.image ||
                                                    "/placeholder.svg"
                                                  }
                                                  alt={`Option ${String.fromCharCode(
                                                    65 + idx
                                                  )}`}
                                                  className="max-w-32 h-auto object-cover rounded border shadow-sm"
                                                />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    {newQuestion.type !== "short" &&
                      newQuestion.type !== "matching" &&
                      newQuestion.type !== "blank" && (
                        <div>
                          <Label className="required">Correct Answer</Label>
                          <RadioGroup
                            value={newQuestion.correctAnswer.toString()}
                            onValueChange={(val) =>
                              setNewQuestion({
                                ...newQuestion,
                                correctAnswer: parseInt(val),
                              })
                            }
                            className="flex flex-wrap gap-3 mt-2"
                          >
                            {newQuestion.options.map((_, idx) => (
                              <div
                                key={idx}
                                className="flex items-center space-x-2"
                              >
                                <RadioGroupItem
                                  value={idx.toString()}
                                  id={`correct-${idx}`}
                                  className="sr-only"
                                />
                                <Label
                                  htmlFor={`correct-${idx}`}
                                  className={`cursor-pointer px-4 py-2 rounded-lg border-2 transition-all ${
                                    newQuestion.correctAnswer === idx
                                      ? "border-primary bg-primary/10 text-primary font-medium"
                                      : "border-muted bg-white hover:border-primary/30"
                                  }`}
                                >
                                  {newQuestion.type === "tf"
                                    ? newQuestion.options[idx].text
                                    : String.fromCharCode(65 + idx)}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      )}
                  </>
                )}
                <div className="flex gap-3">
                  <Button
                    onClick={addOrUpdateQuestion}
                    disabled={!isAddQuestionValid()}
                    className="disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {editingIndex === -1 ? "Add Question" : "Update Question"}
                  </Button>
                  {editingIndex !== -1 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingIndex(-1);
                        resetNewQuestion();
                      }}
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
                    <Label className="font-medium text-base">
                      Shuffle Questions
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Randomize the order of questions for each student
                    </p>
                  </div>
                  <Switch
                    checked={shuffleQuestions}
                    onCheckedChange={setShuffleQuestions}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/20 transition-colors">
                  <div className="space-y-1">
                    <Label className="font-medium text-base">
                      Shuffle Options
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Randomize the order of options for each question
                    </p>
                  </div>
                  <Switch
                    checked={shuffleOptions}
                    onCheckedChange={setShuffleOptions}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/20 transition-colors">
                  <div className="space-y-1">
                    <Label className="font-medium text-base">
                      Require Fullscreen
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Students must take the exam in fullscreen mode
                    </p>
                  </div>
                  <Switch
                    checked={fullscreenRequired}
                    onCheckedChange={setFullscreenRequired}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/20 transition-colors">
                  <div className="space-y-1">
                    <Label className="font-medium text-base">
                      Show Results
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Show results to students after submitting exam
                    </p>
                  </div>
                  <Switch
                    onCheckedChange={setShowResults}
                  />
                </div>
                <div className="bg-primary/5 p-5 rounded-lg border border-primary/20">
                  <h4 className="font-bold text-lg mb-3 text-primary">
                    Exam Summary
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium">Total Questions:</span>
                        <span className="font-bold">{questions.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Total Points:</span>
                        <span className="font-bold">
                          {questions.reduce((sum, q) => sum + q.points, 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Question Types:</span>
                        <div className="flex gap-1">
                          {Array.from(
                            new Set(questions.map((q) => q.type))
                          ).map((type) => (
                            <span
                              key={type}
                              className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                            >
                              {type}:{" "}
                              {questions.filter((q) => q.type === type).length}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium">Time Limit:</span>
                        <span className="font-bold">{examTime} minutes</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Exam ID:</span>
                        <code className="font-mono font-bold bg-primary/10 px-2 py-1 rounded">
                          {examId}
                        </code>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Teacher:</span>
                        <span className="font-bold">
                          {teacherData?.fullName}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-primary/20">
                    <div className="flex flex-wrap gap-2">
                      <div className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                        {shuffleQuestions
                          ? "Questions Shuffled"
                          : "Fixed Order"}
                      </div>
                      <div className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                        {fullscreenRequired
                          ? "Fullscreen Required"
                          : "Fullscreen Optional"}
                      </div>
                      <div className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                        {showResults ? "Results Visible" : "Results Hidden"}
                      </div>
                      <div className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                        {shuffleOptions ? "Options Shuffled" : "Options Fixed"}
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
                  disabled={
                    currentStep === 1 ? !isStep1Valid() : !isStep2Valid()
                  }
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
                      Creating Exam...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      Create Exam
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
