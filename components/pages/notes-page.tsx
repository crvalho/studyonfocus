"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, Trash2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { loadFromFirestore, syncToFirestore } from "@/lib/firestore-sync"

interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
}

interface NotesPageProps {
  userId: string
}

export function NotesPage({ userId }: NotesPageProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null)
  const isInitialLoad = useRef(true)

  // Estado derivado para a nota selecionada
  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null

  // Carrega notas do Firestore
  useEffect(() => {
    const loadNotes = async () => {
      if (!userId) return
      try {
        const data = await loadFromFirestore(userId, "notes")
        if (data && Array.isArray(data.notes)) {
          setNotes(data.notes)
          if (data.notes.length > 0 && isInitialLoad.current) {
            setSelectedNoteId(data.notes[0].id)
          }
        }
      } catch (error) {
        console.error("Erro ao carregar notas:", error)
      } finally {
        isInitialLoad.current = false
      }
    }
    loadNotes()
  }, [userId])

  // Salva notas no Firestore
  useEffect(() => {
    const saveNotes = async () => {
      if (!userId || isInitialLoad.current) return
      try {
        await syncToFirestore(userId, "notes", { notes })
      } catch (error) {
        console.error("Error syncing notes:", error)
      }
    }

    // Debounce save to Firestore
    const timeoutId = setTimeout(saveNotes, 2000)
    return () => clearTimeout(timeoutId)
  }, [notes, userId])

  const createNote = useCallback(() => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: "Untitled Note",
      content: "",
      updatedAt: Date.now(),
    }

    setNotes((prev) => [newNote, ...prev])
    setSelectedNoteId(newNote.id)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault()
        createNote()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [createNote])

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => {
      const updated = prev.filter((n) => n.id !== id)

      // If we deleted the selected note, select the first available one
      if (selectedNoteId === id) {
        setSelectedNoteId(updated.length > 0 ? updated[0].id : null)
      }

      // Force immediate save
      syncToFirestore(userId, "notes", { notes: updated }).catch(err =>
        console.error("Error syncing deleted note:", err)
      )

      return updated
    })
  }, [userId, selectedNoteId])

  const updateNote = useCallback(
    (updates: Partial<Note>) => {
      if (!selectedNoteId) return

      setNotes((prev) =>
        prev.map((n) =>
          n.id === selectedNoteId
            ? { ...n, ...updates, updatedAt: Date.now() }
            : n
        )
      )
    },
    [selectedNoteId]
  )

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-72 border-r border-white/10 flex flex-col bg-[#09090b]">
        <div className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes... (Ctrl+L)"
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
            />
          </div>
          <Button onClick={createNote} className="w-full bg-white text-black hover:bg-white/90">
            <Plus className="h-4 w-4 mr-2" />
            New (Ctrl+B)
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredNotes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No notes yet. Create one to get started!
            </div>
          ) : (
            filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => setSelectedNoteId(note.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg mb-1 transition-colors",
                  selectedNoteId === note.id
                    ? "bg-white/10 text-white"
                    : "text-muted-foreground hover:bg-white/5 hover:text-white",
                )}
              >
                <div className="font-medium truncate">{note.title || "Untitled Note"}</div>
                <div className="text-xs opacity-60 truncate mt-1">{note.content || "No content"}</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col bg-[#09090b]">
        {selectedNote ? (
          <>
            <div className="p-6 pb-0 flex items-center justify-between">
              <Input
                value={selectedNote.title}
                onChange={(e) => updateNote({ title: e.target.value })}
                className="text-3xl font-bold border-none shadow-none focus-visible:ring-0 px-0 bg-transparent text-white placeholder:text-muted-foreground"
                placeholder="Untitled Note"
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => selectedNote && setNoteToDelete(selectedNote.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 p-6">
              <Textarea
                value={selectedNote.content}
                onChange={(e) => updateNote({ content: e.target.value })}
                className="w-full h-full resize-none border-none shadow-none focus-visible:ring-0 text-lg leading-relaxed bg-transparent text-muted-foreground focus:text-white placeholder:text-muted-foreground/50"
                placeholder="Start typing..."
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <p className="text-lg mb-2">Select a note or create a new one</p>
            <p className="text-sm opacity-60">
              Press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">Ctrl+B</kbd> to create a new note
            </p>
          </div>
        )}
      </div>

      <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A nota será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (noteToDelete) deleteNote(noteToDelete)
                setNoteToDelete(null)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
