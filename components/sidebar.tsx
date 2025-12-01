"use client"

import { cn } from "@/lib/utils"
import Image from "next/image"

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside
      className={cn("w-16 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-6 gap-4", className)}
    >
      <div className="mb-4">
        <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white/5">
          <Image src="/images/image.png" alt="Study Focus AI" width={40} height={40} className="object-contain" />
        </div>
      </div>
    </aside>
  )
}
