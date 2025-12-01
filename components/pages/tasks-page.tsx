"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, ListTodo, Pencil, Copy, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { AICommandCallbacks } from "@/components/app-layout"

interface Task {
  id: string
  title: string
  completed: boolean
  created_at: string
}

import {
  createGoogleTask,
  listGoogleTasks,
  updateGoogleTask,
  deleteGoogleTask
} from "@/lib/google-tasks"

interface TasksPageProps {
  commandCallbacks?: React.MutableRefObject<AICommandCallbacks>
  userId: string
}

export function TasksPage({ commandCallbacks, userId }: TasksPageProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState("")
  const [newTaskDue, setNewTaskDue] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all")
  const [isLoading, setIsLoading] = useState(true)
  const [showToast, setShowToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const toast = (message: string, type: "success" | "error" = "success") => {
    setShowToast({ message, type })
    setTimeout(() => setShowToast(null), 3000)
  }

  const fetchTasks = useCallback(async () => {
    try {
      const googleTasks = await listGoogleTasks()
      // Mapeia tarefas do Google para nossa interface Task
      const mappedTasks: Task[] = googleTasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        completed: t.status === 'completed',
        created_at: new Date().toISOString() // Carrega tarefas do Google Tasks
      }))
      setTasks(mappedTasks)
    } catch (error) {
      console.error("Erro ao carregar tarefas:", error)
      toast("Erro ao carregar tarefas.", "error")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "tasks") {
        // Fallback or ignore? 
        // We might want to listen to a custom event for backend sync updates if we implement that.
        // For now, let's keep it simple.
      }
    }

    const handleCustomUpdate = () => {
      fetchTasks()
    }

    window.addEventListener("tasks-updated", handleCustomUpdate)

    return () => {
      window.removeEventListener("tasks-updated", handleCustomUpdate)
    }
  }, [fetchTasks])

  const clearCompleted = async () => {
    try {
      const completedTasks = tasks.filter((task) => task.completed)
      for (const task of completedTasks) {
        await deleteGoogleTask(task.id)
      }
      await fetchTasks()
      toast("Metas completadas removidas")
    } catch (error) {
      console.error("Error clearing completed tasks:", error)
      toast("Erro ao limpar metas", "error")
    }
  }

  // Removed commandCallbacks override to allow AppLayout to handle data persistence


  const addTask = async () => {
    if (!newTask.trim()) return

    // Optimistic update
    const tempId = crypto.randomUUID()
    const newTaskObj: Task = {
      id: tempId,
      title: newTask.trim(),
      completed: false,
      created_at: new Date().toISOString(),
    }
    setTasks([newTaskObj, ...tasks])
    setNewTask("")
    setNewTaskDue("")

    try {
      const payload: any = {
        title: newTaskObj.title,
        status: "needsAction"
      }

      if (newTaskDue) {
        // Ensure RFC 3339 format with Z or offset
        // For date-only input, value is YYYY-MM-DD. Append T00:00:00Z to make it RFC3339
        const dateStr = `${newTaskDue}T00:00:00Z`
        payload.due = dateStr
      }

      const taskId = await createGoogleTask(payload)

      if (taskId) {
        // Update with real ID
        setTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: taskId } : t))
        toast("Meta adicionada com sucesso")
      } else {
        throw new Error("Failed to create task")
      }
    } catch (error) {
      console.error("Error adding task:", error)
      toast("Erro ao adicionar meta", "error")
      // Revert optimistic update
      setTasks(prev => prev.filter(t => t.id !== tempId))
    }
  }

  const toggleTask = async (id: string, currentStatus: boolean) => {
    // Optimistic update
    const updatedTasks = tasks.map((task) => (task.id === id ? { ...task, completed: !currentStatus } : task))
    setTasks(updatedTasks)

    try {
      const success = await updateGoogleTask(id, {
        status: !currentStatus ? "completed" : "needsAction"
      })

      if (!success) {
        throw new Error("Failed to update task")
      }
    } catch (error) {
      console.error("Error updating task:", error)
      // Revert
      fetchTasks()
    }
  }

  const deleteTask = async (id: string) => {
    // Optimistic update
    const updatedTasks = tasks.filter((task) => task.id !== id)
    setTasks(updatedTasks)

    try {
      const success = await deleteGoogleTask(id)
      if (!success) throw new Error("Failed to delete task")
    } catch (error) {
      console.error("Error deleting task:", error)
      fetchTasks() // Revert
    }
  }

  const filteredTasks = tasks.filter((task) => {
    if (filter === "active") return !task.completed
    if (filter === "completed") return task.completed
    return true
  })

  const stats = {
    total: tasks.length,
    active: tasks.filter((t) => !t.completed).length,
    completed: tasks.filter((t) => t.completed).length,
  }

  return (
    <div className="w-full h-full p-6 relative">
      {showToast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg transition-all transform ${showToast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}
        >
          {showToast.message}
        </div>
      )}

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Metas</h1>
          <div className="flex items-center gap-2">

          </div>
        </div>

        {/* Add Task Input */}
        <div className="flex gap-2">
          <Input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addTask()
              }
            }}
            placeholder="O que precisa ser feito?"
            className="flex-1 h-12 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground rounded-lg"
          />
          <Input
            type="date"
            value={newTaskDue}
            onChange={(e) => setNewTaskDue(e.target.value)}
            className="w-48 h-12 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground rounded-lg"
          />
          <Button
            onClick={addTask}
            className="h-12 px-6 bg-white/10 text-white hover:bg-white/20"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>

        <div className="flex p-1 bg-white/5 rounded-lg">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === "all" ? "bg-black text-white" : "text-muted-foreground hover:text-white"
              }`}
          >
            Todas ({stats.total})
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === "active" ? "bg-black text-white" : "text-muted-foreground hover:text-white"
              }`}
          >
            Ativas ({stats.active})
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === "completed" ? "bg-black text-white" : "text-muted-foreground hover:text-white"
              }`}
          >
            Completas ({stats.completed})
          </button>
        </div>

        {/* Task List */}
        <div className="space-y-1">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando metas...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <ListTodo className="h-8 w-8 opacity-50" />
              </div>
              <p className="font-medium">Nenhuma meta ainda</p>
              <p className="text-sm opacity-60">Adicione sua primeira meta para começar</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className="group flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => toggleTask(task.id, task.completed)}
                  className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black"
                />
                <div className="flex-1 min-w-0">
                  <span
                    className={`block text-sm truncate ${task.completed ? "line-through text-muted-foreground" : "text-white"
                      }`}
                  >
                    {task.title}
                  </span>
                  <span className="text-xs text-muted-foreground">Hoje</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-4 mt-4">
          <div className="px-3 py-1 rounded border border-white/10 text-xs text-white">{stats.total} total</div>
          <div className="px-3 py-1 rounded border border-white/10 text-xs text-white">
            {stats.completed} completadas
          </div>
        </div>
      </div>
    </div>
  )
}
