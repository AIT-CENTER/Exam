"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Typography from "@tiptap/extension-typography"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import Color from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import HorizontalRule from "@tiptap/extension-horizontal-rule"
import Highlight from "@tiptap/extension-highlight"
import Superscript from "@tiptap/extension-superscript"
import Subscript from "@tiptap/extension-subscript"
import { ModernToolbar } from "./toolbar"
import { FileUploadArea } from "./file-upload-area"
import { useState } from "react"

export function ModernEditor() {
  const [showFileUpload, setShowFileUpload] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start writing...",
        showOnlyWhenEditable: true,
        showOnlyCurrent: false,
      }),
      Typography,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline hover:text-blue-800 cursor-pointer",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-lg max-w-full h-auto my-4",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Superscript,
      Subscript,
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "flex items-start gap-2",
        },
      }),
      HorizontalRule.configure({
        HTMLAttributes: {
          class: "my-8 border-gray-300",
        },
      }),
    ],
    content: `
      <h1>Getting started</h1>
      <p>Welcome to the <mark>Simple Editor</mark> template! This template integrates <strong>open source</strong> UI components and Tiptap extensions licensed under <strong>MIT</strong>.</p>
      <p>Integrate it by following the <a href="https://ui.tiptap.dev">Tiptap UI Components docs</a> or using our CLI tool.</p>
      <pre><code>npx @tiptap/cli init</code></pre>
    `,
    editorProps: {
      attributes: {
        class:
          "prose prose-lg max-w-none focus:outline-none min-h-[600px] px-6 py-4 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
      },
    },
    onUpdate: ({ editor }) => {
      // Handle slash command for file upload
      const { from, to } = editor.state.selection
      const text = editor.state.doc.textBetween(from - 1, to, "\n")

      if (text === "/file" || text === "/upload") {
        editor.commands.deleteRange({ from: from - 5, to })
        setShowFileUpload(true)
      }
    },
  })

  if (!editor) {
    return null
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <ModernToolbar editor={editor} />

      <div className="border border-t-0 rounded-b-lg bg-white min-h-[600px]">
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[600px] [&_.ProseMirror_h1]:text-4xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-4 [&_.ProseMirror_h1]:mt-8 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:mt-6 [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_p]:text-gray-800 [&_.ProseMirror_p]:leading-relaxed [&_.ProseMirror_p]:mb-3 [&_.ProseMirror_ul]:mb-4 [&_.ProseMirror_ol]:mb-4 [&_.ProseMirror_li]:mb-1 [&_.ProseMirror_.is-empty]:before:content-[attr(data-placeholder)] [&_.ProseMirror_.is-empty]:before:text-gray-400 [&_.ProseMirror_.is-empty]:before:pointer-events-none [&_.ProseMirror_.is-empty]:before:float-left [&_.ProseMirror_.is-empty]:before:h-0 [&_.ProseMirror_pre]:bg-gray-100 [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:rounded-lg [&_.ProseMirror_pre]:my-4 [&_.ProseMirror_code]:bg-gray-100 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:rounded"
        />

        {showFileUpload && <FileUploadArea editor={editor} onClose={() => setShowFileUpload(false)} />}
      </div>
    </div>
  )
}
