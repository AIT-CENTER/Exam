// components/ui/chat-history-sheet.tsx

"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Menu,
  Search,
  Lock,
  Pencil,
  Trash2,
  Loader2, // For the loading spinner
  Ghost,  // Placeholder for the top-right icon
} from "lucide-react"
import { cn } from "@/lib/utils"

// Grok SVG Logo Component
function GrokLogo() {
  return (
    <svg width="100" height="40" viewBox="0 0 160 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.95 38.2c-10.3 0-18.65-8.35-18.65-18.65S9.65.9 19.95.9s18.65 8.35 18.65 18.65-8.35 18.65-18.65 18.65zm0-34.9c-8.95 0-16.25 7.3-16.25 16.25s7.3 16.25 16.25 16.25 16.25-7.3 16.25-16.25S28.9 3.3 19.95 3.3z" fill="#000"></path>
      <path d="M19.95 38.2c-1.1 0-2-.9-2-2 0-.9.6-1.65 1.45-1.9l-8.9-8.9c-.3-.3-.4-.7-.4-1.1s.1-.8.4-1.1l11.45-11.45c.3-.3.7-.4 1.1-.4s.8.1 1.1.4l8.9 8.9c.85-.25 1.45-1 1.45-1.9 0-1.1-.9-2-2-2s-2 .9-2 2c0 .9.6 1.65 1.45 1.9l-8.9 8.9c-.3.3-.7.4-1.1.4s-.8-.1-1.1-.4L9.9 20.35c-.3-.3-.4-.7-.4-1.1s.1-.8.4-1.1l8.9-8.9c.85-.25 1.45-1 1.45-1.9 0-1.1-.9-2-2-2s-2 .9-2 2c0 .9.6 1.65 1.45 1.9L7.4 18.7c-1.2 1.2-1.2 3.1 0 4.2l11.1 11.1c.85-.25 1.45-1 1.45-1.9 0-1.1-.9-2-2-2s-2 .9-2 2c0 .9.6 1.65 1.45 1.9l-1.95 1.95c-.3.3-.75.45-1.2.45z" fill="#000"></path>
      <path d="M68.59 27.48h-7.46L52 11.64h8.34l3.74 8.7 3.6-8.7h8.21l-7.3 15.84zm14.8-16.22c-5.22 0-8.95 3.81-8.95 8.88 0 5.14 3.73 8.95 8.95 8.95s8.95-3.81 8.95-8.95c0-5.07-3.73-8.88-8.95-8.88zm0 15.42c-3.6 0-5.22-2.79-5.22-6.54s1.62-6.54 5.22-6.54 5.22 2.79 5.22 6.54-1.62 6.54-5.22 6.54zm20.84-15.42c-5.22 0-8.95 3.81-8.95 8.88 0 5.14 3.73 8.95 8.95 8.95s8.95-3.81 8.95-8.95c0-5.07-3.73-8.88-8.95-8.88zm0 15.42c-3.6 0-5.22-2.79-5.22-6.54s1.62-6.54 5.22-6.54 5.22 2.79 5.22 6.54-1.62 6.54-5.22 6.54zm21.36-15.42h-6.75v15.77h-6.89V11.26h-6.75V4.6h20.39v6.66zm19.78 15.84V4.6h6.89v22.92h-6.89z" fill="#000"></path>
    </svg>
  );
}

// Dummy chat history data
const chatHistory = [
  { id: 1, group: 'Today', title: 'JavaScript Fundamentals for Beginners' },
  { id: 2, group: 'Yesterday', title: 'Creating 3D Human Body Models' },
  { id: 3, group: 'Yesterday', title: 'Oromo Greeting Exchange' },
  { id: 4, group: 'Yesterday', title: 'Image Generation: Arsenal Striker ...' },
  { id: 5, group: 'Yesterday', title: 'CSS Flex Wrap Explanation Examples' },
];

const groupedChats = chatHistory.reduce((acc, chat) => {
  (acc[chat.group] = acc[chat.group] || []).push(chat);
  return acc;
}, {} as Record<string, typeof chatHistory>);

// Props for our Sheet
interface ChatHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatHistorySheet({ open, onOpenChange }: ChatHistorySheetProps) {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState(2); // Default selection like in image

  // Effect to handle the loading spinner simulation
  useEffect(() => {
    if (inputValue) {
      setIsLoading(true);
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 1000); // Simulate network delay
      return () => clearTimeout(timer);
    }
  }, [inputValue]);
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="bg-gray-100 p-0 w-full sm:w-[380px] flex flex-col">
        {/* Top Section */}
        <header className="flex justify-between items-center p-4">
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <Menu className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon">
            <Ghost className="h-6 w-6" />
          </Button>
        </header>

        {/* Logo Section */}
        <div className="flex-shrink-0 flex justify-center items-center py-8">
            <GrokLogo />
        </div>

        {/* Bottom Section (Scrollable) */}
        <div className="flex-1 bg-[#F7F7F7] rounded-t-3xl pt-2 flex flex-col overflow-hidden">
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1.5 bg-gray-300 rounded-full"></div>
          </div>
          
          <div className="px-4 mb-4">
            <div className="relative">
              <Input
                placeholder="Search..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="h-12 pl-4 pr-12 text-base rounded-xl border-gray-300 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-gray-400"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                ) : (
                  <Search className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {/* Actions */}
            <div className="px-2 mb-2">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</p>
                <a href="#" className="text-xs font-medium text-gray-700 hover:underline">Show All</a>
              </div>
              <Button variant="ghost" className="w-full justify-start h-11 px-2 gap-3 hover:bg-gray-200/70">
                <Lock className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-800">Create New Private Chat</span>
              </Button>
            </div>

            {/* Chat History List */}
            <div className="space-y-4 mt-4">
              {Object.entries(groupedChats).map(([group, chats]) => (
                <div key={group}>
                  <p className="px-2 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{group}</p>
                  <ul className="space-y-1">
                    {chats.map(chat => (
                      <li key={chat.id}>
                        <button
                          onClick={() => setSelectedChatId(chat.id)}
                          className={cn(
                            "w-full text-left flex items-center justify-between p-2.5 rounded-lg group transition-colors duration-200",
                            selectedChatId === chat.id ? "bg-gray-200" : "hover:bg-gray-200/60"
                          )}
                        >
                          <span className="text-sm text-gray-900 truncate pr-2">{chat.title}</span>
                          <div className={cn(
                            "flex items-center gap-2 transition-opacity",
                            selectedChatId === chat.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}>
                            <Pencil className="h-4 w-4 text-gray-600" />
                            <Trash2 className="h-4 w-4 text-gray-600" />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
