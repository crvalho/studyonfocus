"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Send, Sparkles, ImagePlus, X, Trash2, Plus, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import ReactMarkdown from "react-markdown"
import { syncToFirestore, loadFromFirestore } from "@/lib/firestore-sync"

interface Message {
  role: "user" | "assistant"
  content: string
  image?: {
    data: string
    mimeType: string
    preview: string
  }
}

interface AIChatProps {
  isInsightsMode?: boolean
  onNavigate?: (page: any) => void
  commandCallbacks?: React.MutableRefObject<any>
  viewMode?: string
  openWindows?: Set<string>
  onViewModeChange?: (mode: any) => void
  onToggleWindow?: (tool: string) => void
  userId: string
}

const AIChat = ({
  isInsightsMode = false,
  onNavigate,
  commandCallbacks,
  viewMode,
  openWindows,
  onViewModeChange,
  onToggleWindow,
  userId
}: AIChatProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [conversations, setConversations] = useState<
    { id: string; title: string; messages: Message[]; updatedAt: number }[]
  >([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)

  const conversationHistory = useRef<Message[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isSendingRef = useRef(false)

  useEffect(() => {
    if (userId) {
      loadConversationsFromFirestore(userId)
    }
  }, [userId])

  const loadConversationsFromFirestore = async (uid: string) => {
    try {
      const data = await loadFromFirestore(uid, "chat-conversations")
      if (data && data.conversations) {
        setConversations(data.conversations)

        if (data.lastActiveId) {
          const lastConversation = data.conversations.find((c: any) => c.id === data.lastActiveId)
          if (lastConversation) {
            const restoredMessages = [...lastConversation.messages]
            setMessages(restoredMessages)
            conversationHistory.current = restoredMessages
            setCurrentConversationId(data.lastActiveId)
          }
        }
      } else {
        const savedConversations = localStorage.getItem("chat-conversations")
        if (savedConversations) {
          const parsed = JSON.parse(savedConversations)
          setConversations(parsed)

          const lastActiveId = localStorage.getItem("last-active-conversation")
          if (lastActiveId) {
            const lastConversation = parsed.find((c: any) => c.id === lastActiveId)
            if (lastConversation) {
              const restoredMessages = [...lastConversation.messages]
              setMessages(restoredMessages)
              conversationHistory.current = restoredMessages
              setCurrentConversationId(lastActiveId)
            }
          }
        }
      }
    } catch (error) {
      console.error("[v0] Error loading conversations from Firestore:", error)
      const savedConversations = localStorage.getItem("chat-conversations")
      if (savedConversations) {
        const parsed = JSON.parse(savedConversations)
        setConversations(parsed)
      }
    }
  }

  useEffect(() => {
    const handleToggleHistory = () => setShowHistory((prev) => !prev)
    window.addEventListener("toggle-chat-history", handleToggleHistory)
    return () => window.removeEventListener("toggle-chat-history", handleToggleHistory)
  }, [])

  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem("last-active-conversation", currentConversationId)
    }
  }, [currentConversationId])

  useEffect(() => {
    if (messages.length === 0 && !currentConversationId) return

    const saveCurrentConversation = async () => {
      const now = Date.now()
      let updatedConversations = [...conversations]

      const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
      const newTitle = lastUserMessage?.content.slice(0, 30) || "Nova Conversa"

      if (currentConversationId) {
        updatedConversations = updatedConversations.map((c) =>
          c.id === currentConversationId ? { ...c, messages, updatedAt: now, title: newTitle } : c,
        )
      } else if (messages.length > 0) {
        const newId = crypto.randomUUID()
        const newConversation = {
          id: newId,
          title: newTitle,
          messages,
          updatedAt: now,
        }
        updatedConversations = [newConversation, ...updatedConversations]
        setCurrentConversationId(newId)
      }

      setConversations(updatedConversations)
      localStorage.setItem("chat-conversations", JSON.stringify(updatedConversations))

      if (userId) {
        await syncToFirestore(userId, "chat-conversations", {
          conversations: updatedConversations,
          lastActiveId: currentConversationId || updatedConversations[0]?.id || null,
        })
      }
    }

    const timeoutId = setTimeout(saveCurrentConversation, 1000)
    return () => clearTimeout(timeoutId)
  }, [messages, currentConversationId, userId])

  const loadConversation = (id: string) => {
    const conversation = conversations.find((c) => c.id === id)
    if (conversation) {
      setMessages(conversation.messages)
      conversationHistory.current = conversation.messages
      setCurrentConversationId(id)
      setShowHistory(false)
    }
  }

  const startNewChat = () => {
    setMessages([])
    conversationHistory.current = []
    setCurrentConversationId(null)
    setShowHistory(false)
    localStorage.removeItem("last-active-conversation")
  }

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const updated = conversations.filter((c) => c.id !== id)
    setConversations(updated)
    localStorage.setItem("chat-conversations", JSON.stringify(updated))

    if (userId) {
      await syncToFirestore(userId, "chat-conversations", {
        conversations: updated,
        lastActiveId: currentConversationId === id ? null : currentConversationId,
      })
    }

    if (currentConversationId === id) {
      startNewChat()
    }
  }

  const compressImage = (file: File): Promise<{ data: string; mimeType: string; preview: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement("canvas")
          const MAX_WIDTH = 800
          const MAX_HEIGHT = 800
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          ctx?.drawImage(img, 0, 0, width, height)

          const dataUrl = canvas.toDataURL("image/jpeg", 0.7)
          const base64Data = dataUrl.split(",")[1]

          resolve({
            data: base64Data,
            mimeType: "image/jpeg",
            preview: dataUrl,
          })
        }
      }
    })
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        if (item.type.startsWith("image/")) {
          e.preventDefault()

          const file = item.getAsFile()
          if (!file) continue

          setIsLoading(true)
          try {
            const compressed = await compressImage(file)
            setSelectedImage(compressed)
          } catch (error) {
            console.error("Error compressing image:", error)
          } finally {
            setIsLoading(false)
          }
          break
        }
      }
    }

    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [])

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) return
      inputRef.current?.focus()
    }

    document.addEventListener("keydown", handleGlobalKeyDown)
    return () => document.removeEventListener("keydown", handleGlobalKeyDown)
  }, [])

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecione apenas arquivos de imagem")
      return
    }

    setIsLoading(true)
    try {
      const compressed = await compressImage(file)
      setSelectedImage(compressed)
    } catch (error) {
      console.error("Error compressing image:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSend = async () => {
    if (isSendingRef.current || (!input.trim() && !selectedImage) || isLoading) return

    isSendingRef.current = true
    const userMessage = input.trim() || "O que você vê nesta imagem?"
    setInput("")

    const newUserMessage: Message = {
      role: "user" as const,
      content: userMessage,
      image: selectedImage
        ? {
          data: selectedImage.data,
          mimeType: selectedImage.mimeType,
          preview: selectedImage.preview,
        }
        : undefined,
    }

    setMessages((prev) => {
      const newMessages = [...prev, newUserMessage]
      conversationHistory.current = newMessages
      return newMessages
    })

    setSelectedImage(null)
    setIsLoading(true)

    try {
      const currentTasks = localStorage.getItem("tasks")
      const currentKanbanTasks = localStorage.getItem("kanban-tasks")

      let currentSchedules = []
      if (userId) {
        try {
          const schedulesData = await loadFromFirestore(userId, "schedules")
          if (schedulesData && schedulesData.schedules) {
            currentSchedules = schedulesData.schedules
          }
        } catch (e) {
          console.error("Error loading schedules for chat context:", e)
        }
      }

      const context = {
        tasks: currentTasks ? JSON.parse(currentTasks) : [],
        schedules: currentSchedules,
        kanbanTasks: currentKanbanTasks ? JSON.parse(currentKanbanTasks) : [],
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: conversationHistory.current.slice(-10),
          context: context,
          image: newUserMessage.image
            ? {
              data: newUserMessage.image.data,
              mimeType: newUserMessage.image.mimeType,
            }
            : undefined,
        }),
      })

      const data = await response.json()

      if (data.actions && Array.isArray(data.actions)) {
        for (const action of data.actions) {
          console.log("Executing action:", action)

          if (!commandCallbacks?.current) {
            console.warn("No command callbacks available")
            continue
          }

          switch (action.type) {
            case "openPage":
              if (onNavigate) onNavigate(action.page)
              break
            case "createTask":
              if (commandCallbacks.current.createTask) {
                commandCallbacks.current.createTask(action.title)
              }
              break
            case "deleteTask":
              if (commandCallbacks.current.deleteTask) {
                commandCallbacks.current.deleteTask(action.titleOrId)
              }
              break
            case "createKanbanItem":
              if (commandCallbacks.current.createKanbanItem) {
                commandCallbacks.current.createKanbanItem(action.title, action.column)
              }
              break
            case "moveKanbanItem":
              if (commandCallbacks.current.moveKanbanItem) {
                commandCallbacks.current.moveKanbanItem(action.titleOrId, action.newColumn)
              }
              break
            case "createSchedule":
              if (commandCallbacks.current.createSchedule) {
                commandCallbacks.current.createSchedule(action.schedule)
              }
              break
            case "addActivitiesToSchedule":
              if (commandCallbacks.current.addActivitiesToSchedule) {
                commandCallbacks.current.addActivitiesToSchedule(action.activities)
              }
              break
            case "startTimer":
              if (commandCallbacks.current.startTimer) {
                commandCallbacks.current.startTimer(action.minutes)
              }
              break
            case "pauseTimer":
              if (commandCallbacks.current.pauseTimer) {
                commandCallbacks.current.pauseTimer()
              }
              break
            case "stopTimer":
              if (commandCallbacks.current.stopTimer) {
                commandCallbacks.current.stopTimer()
              }
              break
            case "setTimerMode":
              if (commandCallbacks.current.setTimerMode) {
                commandCallbacks.current.setTimerMode(action.mode, action.start)
              }
              break
            case "toggleTimerLoop":
              if (commandCallbacks.current.toggleTimerLoop) {
                commandCallbacks.current.toggleTimerLoop(action.enabled)
              }
              break
            case "playSound":
              // Not implemented in callbacks yet
              break
            case "loadYouTubeVideo":
              if (commandCallbacks.current.loadYouTubeVideo) {
                commandCallbacks.current.loadYouTubeVideo(action.url)
              }
              break
            case "setAlarm":
              if (commandCallbacks.current.setAlarm) {
                commandCallbacks.current.setAlarm(action.enabled, action.minutes)
              }
              break
            case "createManualAlarm":
              if (commandCallbacks.current.createManualAlarm) {
                commandCallbacks.current.createManualAlarm(action.title, action.minutes)
              }
              break
          }
        }
      }

      const assistantMessage = { role: "assistant" as const, content: data.message }

      setMessages((prev) => {
        const newMessages = [...prev, assistantMessage]
        conversationHistory.current = newMessages
        return newMessages
      })
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Desculpe, ocorreu um erro: ${error.message || "Por favor, tente novamente."}`,
        },
      ])
    } finally {
      setIsLoading(false)
      isSendingRef.current = false
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center bg-background relative">
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-16 right-4 z-40 rounded-full text-muted-foreground hover:text-primary"
        onClick={() => setShowHistory(true)}
      >
        <History className="w-5 h-5" />
      </Button>

      {showHistory && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex">
          <div className="w-80 h-full bg-card border-r border-border p-4 flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Histórico</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Button onClick={startNewChat} className="w-full mb-4 gap-2">
              <Plus className="h-4 w-4" />
              Nova Conversa
            </Button>

            <div className="flex-1 overflow-y-auto space-y-2">
              {conversations
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => loadConversation(chat.id)}
                    className={`p-3 rounded-lg cursor-pointer flex items-center justify-between group transition-colors ${currentConversationId === chat.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
                      }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{chat.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(chat.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={(e) => deleteConversation(e, chat.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

              {conversations.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">Nenhuma conversa salva</div>
              )}
            </div>
          </div>
          <div className="flex-1" onClick={() => setShowHistory(false)} />
        </div>
      )}

      <div className="w-full max-w-3xl flex flex-col h-full">
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 md:px-6 py-6 md:py-8">
          {messages.length === 0 ? (
            <div className="text-center py-12 md:py-20 max-w-4xl mx-auto">
              <div className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 mb-4 md:mb-6">
                <Sparkles className="h-7 w-7 md:h-8 md:w-8 text-primary" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 md:mb-3">Olá</h1>
              <p className="text-muted-foreground text-base md:text-lg mb-6 md:mb-8">Como posso ajudar você hoje?</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 max-w-2xl mx-auto">
                <button
                  className="p-3 md:p-4 rounded-xl border border-border hover:bg-accent transition-colors text-left"
                  onClick={() => {
                    // Navigate to the focus timer page and start a timer
                  }}
                >
                  <p className="font-medium text-xs md:text-sm mb-1">Iniciar timer</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">Configure um timer de foco</p>
                </button>
                <button
                  className="p-3 md:p-4 rounded-xl border border-border hover:bg-accent transition-colors text-left"
                  onClick={() => {
                    // Navigate to the focus timer page
                  }}
                >
                  <p className="font-medium text-xs md:text-sm mb-1">Timer de foco</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">
                    Use metodo pomodoro, faça pausas e defina alarmes
                  </p>
                </button>
                <button
                  className="p-3 md:p-4 rounded-xl border border-border hover:bg-accent transition-colors text-left"
                  onClick={() => {
                    // Navigate to the YouTube player page and load a video
                  }}
                >
                  <p className="font-medium text-xs md:text-sm mb-1">Abrir YouTube</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">Carregue vídeos para assistir</p>
                </button>
                <button
                  className="p-3 md:p-4 rounded-xl border border-border hover:bg-accent transition-colors text-left"
                  onClick={() => {
                    // Navigate to the schedules page
                  }}
                >
                  <p className="font-medium text-xs md:text-sm mb-1">Criar Cronograma</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">Crie um cronograma pelo chat</p>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 md:space-y-6">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`rounded-2xl px-4 md:px-5 py-2.5 md:py-3 max-w-[85%] md:max-w-[80%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                  >
                    {msg.image && (
                      <img
                        src={msg.image.preview || "/placeholder.svg"}
                        alt="Imagem enviada"
                        className="rounded-lg mb-2 max-w-full h-auto max-h-48 md:max-h-64 object-contain"
                      />
                    )}
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words leading-relaxed text-sm md:text-base">
                        {msg.content}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-4 md:px-6 pb-4 md:pb-6 pt-3 md:pt-4 border-t border-border/50 max-w-4xl mx-auto w-full">
          {selectedImage && (
            <div className="mb-2 md:mb-3 relative inline-block">
              <img
                src={selectedImage.preview || "/placeholder.svg"}
                alt="Preview"
                className="h-16 md:h-20 rounded-lg border border-border"
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <div className="flex gap-2 md:gap-3 items-center bg-muted/50 rounded-3xl p-1.5 md:p-2">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="icon"
              variant="ghost"
              disabled={isLoading}
              className="rounded-full h-9 w-9 md:h-10 md:w-10 flex-shrink-0"
            >
              <ImagePlus className="h-4 w-4 md:h-5 md:w-5" />
            </Button>

            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Envie uma mensagem..."
              className="flex-1 border-0 bg-transparent focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm md:text-base placeholder:text-muted-foreground"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              size="icon"
              disabled={isLoading || (!input.trim() && !selectedImage)}
              className="rounded-full h-9 w-9 md:h-10 md:w-10 flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export { AIChat }
