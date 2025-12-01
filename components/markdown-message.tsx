"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Copy, Check } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

interface MarkdownMessageProps {
  content: string
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:m-0 prose-pre:bg-transparent">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "")
            const code = String(children).replace(/\n$/, "")
            const id = `code-${Math.random()}`

            if (!inline && match) {
              return (
                <div className="relative group my-4 rounded-lg overflow-hidden border border-border bg-muted/30">
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
                    <span className="text-xs font-mono text-muted-foreground">{match[1]}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => copyToClipboard(code, id)}
                    >
                      {copiedCode === id ? (
                        <>
                          <Check className="h-3 w-3 mr-1 text-green-500" />
                          <span className="text-green-500">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="p-4 overflow-x-auto bg-background/50">
                    <code className="text-sm font-mono block whitespace-pre" {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              )
            }

            return (
              <code
                className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono before:content-none after:content-none"
                {...props}
              >
                {children}
              </code>
            )
          },
          table({ children }) {
            return (
              <div className="my-6 overflow-hidden rounded-xl border border-border shadow-sm">
                <table className="min-w-full divide-y divide-border">{children}</table>
              </div>
            )
          },
          thead({ children }) {
            return <thead className="bg-primary/5 text-primary">{children}</thead>
          },
          th({ children }) {
            return <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">{children}</th>
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-border bg-card">{children}</tbody>
          },
          td({ children }) {
            return <td className="px-6 py-4 text-sm whitespace-pre-wrap">{children}</td>
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-primary/50 pl-4 italic my-4 text-muted-foreground bg-muted/30 py-2 rounded-r">
                {children}
              </blockquote>
            )
          },
          ul({ children }) {
            return <ul className="list-disc list-outside ml-4 my-3 space-y-1.5">{children}</ul>
          },
          ol({ children }) {
            return <ol className="list-decimal list-outside ml-4 my-3 space-y-1.5">{children}</ol>
          },
          li({ children }) {
            return <li className="text-sm leading-relaxed">{children}</li>
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                {children}
              </a>
            )
          },
          h1({ children }) {
            return <h1 className="text-2xl font-bold mt-6 mb-3">{children}</h1>
          },
          h2({ children }) {
            return <h2 className="text-xl font-bold mt-5 mb-2.5">{children}</h2>
          },
          h3({ children }) {
            return <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>
          },
          p({ children }) {
            return <p className="text-sm leading-relaxed my-2">{children}</p>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
