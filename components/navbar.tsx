"use client"

import {
  MessageSquare,
  CheckSquare,
  LayoutDashboard as LayoutKanban,
  Calendar,
  Timer,
  StickyNote,
  Youtube,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolType, ViewMode } from "@/components/app-layout"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const viewItems = [{ id: "chat" as ViewMode, icon: MessageSquare, label: "Chat", shortcut: "Ctrl+0" }]

const toolItems = [
  { id: "notes" as ToolType, icon: StickyNote, label: "Notas", shortcut: "Ctrl+5" },
  { id: "kanban" as ToolType, icon: LayoutKanban, label: "Kanban", shortcut: "Ctrl+2" },
  { id: "tasks" as ToolType, icon: CheckSquare, label: "Metas", shortcut: "Ctrl+1" },
  { id: "focus-timer" as ToolType, icon: Timer, label: "Foco", shortcut: "Ctrl+4" },
  { id: "youtube-player" as ToolType, icon: Youtube, label: "YouTube", shortcut: "Ctrl+7" },
]

const additionalViewItems = [
  { id: "schedules" as ViewMode, icon: Calendar, label: "Cronogramas", shortcut: "Ctrl+3" },
]

interface NavbarProps {
  viewMode: ViewMode
  openWindows: Set<ToolType>
  onViewModeChange: (mode: ViewMode) => void
  onToggleWindow: (tool: ToolType) => void
}

export function Navbar({ viewMode, openWindows, onViewModeChange, onToggleWindow }: NavbarProps) {
  return (
    <div className="w-full py-3 flex justify-center bg-background">
      <nav className="h-12 bg-card/80 backdrop-blur-xl border border-border rounded-2xl flex items-center px-2 gap-0.5 shadow-lg">
        <TooltipProvider delayDuration={0}>
          <div className="flex gap-0.5 items-center">
            {viewItems.map((item) => {
              const isActive = viewMode === item.id

              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onViewModeChange(item.id)}
                      className={cn(
                        "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
                        "hover:bg-primary/10 hover:scale-105",
                        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="hidden md:flex items-center gap-2 bg-zinc-900 border-zinc-800 text-white shadow-xl"
                  >
                    <span className="font-medium">{item.label}</span>
                    <kbd className="px-2 py-1 text-xs bg-white/10 text-zinc-300 rounded border border-white/10 font-mono">
                      {item.shortcut}
                    </kbd>
                  </TooltipContent>
                </Tooltip>
              )
            })}

            {toolItems.map((item) => {
              const isOpen = openWindows.has(item.id)

              return (
                <div key={item.id} className="flex items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onToggleWindow(item.id)}
                        className={cn(
                          "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
                          "hover:bg-primary/10 hover:scale-105",
                          isOpen ? "bg-primary/20 text-primary" : "text-muted-foreground",
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        {isOpen && <span className="absolute -bottom-0.5 w-1 h-1 bg-primary rounded-full" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="hidden md:flex items-center gap-2 bg-zinc-900 border-zinc-800 text-white shadow-xl"
                    >
                      <span className="font-medium">{item.label}</span>
                      <kbd className="px-2 py-1 text-xs bg-white/10 text-zinc-300 rounded border border-white/10 font-mono">
                        {item.shortcut}
                      </kbd>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )
            })}

            <div className="w-px h-6 bg-border mx-1" />

            {additionalViewItems.map((item) => {
              const isActive = viewMode === item.id

              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onViewModeChange(item.id)}
                      className={cn(
                        "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
                        "hover:bg-primary/10 hover:scale-105",
                        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="hidden md:flex items-center gap-2 bg-zinc-900 border-zinc-800 text-white shadow-xl"
                  >
                    <span className="font-medium">{item.label}</span>
                    <kbd className="px-2 py-1 text-xs bg-white/10 text-zinc-300 rounded border border-white/10 font-mono">
                      {item.shortcut}
                    </kbd>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>
      </nav>
    </div>
  )
}
