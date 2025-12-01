"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Upload, FileText, Send, ExternalLink, Trash2, Loader2, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
// import { createClient } from "@/lib/supabase/client" // Removed Supabase

interface Document {
  id: string
  name: string
  content: string
  uploadedAt: Date
  source_id?: string // Link to Supabase source ID
}

interface Message {
  role: "user" | "assistant"
  content: string
  citations?: Array<{
    documentId: string
    documentName: string
    excerpt: string
  }>
}

async function extractPDFText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist")

  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let fullText = ""

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map((item: any) => item.str).join(" ")
    fullText += pageText + "\n\n"
  }

  return fullText.trim()
}

export function InsightsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true) // Set sidebar open by default so documents are visible
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // const supabase = createClient()
  const [notebookId, setNotebookId] = useState<string | null>("default-notebook")

  useEffect(() => {
    // Mock notebook initialization
    setNotebookId("default-notebook")
  }, [])

  const fetchSources = async (currentNotebookId: string) => {
    // Mock fetch sources
    console.log("Fetching sources for notebook:", currentNotebookId)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !notebookId) return

    setIsUploading(true)

    for (const file of Array.from(files)) {
      try {
        let content = ""

        if (file.name.toLowerCase().endsWith(".pdf")) {
          content = await extractPDFText(file)

          if (!content || content.length < 50) {
            alert(`Erro: Não foi possível extrair texto do PDF "${file.name}". Tente um PDF diferente.`)
            continue
          }
        } else {
          content = await file.text()
        }

        // Mock Supabase insert
        const newSource = {
          id: Date.now().toString(),
          title: file.name,
          content: content,
          created_at: new Date().toISOString(),
        }

        if (newSource) {
          const newDoc: Document = {
            id: newSource.id,
            name: newSource.title,
            content: newSource.content || "",
            uploadedAt: new Date(newSource.created_at),
            source_id: newSource.id,
          }
          setDocuments((prev) => [newDoc, ...prev])
        }
      } catch (error) {
        console.error("Error processing file:", error)
        alert(`Erro ao processar "${file.name}". Verifique se é um PDF válido.`)
      }
    }

    setIsUploading(false)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const deleteDocument = async (id: string) => {
    const prevDocs = [...documents]
    setDocuments((prev) => prev.filter((doc) => doc.id !== id))

    try {
      // Mock delete
      console.log("Deleted document:", id)
    } catch (error) {
      console.error("Error deleting document:", error)
      setDocuments(prevDocs)
      alert("Erro ao excluir documento.")
    }
  }

  const searchDocuments = (query: string): Array<{ documentId: string; documentName: string; excerpt: string }> => {
    const results: Array<{ documentId: string; documentName: string; excerpt: string }> = []

    for (const doc of documents) {
      const lowerContent = doc.content.toLowerCase()
      const lowerQuery = query.toLowerCase()
      const words = lowerQuery.split(" ").filter((w) => w.length > 3)

      for (const word of words) {
        const index = lowerContent.indexOf(word)
        if (index !== -1) {
          const start = Math.max(0, index - 100)
          const end = Math.min(doc.content.length, index + 200)
          const excerpt = "..." + doc.content.substring(start, end) + "..."

          results.push({
            documentId: doc.id,
            documentName: doc.name,
            excerpt,
          })
          break
        }
      }
    }

    return results.slice(0, 3)
  }

  const handleSendMessage = async () => {
    if (!input.trim() || documents.length === 0) return

    const userMessage: Message = {
      role: "user",
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const citations = searchDocuments(input)
      const context = documents.map((doc) => `[Documento: ${doc.name}]\n${doc.content}\n\n`).join("")

      const response = await fetch("/api/insights-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          context,
          documents: documents.map((d) => ({ id: d.id, name: d.name })),
        }),
      })

      const data = await response.json()

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response,
        citations: citations.length > 0 ? citations : undefined,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Error:", error)
      const errorMessage: Message = {
        role: "assistant",
        content: "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoading && documents.length > 0) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isLoading, documents.length])

  return (
    <div className="flex h-full w-full bg-background relative">
      {isSidebarOpen && (
        <div className="absolute md:relative z-20 h-full w-64 border-r border-border bg-muted/30 flex flex-col animate-in slide-in-from-left duration-200 shadow-xl md:shadow-none">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h3 className="font-semibold text-base md:text-sm">Documentos ({documents.length})</h3>
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} className="md:hidden">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-4 border-b border-border">
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              className="w-full"
              disabled={isLoading || isUploading || !notebookId}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? "Enviando..." : "Upload"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.pdf,text/plain,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {documents.length === 0 ? (
                <div className="text-center py-8 px-4 text-muted-foreground text-sm">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum documento ainda</p>
                </div>
              ) : (
                documents.map((doc) => (
                  <Card key={doc.id} className="p-3 hover:bg-accent transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-4 h-4 flex-shrink-0" />
                          <p className="text-xs font-medium truncate">{doc.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{doc.uploadedAt.toLocaleDateString()}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteDocument(doc.id)} className="h-6 w-6 p-0">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="flex flex-1 flex-col w-full">
        <div className="p-4 border-b border-border flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Menu className="w-5 h-5" />
          </Button>
          <h2 className="font-semibold">PDF Chat</h2>
        </div>

        <ScrollArea className="flex-1 p-4 max-h-full overflow-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div className="max-w-md">
                <h2 className="text-2xl font-bold mb-2">PDF Chat</h2>
                <p className="text-muted-foreground mb-4">
                  Faça upload de documentos e converse com eles. Obtenha respostas fundamentadas.
                </p>
                <div className="grid grid-cols-2 gap-3 text-left">
                  <Card className="p-3">
                    <Upload className="w-5 h-5 mb-2 text-primary" />
                    <p className="text-sm font-medium">Upload de Documentos</p>
                    <p className="text-xs text-muted-foreground">Adicione seus arquivos .txt ou .pdf</p>
                  </Card>
                  <Card className="p-3">
                    <FileText className="w-5 h-5 mb-2 text-primary" />
                    <p className="text-sm font-medium">Chat Contextual</p>
                    <p className="text-xs text-muted-foreground">Pergunte qualquer coisa sobre seus documentos</p>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"} rounded-lg p-4`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                        <p className="text-xs font-semibold opacity-70">Citações:</p>
                        {msg.citations.map((citation, citIdx) => (
                          <Card key={citIdx} className="p-2 bg-background/50">
                            <div className="flex items-start gap-2">
                              <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium mb-1">{citation.documentName}</p>
                                <p className="text-xs opacity-70 line-clamp-2">{citation.excerpt}</p>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-border flex-shrink-0">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder={
                documents.length === 0
                  ? "Adicione documentos primeiro..."
                  : "Faça uma pergunta sobre seus documentos..."
              }
              className="flex-1 min-h-[60px] max-h-[120px] resize-none"
              disabled={documents.length === 0 || isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || documents.length === 0 || isLoading}
              size="icon"
              className="h-[60px] w-[60px]"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
