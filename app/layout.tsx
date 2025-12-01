import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Study Focus AI",
  description: "AI-powered study productivity app with focus tools and task management",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark h-screen overflow-hidden">
      <body className={`font-sans antialiased h-screen overflow-hidden`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
