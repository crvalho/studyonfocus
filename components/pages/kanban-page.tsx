"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Plus, Trash2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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

interface KanbanTask {
  id: string
  title: string
  column: string
}

interface Column {
  id: string
  title: string
}

const defaultColumns: Column[] = [
  { id: "todo", title: "A Fazer" },
  { id: "in-progress", title: "Em Progresso" },
  { id: "done", title: "Concluído" },
]

import { loadFromFirestore, syncToFirestore } from "@/lib/firestore-sync"

interface KanbanPageProps {
  userId: string
}

export function KanbanPage({ userId }: KanbanPageProps) {
  const [tasks, setTasks] = useState<KanbanTask[]>([])
  const [newTaskColumn, setNewTaskColumn] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [draggedTask, setDraggedTask] = useState<string | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const data = await loadFromFirestore(userId, "kanban-tasks")
        if (data && data.tasks) {
          setTasks(data.tasks)
        } else {
          setTasks([])
        }
      } catch (error) {
        console.error("Erro ao carregar kanban:", error)
      }
    }

    loadTasks()

    const handleKanbanUpdated = () => {
      loadTasks()
    }

    window.addEventListener("kanban-updated", handleKanbanUpdated)
    return () => window.removeEventListener("kanban-updated", handleKanbanUpdated)
  }, [userId])

  // We don't auto-save on every change with useEffect anymore to avoid race conditions or excessive writes.
  // Instead we save on specific actions.

  // Salva tarefas no Firestore
  const saveTasks = async (newTasks: KanbanTask[]) => {
    try {
      await syncToFirestore(userId, "kanban-tasks", { tasks: newTasks })
    } catch (error) {
      console.error("Erro ao salvar kanban:", error)
    }
  }

  const addTask = async (columnId: string) => {
    if (!newTaskTitle.trim()) return

    const task: KanbanTask = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      column: columnId,
    }

    const updatedTasks = [...tasks, task]
    setTasks(updatedTasks)
    setNewTaskTitle("")
    setNewTaskColumn(null)

    saveTasks(updatedTasks)
  }

  const deleteTask = async (id: string) => {
    const updatedTasks = tasks.filter((task) => task.id !== id)
    setTasks(updatedTasks)
    saveTasks(updatedTasks)
  }

  const moveTask = async (taskId: string, newColumn: string) => {
    const updatedTasks = tasks.map((task) => (task.id === taskId ? { ...task, column: newColumn } : task))
    setTasks(updatedTasks)
    saveTasks(updatedTasks)
  }

  const handleDragStart = (taskId: string) => {
    setDraggedTask(taskId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (columnId: string) => {
    if (draggedTask) {
      moveTask(draggedTask, columnId)
      setDraggedTask(null)
    }
  }

  return (
    <div className="w-full h-full p-6">
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Kanban</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-0">
          {defaultColumns.map((column) => {
            const columnTasks = tasks.filter((task) => task.column === column.id)

            return (
              <div key={column.id} className="flex flex-col h-full min-h-0 bg-transparent rounded-xl">
                <div className="mb-4 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg text-white">{column.title}</h2>
                    <span className="text-sm text-muted-foreground">({columnTasks.length})</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-white/10 rounded-full"
                    onClick={() => setNewTaskColumn(column.id)}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>

                <div
                  className="flex-1 rounded-xl space-y-3 overflow-y-auto pr-2"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(column.id)}
                >
                  {newTaskColumn === column.id && (
                    <Card className="p-3 bg-blue-950/40 border-blue-500/20 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                      <Input
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && addTask(column.id)}
                        placeholder="Nome da tarefa..."
                        autoFocus
                        className="mb-3 bg-black/40 border-white/10 text-white placeholder:text-muted-foreground focus-visible:ring-white/20"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setNewTaskColumn(null)
                            setNewTaskTitle("")
                          }}
                          className="text-muted-foreground hover:text-white hover:bg-white/10 h-8"
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => addTask(column.id)}
                          className="bg-blue-600 text-white hover:bg-blue-500 h-8"
                        >
                          Adicionar
                        </Button>
                      </div>
                    </Card>
                  )}

                  {columnTasks.map((task) => (
                    <Card
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      className={cn(
                        "p-4 cursor-move bg-blue-950/20 border-blue-500/10 hover:border-blue-500/30 hover:bg-blue-900/20 transition-all group relative shadow-sm",
                        draggedTask === task.id && "opacity-50 ring-2 ring-blue-500/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm text-white/90 leading-relaxed font-medium">{task.title}</span>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                            onClick={() => setTaskToDelete(task.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-white"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-40 bg-[#0f172a] border-blue-500/20 text-white"
                            >
                              <DropdownMenuItem
                                onSelect={() => {
                                  // Trigger the alert dialog from the direct button if possible, 
                                  // or just duplicate the logic. 
                                  // For simplicity, let's keep the dropdown as an alternative move menu
                                  // and remove delete from here to avoid duplication/confusion, 
                                  // OR keep it. Let's keep it but simpler.
                                }}
                                onClick={() => setTaskToDelete(task.id)}
                                className="text-red-400 focus:text-red-400 focus:bg-red-400/10 cursor-pointer"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir (Direto)
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </Card>
                  ))}

                  {columnTasks.length === 0 && !newTaskColumn && (
                    <div className="h-24 border-2 border-dashed border-blue-500/10 rounded-xl flex items-center justify-center text-blue-200/20 text-sm"></div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>



      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tarefa será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (taskToDelete) deleteTask(taskToDelete)
                setTaskToDelete(null)
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
