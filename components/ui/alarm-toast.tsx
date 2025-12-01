"use client"

import { useEffect, useState } from "react"
import { AlertCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AlarmToastProps {
  message: string
  title?: string
  onClose?: () => void
  isVisible?: boolean
  className?: string
}

export function AlarmToast({ message, title = "Alarme", onClose, isVisible = true, className }: AlarmToastProps) {
  const [visible, setVisible] = useState(isVisible)
  const [isMounting, setIsMounting] = useState(true)

  useEffect(() => {
    if (isVisible) {
      setVisible(true)
      // Small delay to allow render before transition
      requestAnimationFrame(() => setIsMounting(false))
    } else {
      setIsMounting(true)
      const timer = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  if (!visible && isMounting) return null

  return (
    <div
      className={cn(
        "fixed top-4 left-4 z-[9999] flex w-80 flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-lg transition-all duration-300 dark:border-amber-900 dark:bg-amber-950 pointer-events-auto",
        isMounting ? "translate-x-[-100%] opacity-0" : "translate-x-0 opacity-100",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 pt-0.5">
          <AlertCircle className="h-5 w-5 text-amber-500" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-amber-900 dark:text-amber-100">{title}</h3>
          <p className="text-sm text-amber-800 dark:text-amber-200">{message}</p>
        </div>
        <button
          onClick={() => {
            setIsMounting(true)
            setTimeout(() => {
              setVisible(false)
              onClose?.()
            }, 300)
          }}
          className="flex-shrink-0 rounded-full p-1 text-amber-900 transition-colors hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
