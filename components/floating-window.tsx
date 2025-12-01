'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

interface FloatingWindowProps {
  title: string
  children: React.ReactNode
  position: { x: number; y: number }
  size: { width: number; height: number }
  isMinimized: boolean
  zIndex: number
  onClose: () => void
  onMinimize: () => void
  onPositionChange: (position: { x: number; y: number }) => void
  onSizeChange: (size: { width: number; height: number }) => void
  onFocus: () => void
}

export function FloatingWindow({
  title,
  children,
  position,
  size,
  isMinimized,
  zIndex,
  onClose,
  onMinimize,
  onPositionChange,
  onSizeChange,
  onFocus,
}: FloatingWindowProps) {
  const windowRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-controls')) return
    
    onFocus()
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    onFocus()
    setIsResizing(true)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x
        const newY = e.clientY - dragStart.y
        
        const maxX = window.innerWidth - 200
        const maxY = window.innerHeight - 150
        
        onPositionChange({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        })
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y
        
        const newWidth = Math.max(500, resizeStart.width + deltaX)
        const newHeight = Math.max(450, resizeStart.height + deltaY)
        
        const maxWidth = window.innerWidth - position.x - 20
        const maxHeight = window.innerHeight - position.y - 150
        
        onSizeChange({
          width: Math.min(newWidth, maxWidth),
          height: Math.min(newHeight, maxHeight),
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, dragStart, resizeStart, position, onPositionChange, onSizeChange])

  return (
    <div
      ref={windowRef}
      className={cn(
        "absolute flex flex-col bg-card border border-border rounded-lg shadow-2xl overflow-hidden transition-opacity",
        isDragging && "cursor-grabbing",
        isMinimized && "opacity-50"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: isMinimized ? '40px' : `${size.height}px`,
        zIndex,
      }}
      onMouseDown={onFocus}
    >
      {/* Window Header */}
      <div
        className="h-10 bg-card border-b border-border flex items-center justify-between px-4 select-none cursor-grab active:cursor-grabbing flex-shrink-0"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 group window-controls">
          <button
            onClick={onClose}
            className="w-3 h-3 rounded-full bg-[#FF5F57] hover:bg-[#FF5F57]/80 transition-colors flex items-center justify-center"
          >
            <X className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
          </button>
          <button
            onClick={onMinimize}
            className="w-3 h-3 rounded-full bg-[#FEBC2E] hover:bg-[#FEBC2E]/80 transition-colors flex items-center justify-center"
          >
            <Minimize2 className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
          </button>
          <button
            className="w-3 h-3 rounded-full bg-[#28C840] hover:bg-[#28C840]/80 transition-colors flex items-center justify-center"
          >
            <Maximize2 className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
          </button>
        </div>

        <h3 className="font-medium text-sm text-muted-foreground absolute left-1/2 transform -translate-x-1/2 pointer-events-none">
          {title}
        </h3>

        <div className="w-14" />
      </div>

      {/* Window Content */}
      {!isMinimized && (
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full w-full">
            <div className="p-4">
              {children}
            </div>
          </ScrollArea>

          {/* Resize Handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            onMouseDown={handleResizeMouseDown}
          >
            <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-muted-foreground/30" />
          </div>
        </div>
      )}
    </div>
  )
}
