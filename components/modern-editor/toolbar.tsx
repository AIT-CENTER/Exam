"use client"

import type React from "react"

import type { Editor } from "@tiptap/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  Undo,
  Redo,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Underline,
  Link,
  Superscript,
  Subscript,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  ChevronDown,
  Upload,
  Plus,
  Palette,
} from "lucide-react"
import { useState, useRef } from "react"

interface ModernToolbarProps {
  editor: Editor
}

export function ModernToolbar({ editor }: ModernToolbarProps) {
  const [linkUrl, setLinkUrl] = useState("")
  const [isLinkOpen, setIsLinkOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getActiveHeading = () => {
    if (editor.isActive("heading", { level: 1 })) return "h1"
    if (editor.isActive("heading", { level: 2 })) return "h2"
    if (editor.isActive("heading", { level: 3 })) return "h3"
    if (editor.isActive("heading", { level: 4 })) return "h4"
    return "paragraph"
  }

  const setHeading = (level: number) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().run()
    } else {
      editor
        .chain()
        .focus()
        .toggleHeading({ level: level as 1 | 2 | 3 | 4 })
        .run()
    }
  }

  const addLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run()
      setLinkUrl("")
      setIsLinkOpen(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        if (file.type.startsWith("image/")) {
          editor.chain().focus().setImage({ src: result }).run()
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const colors = [
    { name: "Green", value: "#22c55e", bg: "bg-green-500" },
    { name: "Blue", value: "#3b82f6", bg: "bg-blue-500" },
    { name: "Pink", value: "#ec4899", bg: "bg-pink-500" },
    { name: "Purple", value: "#a855f7", bg: "bg-purple-500" },
    { name: "Yellow", value: "#eab308", bg: "bg-yellow-500" },
  ]

  const highlightColors = [
    { name: "Yellow", value: "#fef08a", bg: "bg-yellow-200" },
    { name: "Green", value: "#bbf7d0", bg: "bg-green-200" },
    { name: "Blue", value: "#bfdbfe", bg: "bg-blue-200" },
    { name: "Pink", value: "#fbcfe8", bg: "bg-pink-200" },
    { name: "Purple", value: "#e9d5ff", bg: "bg-purple-200" },
  ]

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      <div className="flex items-center gap-1 p-2 flex-wrap">
        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0"
        >
          <Redo className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Heading Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center gap-1 px-3">
              <span className="text-sm font-medium">
                {getActiveHeading() === "h1"
                  ? "H1"
                  : getActiveHeading() === "h2"
                    ? "H2"
                    : getActiveHeading() === "h3"
                      ? "H3"
                      : getActiveHeading() === "h4"
                        ? "H4"
                        : "H"}
              </span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => setHeading(1)}>
              <span className="font-bold text-xl">H1</span>
              <span className="ml-2 text-gray-500">Heading 1</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setHeading(2)}>
              <span className="font-bold text-lg">H2</span>
              <span className="ml-2 text-gray-500">Heading 2</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setHeading(3)}>
              <span className="font-bold text-base">H3</span>
              <span className="ml-2 text-gray-500">Heading 3</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setHeading(4)}>
              <span className="font-bold text-sm">H4</span>
              <span className="ml-2 text-gray-500">Heading 4</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* List Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center gap-1 px-2">
              <List className="h-4 w-4" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <List className="h-4 w-4 mr-2" />
              Bullet List
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <ListOrdered className="h-4 w-4 mr-2" />
              Ordered List
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleTaskList().run()}>
              <CheckSquare className="h-4 w-4 mr-2" />
              Task List
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`h-8 w-8 p-0 ${editor.isActive("orderedList") ? "bg-gray-100" : ""}`}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Text Formatting */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`h-8 w-8 p-0 ${editor.isActive("bold") ? "bg-gray-100" : ""}`}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`h-8 w-8 p-0 ${editor.isActive("italic") ? "bg-gray-100" : ""}`}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`h-8 w-8 p-0 ${editor.isActive("strike") ? "bg-gray-100" : ""}`}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`h-8 w-8 p-0 ${editor.isActive("code") ? "bg-gray-100" : ""}`}
        >
          <Code className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`h-8 w-8 p-0 ${editor.isActive("underline") ? "bg-gray-100" : ""}`}
        >
          <Underline className="h-4 w-4" />
        </Button>

        {/* Text Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3">
            <div className="flex gap-1 mb-3">
              {colors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => editor.chain().focus().setColor(color.value).run()}
                  className={`w-6 h-6 rounded-full ${color.bg} border-2 border-gray-200 hover:border-gray-400`}
                  title={color.name}
                />
              ))}
              <button
                onClick={() => editor.chain().focus().unsetColor().run()}
                className="w-6 h-6 rounded-full border-2 border-gray-400 bg-white relative"
                title="Remove color"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-0.5 bg-red-500 rotate-45"></div>
                </div>
              </button>
            </div>
            <div className="flex gap-1">
              {highlightColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => editor.chain().focus().setHighlight({ color: color.value }).run()}
                  className={`w-6 h-6 rounded ${color.bg} border border-gray-300 hover:border-gray-400`}
                  title={`Highlight ${color.name}`}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Link */}
        <Popover open={isLinkOpen} onOpenChange={setIsLinkOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className={`h-8 w-8 p-0 ${editor.isActive("link") ? "bg-gray-100" : ""}`}>
              <Link className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3">
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Paste a link..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLink()}
                className="flex-1"
              />
              <Button onClick={addLink} disabled={!linkUrl} size="sm">
                Add
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Superscript/Subscript */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          className={`h-8 w-8 p-0 ${editor.isActive("superscript") ? "bg-gray-100" : ""}`}
        >
          <Superscript className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          className={`h-8 w-8 p-0 ${editor.isActive("subscript") ? "bg-gray-100" : ""}`}
        >
          <Subscript className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Text Alignment */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: "left" }) ? "bg-gray-100" : ""}`}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: "center" }) ? "bg-gray-100" : ""}`}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: "right" }) ? "bg-gray-100" : ""}`}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: "justify" }) ? "bg-gray-100" : ""}`}
        >
          <AlignJustify className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Add Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center gap-1 px-3 text-purple-600">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().setHorizontalRule().run()}>
              <div className="h-0.5 w-4 bg-gray-400 mr-2 mt-2"></div>
              Divider
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="image/*" />
      </div>
    </div>
  )
}
