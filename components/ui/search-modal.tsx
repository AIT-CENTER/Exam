"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, Pencil, Expand, Loader2 } from "lucide-react"

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const chatHistory = {
  today: [
    {
      title: "JavaScript Fundamentals for Beginners",
      time: "5 minutes ago",
      isCurrent: true,
    },
  ],
  yesterday: [
    { title: "Creating 3D Human Body Models", time: "15 hours ago" },
    { title: "Oromo Greeting Exchange", time: "17 hours ago" },
    { title: "Image Generation: Arsenal Striker Victor", time: "22 hours ago" },
    { title: "CSS Flex Wrap Explanation Examples", time: "24 hours ago" },
  ],
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    if (value.trim().length > 0) {
      setLoading(true)
      setTimeout(() => setLoading(false), 500) // simulate fetch delay
    } else {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          bg-white 
          p-0 
          shadow-xl 
          rounded-2xl 
          flex flex-col 
          overflow-hidden 
          w-full 
          max-w-[768px] 
          max-h-[80vh]
          items-stretch
        "
      >
        {/* Header (Search Bar) */}
        <div className="relative border-b flex items-center">
          <Input
            placeholder="Search..."
            value={query}
            onChange={handleInputChange}
            className="
              h-14 
              w-full 
              bg-transparent 
              pl-4 pr-12 
              text-base 
              border-none 
              rounded-none
              focus-visible:ring-0 
              focus-visible:ring-offset-0
            "
            autoFocus
          />
          {loading ? (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-gray-500" />
          ) : (
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          )}
        </div>

        {/* Body (scrollable content) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Actions */}
          <div>
            <div className="flex justify-between items-center px-2 mb-2">
              <p className="text-sm font-medium text-gray-600">Actions</p>
              <a href="#" className="text-sm font-medium text-gray-500 hover:text-gray-700">
                Show All
              </a>
            </div>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors duration-150 text-left">
              <Pencil className="h-4 w-4 text-gray-700" />
              <span className="text-sm font-medium text-gray-800">Create New Chat</span>
            </button>
          </div>

          {/* Today Section */}
          <div>
            <p className="px-2 mb-2 text-sm font-medium text-gray-600">Today</p>
            <ul className="space-y-1">
              {chatHistory.today.map((item, index) => (
                <li key={index}>
                  <a
                    href="#"
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-100 transition-colors duration-150"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-900">{item.title}</p>
                      {item.isCurrent && (
                        <span className="px-2 py-0.5 text-xs text-gray-600 font-medium bg-gray-200 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{item.time}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Yesterday Section */}
          <div>
            <p className="px-2 mb-2 text-sm font-medium text-gray-600">Yesterday</p>
            <ul className="space-y-1">
              {chatHistory.yesterday.map((item, index) => (
                <li key={index}>
                  <a
                    href="#"
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-100 transition-colors duration-150"
                  >
                    <p className="text-sm text-gray-900">{item.title}</p>
                    <span className="text-xs text-gray-500">{item.time}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-2">
          <button className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
            <Expand className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
