"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Edit2, Save, X, Calendar, Pencil, CheckSquare, Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import {
  createRawCalendarEvent,
  deleteGoogleCalendarEvent as deleteCalendarEvent,
  listGoogleCalendarEvents as listCalendarEvents,
  patchGoogleCalendarEvent,
} from "@/lib/google-calendar"
import { syncScheduleToCalendar as syncScheduleToCalendarUtil } from "@/lib/schedule-utils"
import { apiFetch } from "@/lib/api"

export interface Activity {
  id: string
  title: string
  description?: string
  day_of_week: number // 0-6 (Sunday-Saturday)
  start_time?: string // HH:mm
  end_time?: string // HH:mm
  completed_dates: string[] // ISO date strings (YYYY-MM-DD)
  recurrence?: 'daily' | 'weekly' | 'none'
  googleEventId?: string
}

export interface Schedule {
  id: string
  title: string
  activities: Activity[]
  created_at: string
}

const DAYS_OF_WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

const DAYS_OF_WEEK_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

export function SchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [newScheduleTitle, setNewScheduleTitle] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [activityToDelete, setActivityToDelete] = useState<string | null>(null)
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [activityForm, setActivityForm] = useState({
    title: "",
    description: "",
    day_of_week: 0,
    start_time: "",
    end_time: "",
    recurrence: "none"
  })

  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [showToast, setShowToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const toast = (message: string, type: "success" | "error" = "success") => {
    setShowToast({ message, type })
    setTimeout(() => setShowToast(null), 3000)
  }

  const router = useRouter()

  useEffect(() => {
    loadSchedules()

    const handleSchedulesUpdated = () => {
      loadSchedules()
    }

    window.addEventListener("schedules-updated", handleSchedulesUpdated)
    return () => window.removeEventListener("schedules-updated", handleSchedulesUpdated)
  }, [])

  const loadSchedules = async () => {
    try {
      setLoading(true)
      const data = await apiFetch("/data/schedules")
      if (Array.isArray(data)) {
        setSchedules(data)
        if (data.length > 0 && !selectedScheduleId) {
          setSelectedScheduleId(data[0].id)
        }
      }
    } catch (error) {
      console.error("Error loading schedules:", error)
    } finally {
      setLoading(false)
    }
  }
  const createSchedule = async () => {
    if (!newScheduleTitle.trim()) return

    try {
      setLoading(true)

      const newSchedule: Schedule = {
        id: crypto.randomUUID(),
        title: newScheduleTitle,
        activities: [],
        created_at: new Date().toISOString(),
      }; // Save to backend
      await apiFetch("/data/schedules", {
        method: "POST",
        body: JSON.stringify(newSchedule)
      })

      await loadSchedules()
      setSelectedScheduleId(newSchedule.id)
      setNewScheduleTitle("")
      setIsCreateDialogOpen(false)
    } catch (error) {
      console.error("Error in createSchedule:", error)
      toast("Erro ao criar cronograma. Tente novamente.", "error")
    } finally {
      setLoading(false)
    }
  }
  const openAddActivity = (dayOfWeek: number) => {
    setEditingActivityId(null)
    setActivityForm({
      title: "",
      description: "",
      day_of_week: dayOfWeek,
      start_time: "",
      end_time: "",
      recurrence: "none" as 'daily' | 'weekly' | 'none',
    })
    setIsActivityDialogOpen(true)
  }
  const openEditActivity = (activity: Activity) => {
    setEditingActivityId(activity.id)
    setActivityForm({
      title: activity.title,
      description: activity.description || "",
      day_of_week: activity.day_of_week,
      start_time: activity.start_time || "",
      end_time: activity.end_time || "",
      recurrence: activity.recurrence || "daily"
    })
    setIsActivityDialogOpen(true)
  }
  const saveActivity = async () => {
    if (!activityForm.title.trim()) return

    try {
      let activityToSync: Activity | null = null
      let updatedActivities: Activity[] = []

      const currentSchedule = schedules.find(s => s.id === selectedScheduleId)
      const currentActivities = currentSchedule ? currentSchedule.activities : []

      if (editingActivityId) {
        // Find existing activity
        const existingActivity = currentActivities.find(a => a.id === editingActivityId)
        if (existingActivity) {
          activityToSync = {
            ...existingActivity,
            title: activityForm.title.trim(),
            description: activityForm.description.trim() || "",
            day_of_week: activityForm.day_of_week,
            start_time: activityForm.start_time || "",
            end_time: activityForm.end_time || "",
            recurrence: (activityForm.recurrence as 'daily' | 'weekly' | 'none') || 'none',
          }
          updatedActivities = currentActivities.map(a => a.id === editingActivityId ? activityToSync! : a)
        }
      } else {
        // Create new activity
        activityToSync = {
          id: crypto.randomUUID(),
          title: activityForm.title.trim(),
          description: activityForm.description.trim() || "",
          day_of_week: activityForm.day_of_week,
          start_time: activityForm.start_time || "",
          end_time: activityForm.end_time || "",
          completed_dates: [],
          recurrence: (activityForm.recurrence as 'daily' | 'weekly' | 'none') || 'none',
        }
        updatedActivities = [...currentActivities, activityToSync]
      }

      if (!activityToSync) return // Should not happen

      updatedActivities.sort((a, b) => a.day_of_week - b.day_of_week)

      // Sincroniza com Google Agenda
      if (activityToSync) {
        // Calcula horários de início e fim
        const now = new Date()
        const dayOfWeek = now.getDay()
        const daysToAdd = (activityToSync.day_of_week - dayOfWeek + 7) % 7

        const startDate = new Date(now)
        startDate.setDate(now.getDate() + daysToAdd)

        const endDate = new Date(startDate)

        if (activityToSync.start_time) {
          const [hours, minutes] = activityToSync.start_time.split(':').map(Number)
          startDate.setHours(hours, minutes, 0, 0)

          if (activityToSync.end_time) {
            const [endHours, endMinutes] = activityToSync.end_time.split(':').map(Number)
            endDate.setHours(endHours, endMinutes, 0, 0)
          } else {
            endDate.setHours(hours + 1, minutes, 0, 0) // Duração padrão de 1 hora
          }
        } else {
          // Dia todo ou horário padrão
          startDate.setHours(9, 0, 0, 0)
          endDate.setHours(10, 0, 0, 0)
        }

        if (editingActivityId && activityToSync.googleEventId) {
          // Tenta atualizar evento existente
          const success = await patchGoogleCalendarEvent(activityToSync.googleEventId, {
            summary: activityToSync.title,
            description: activityToSync.description,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString()
          })

          if (!success) {
            console.warn("Falha ao atualizar, recriando evento")
            // Se falhar, deleta e cria de novo
            await deleteCalendarEvent(activityToSync.googleEventId)
            const eventId = await createRawCalendarEvent({
              summary: activityToSync.title,
              description: activityToSync.description,
              start_time: startDate.toISOString(),
              end_time: endDate.toISOString(),
              recurrence: activityToSync.recurrence === 'weekly' ? ['RRULE:FREQ=WEEKLY'] : undefined
            })
            if (eventId) activityToSync.googleEventId = eventId
          }
        } else {
          // Cria novo evento
          const eventId = await createRawCalendarEvent({
            summary: activityToSync.title,
            description: activityToSync.description,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            recurrence: activityToSync.recurrence === 'weekly' ? ['RRULE:FREQ=WEEKLY'] : undefined
          })

          if (eventId) {
            activityToSync.googleEventId = eventId
          }
        }

        // Atualiza atividade com ID do evento
        if (activityToSync.googleEventId) {
          const syncedActivity = activityToSync // Capture for closure
          updatedActivities = updatedActivities.map(a => a.id === syncedActivity.id ? syncedActivity : a)
        }
      }

      if (selectedScheduleId) {
        const scheduleToUpdate = schedules.find(s => s.id === selectedScheduleId)
        if (scheduleToUpdate) {
          const updatedSchedule = { ...scheduleToUpdate, activities: updatedActivities }

          // Optimistic update
          setSchedules(prev => prev.map(s => s.id === selectedScheduleId ? updatedSchedule : s))

          await apiFetch("/data/schedules", {
            method: "POST",
            body: JSON.stringify(updatedSchedule)
          })
        }
      }

      setIsActivityDialogOpen(false)
      setEditingActivityId(null)
      setActivityForm({
        title: "",
        description: "",
        day_of_week: 0,
        start_time: "",
        end_time: "",
        recurrence: "none",
      })
    } catch (error) {
      console.error("Error saving activity:", error)
      toast("Erro ao salvar atividade. Tente novamente.", "error")
    }
  }
  const deleteActivity = async (activityId: string) => {
    try {
      const scheduleToUpdate = schedules.find(s => s.id === selectedScheduleId)
      if (!scheduleToUpdate) return

      const activityToDelete = scheduleToUpdate.activities.find(a => a.id === activityId)

      // Auto-delete from Google Calendar
      if (activityToDelete?.googleEventId) {
        await deleteCalendarEvent(activityToDelete.googleEventId)
      }

      const updatedActivities = scheduleToUpdate.activities.filter((a) => a.id !== activityId)
      const updatedSchedule = { ...scheduleToUpdate, activities: updatedActivities }

      await apiFetch("/data/schedules", {
        method: "POST",
        body: JSON.stringify(updatedSchedule)
      })

      await loadSchedules()
      setActivityToDelete(null)
    } catch (error) {
      console.error("Error deleting activity:", error)
      toast("Erro ao excluir atividade.", "error")
      setActivityToDelete(null)
    }
  }
  const deleteSchedule = async (scheduleId: string) => {
    try {
      const schedule = schedules.find(s => s.id === scheduleId)

      // Auto-delete all activities from Google Calendar
      if (schedule) {
        for (const activity of schedule.activities) {
          if (activity.googleEventId) {
            await deleteCalendarEvent(activity.googleEventId)
          }
        }
      }

      await apiFetch(`/data/schedules/${scheduleId}`, {
        method: "DELETE"
      })

      await loadSchedules()
      if (selectedScheduleId === scheduleId) {
        const remaining = schedules.filter(s => s.id !== scheduleId)
        setSelectedScheduleId(remaining.length > 0 ? remaining[0].id : null)
      }
      setScheduleToDelete(null)
    } catch (error) {
      console.error("Error deleting schedule:", error)
    }
  }
  const toggleActivity = async (activityId: string, date: Date) => {
    const dateStr = date.toISOString().split("T")[0]
    const scheduleToUpdate = schedules.find(s => s.activities.some(a => a.id === activityId))

    if (!scheduleToUpdate) return

    const updatedActivities = scheduleToUpdate.activities.map((a) => {
      if (a.id !== activityId) return a

      const isCompleted = a.completed_dates.includes(dateStr)
      const newCompletedDates = isCompleted
        ? a.completed_dates.filter((d) => d !== dateStr)
        : [...a.completed_dates, dateStr]

      return { ...a, completed_dates: newCompletedDates }
    })

    const updatedSchedule = { ...scheduleToUpdate, activities: updatedActivities }

    try {
      // Optimistic update
      setSchedules(prev => prev.map(s => s.id === updatedSchedule.id ? updatedSchedule : s))

      await apiFetch("/data/schedules", {
        method: "POST",
        body: JSON.stringify(updatedSchedule)
      })
    } catch (error) {
      console.error("Error toggling activity:", error)
      loadSchedules() // Revert on error
    }
  }
  const startEditingSchedule = (schedule: Schedule) => {
    setEditingScheduleId(schedule.id)
    setEditingTitle(schedule.title)
  }
  const saveScheduleEdit = async () => {
    if (!editingScheduleId || !editingTitle.trim()) return

    try {
      const scheduleToUpdate = schedules.find(s => s.id === editingScheduleId)
      if (!scheduleToUpdate) return

      const updatedSchedule = { ...scheduleToUpdate, title: editingTitle.trim() }

      await apiFetch("/data/schedules", {
        method: "POST",
        body: JSON.stringify(updatedSchedule)
      })

      await loadSchedules()
      setEditingScheduleId(null)
      setEditingTitle("")
    } catch (error) {
      console.error("Error updating schedule:", error)
    }
  }
  const cancelScheduleEdit = () => {
    setEditingScheduleId(null)
    setEditingTitle("")
  }

  const syncScheduleToCalendar = async (e?: React.MouseEvent, manualStartDate?: string, manualEndDate?: string) => {
    if (e) e.preventDefault()

    // Use passed dates or default to next 7 days
    let start = manualStartDate
    let end = manualEndDate

    if (!start || !end) {
      const now = new Date()
      start = now.toISOString().split('T')[0]
      const nextWeek = new Date(now)
      nextWeek.setDate(now.getDate() + 7)
      end = nextWeek.toISOString().split('T')[0]
    }

    if (!selectedScheduleId) return
    const schedule = schedules.find(s => s.id === selectedScheduleId)
    if (!schedule) return

    setLoading(true)

    try {
      const success = await syncScheduleToCalendarUtil(schedule, start, end)

      if (success) {
        await loadSchedules()
        toast("Cronograma sincronizado com o Google Agenda!", "success")
      } else {
        toast("Erro ao sincronizar cronograma.", "error")
      }

    } catch (error) {
      console.error("Error syncing schedule:", error)
      toast("Erro ao sincronizar cronograma.", "error")
    } finally {
      setLoading(false)
    }
  }
  const getActivitiesForDay = (schedule: Schedule, dayOfWeek: number) => {
    return schedule.activities.filter((a) => a.day_of_week === dayOfWeek)
  }
  const getDailyProgress = (schedule: Schedule, dayOfWeek: number) => {
    const activities = getActivitiesForDay(schedule, dayOfWeek)
    if (activities.length === 0) return 0

    const today = new Date().toISOString().split("T")[0]
    const completed = activities.filter((a) => a.completed_dates.includes(today)).length
    return (completed / activities.length) * 100
  }
  const getWeeklyProgress = (schedule: Schedule) => {
    if (!schedule || schedule.activities.length === 0) return 0

    const today = new Date().toISOString().split("T")[0]
    const completed = schedule.activities.filter((a) => a.completed_dates.includes(today)).length
    return (completed / schedule.activities.length) * 100
  }

  const selectedSchedule = schedules.find((s) => s.id === selectedScheduleId)

  if (loading && schedules.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Carregando cronogramas...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background relative">
      {showToast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg transition-all transform ${showToast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}
        >
          {showToast.message}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <Calendar className="h-6 w-6 text-primary" />
              {schedules.length > 0 ? (
                <Select value={selectedScheduleId || undefined} onValueChange={setSelectedScheduleId}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Selecione um cronograma" />
                  </SelectTrigger>
                  <SelectContent>
                    {schedules.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {schedule.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <h1 className="text-2xl font-bold">Cronogramas</h1>
              )}

              {selectedSchedule && editingScheduleId !== selectedSchedule.id && (
                <Button size="sm" variant="ghost" onClick={() => startEditingSchedule(selectedSchedule)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}

              {editingScheduleId === selectedSchedule?.id && (
                <div className="flex items-center gap-2">
                  <Input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") saveScheduleEdit()
                      if (e.key === "Escape") cancelScheduleEdit()
                    }}
                    className="w-[250px]"
                    autoFocus
                  />
                  <Button size="sm" onClick={saveScheduleEdit}>
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelScheduleEdit}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo Cronograma
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {selectedSchedule && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setScheduleToDelete(selectedSchedule.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  <AlertDialog open={!!scheduleToDelete} onOpenChange={(open) => !open && setScheduleToDelete(null)}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir cronograma?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. Isso excluirá permanentemente o cronograma "
                          {schedules.find((s) => s.id === scheduleToDelete)?.title}" e todas as suas atividades.
                          Também removerá todas as tarefas associadas do Google Tasks.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => scheduleToDelete && deleteSchedule(scheduleToDelete)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>

          {!loading && schedules.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground mb-4">Nenhum cronograma criado ainda</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Cronograma
              </Button>
            </Card>
          ) : null}

          {selectedSchedule && (
            <div className="space-y-6">
              {/* Weekly Progress - Removed as requested */}

              {/* Calendar Grid */}
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4 h-full min-h-0">
                {DAYS_OF_WEEK.map((day, index) => {
                  const dayActivities = selectedSchedule.activities.filter((a) => a.day_of_week === index)
                  // Sort by time
                  dayActivities.sort((a, b) => {
                    if (!a.start_time) return -1
                    if (!b.start_time) return 1
                    return a.start_time.localeCompare(b.start_time)
                  })

                  const progress = getDailyProgress(selectedSchedule, index)
                  const today = new Date()

                  return (
                    <Card key={index} className="overflow-hidden flex flex-col h-full min-h-[300px]">
                      {/* Day Header */}
                      <div className="p-4 border-b border-border bg-muted/30">
                        <div className="text-center relative group/header">
                          <div className="font-semibold text-lg">{day}</div>
                          <div className="text-xs text-muted-foreground mt-1">{DAYS_OF_WEEK_FULL[index]}</div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-0 right-0 h-6 w-6 opacity-0 group-hover/header:opacity-100 transition-opacity"
                            onClick={() => openAddActivity(index)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Activities List */}
                      <div className="flex-1 p-3 space-y-2 overflow-y-auto scrollbar-hide">
                        {dayActivities.length === 0 ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            Sem atividades
                            <Button
                              variant="link"
                              className="h-auto p-0 text-xs mt-2 block mx-auto"
                              onClick={() => openAddActivity(index)}
                            >
                              Adicionar
                            </Button>
                          </div>
                        ) : (
                          dayActivities.map((activity) => {
                            // const isCompleted = activity.completed_dates.includes(today.toISOString().split("T")[0]) // Removed completion logic

                            return (
                              <div
                                key={activity.id}
                                className="group relative bg-card border border-border rounded-md p-2 hover:shadow-sm transition-shadow"
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate text-white">
                                      {activity.title}
                                    </div>
                                    {activity.start_time && (
                                      <div className="text-xs text-muted-foreground mt-0.5">
                                        {activity.start_time}
                                        {activity.end_time ? ` - ${activity.end_time}` : ""}
                                      </div>
                                    )}
                                    {activity.recurrence && activity.recurrence !== "none" && (
                                      <div className="text-[10px] text-primary mt-0.5 uppercase font-bold">
                                        {activity.recurrence === "weekly" ? "Semanal" : "Diário"}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Edit/Delete Overlay */}
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-card/80 backdrop-blur-sm rounded">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => openEditActivity(activity)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                    onClick={() => setActivityToDelete(activity.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>

                      {/* Day Footer */}
                      <div className="p-2 border-t border-border bg-muted/20 text-center text-xs text-muted-foreground">
                        {dayActivities.length} {dayActivities.length === 1 ? "atividade" : "atividades"}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div >

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Cronograma</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newScheduleTitle}
              onChange={(e) => setNewScheduleTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  createSchedule()
                }
              }}
              placeholder="Nome do cronograma..."
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={createSchedule} disabled={loading}>
                {loading ? "Criando..." : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingActivityId ? "Editar Atividade" : "Nova Atividade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={activityForm.title}
                onChange={(e) => setActivityForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Estudar Matemática"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={activityForm.description}
                onChange={(e) => setActivityForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Detalhes da atividade..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dia da Semana</Label>
                <Select
                  value={activityForm.day_of_week.toString()}
                  onValueChange={(v) => setActivityForm((prev) => ({ ...prev, day_of_week: Number.parseInt(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK_FULL.map((day, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input
                  type="time"
                  value={activityForm.start_time}
                  onChange={(e) => setActivityForm((prev) => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input
                  type="time"
                  value={activityForm.end_time}
                  onChange={(e) => setActivityForm((prev) => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivityDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveActivity}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!activityToDelete} onOpenChange={(open) => !open && setActivityToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente esta atividade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => activityToDelete && deleteActivity(activityToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div >
  )
}
