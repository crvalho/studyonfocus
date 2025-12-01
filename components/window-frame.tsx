import { X, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

interface WindowFrameProps {
  title: string
  children: React.ReactNode
  onClose?: () => void
  onMaximize?: () => void
  isMaximized?: boolean
  className?: string
}

export function WindowFrame({ 
  title, 
  children, 
  onClose, 
  onMaximize, 
  isMaximized,
  className 
}: WindowFrameProps) {
  return (
    <div className={cn(
      "flex flex-col h-full bg-[#09090b] border border-white/10 rounded-xl shadow-2xl overflow-hidden",
      className
    )}>
      {/* macOS-style Window Header */}
      <div className="h-10 bg-[#09090b] border-b border-white/5 flex items-center justify-between px-4 select-none flex-shrink-0">
        <div className="flex items-center gap-2 group">
          <button
            onClick={onClose}
            className="w-3 h-3 rounded-full bg-[#FF5F57] hover:bg-[#FF5F57]/80 transition-colors flex items-center justify-center"
          >
            <X className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
          </button>
          <button
            onClick={onMaximize}
            className="w-3 h-3 rounded-full bg-[#FEBC2E] hover:bg-[#FEBC2E]/80 transition-colors flex items-center justify-center"
          >
            <Minimize2 className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
          </button>
          <button
            onClick={onMaximize}
            className="w-3 h-3 rounded-full bg-[#28C840] hover:bg-[#28C840]/80 transition-colors flex items-center justify-center"
          >
            <Maximize2 className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
          </button>
        </div>
        
        <h3 className="font-medium text-sm text-muted-foreground absolute left-1/2 transform -translate-x-1/2 pointer-events-none">
          {title}
        </h3>

        <div className="w-14" /> {/* Spacer for centering */}
      </div>

      <div className="flex-1 overflow-hidden bg-[#09090b] relative">
        <ScrollArea className="h-full w-full">
          <div className="min-h-full p-1">
            {children}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
