"use client"

import { useState, useEffect, useRef } from "react"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { Navbar } from "@/components/navbar"
import { AIChat } from "@/components/ai-chat"
import { TasksPage } from "@/components/pages/tasks-page"
import { KanbanPage } from "@/components/pages/kanban-page"
import { SchedulePage } from "@/components/pages/schedule-page"
import { FocusTimerPage } from "@/components/pages/focus-timer-page"
import { NotesPage } from "@/components/pages/notes-page"
import { YouTubePlayerPage } from "@/components/pages/youtube-player-page"
import { InsightsPage } from "@/components/pages/insights-page"
import { ProcrastinationAlarm } from "@/components/procrastination-alarm"
import { FloatingWindow } from "@/components/floating-window"
import { AlarmToast } from "@/components/ui/alarm-toast" // Import AlarmToast
import { UserProfileMenu } from "@/components/user-profile-menu"
import { syncToFirestore, loadFromFirestore } from "@/lib/firestore-sync"
import { apiFetch } from "@/lib/api"
import { createGoogleTask, deleteGoogleTask, listGoogleTasks } from "@/lib/google-tasks"

export type PageType = ToolType | ViewMode
export type ToolType = "tasks" | "kanban" | "focus-timer" | "notes" | "youtube-player"
export type ViewMode = "chat" | "schedules"

export interface AICommandCallbacks {
  createTask?: (title: string) => void
  deleteTask?: (titleOrId: string) => void
  createKanbanItem?: (title: string, column?: string) => void
  moveKanbanItem?: (titleOrId: string, newColumn: string) => void
  startTimer?: (minutes?: number) => void
  loadYouTubeVideo?: (url: string) => void
  pauseTimer?: () => void
  stopTimer?: () => void
  setTimerMode?: (mode: TimerMode, start?: boolean) => void
  setAlarm?: (enabled: boolean, minutes: number) => void
  createSchedule?: (schedule: any) => void
  addActivitiesToSchedule?: (activities: any[]) => void
  createManualAlarm?: (title: string, minutes: number) => void
  toggleTimerLoop?: (enabled: boolean) => void
}

interface FloatingWindowState {
  id: PageType
  position: { x: number; y: number }
  size: { width: number; height: number }
  isMinimized: boolean
  zIndex: number
}

type TimerMode = "pomodoro" | "short" | "long" | "custom"

interface TimerState {
  mode: TimerMode
  minutes: number
  seconds: number
  isRunning: boolean
  sessionLength: number
  shortBreak: number
  longBreak: number
  customMinutes: number
  sessionsCompleted: number
  isBreak: boolean
  loopEnabled: boolean
}

interface ManualAlarm {
  id: string
  title: string
  triggerTime: number
  isTriggered: boolean
}

interface AppLayoutProps {
  user: {
    displayName: string | null
    photoURL: string | null
    email: string | null
    uid: string // Added uid to props
  }
  onSignOut: () => void
}

export function AppLayout({ user, onSignOut }: AppLayoutProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("chat")
  const [openWindows, setOpenWindows] = useState<FloatingWindowState[]>([])
  const [topZIndex, setTopZIndex] = useState(1000)
  const commandCallbacksRef = useRef<AICommandCallbacks>({})

  const [alarmEnabled, setAlarmEnabled] = useState(false)
  const [alarmTimeoutMinutes, setAlarmTimeoutMinutes] = useState(5)
  const [showAlarm, setShowAlarm] = useState(false)
  const [lastActivityTime, setLastActivityTime] = useState(Date.now())
  const alarmTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  const [timerState, setTimerState] = useState<TimerState>({
    mode: "pomodoro",
    minutes: 25,
    seconds: 0,
    isRunning: false,
    sessionLength: 25,
    shortBreak: 5,
    longBreak: 45,
    customMinutes: 15,
    sessionsCompleted: 0,
    isBreak: false,
    loopEnabled: false,
  })
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [manualAlarms, setManualAlarms] = useState<ManualAlarm[]>([])

  const alarmAudioRef = useRef<HTMLAudioElement | null>(null) // Ref for alarm audio

  useEffect(() => {
    const loadAlarms = async () => {
      try {
        const data = await loadFromFirestore(user.uid, "manual-alarms")
        if (data && data.alarms) {
          setManualAlarms(data.alarms)
        }
      } catch (error) {
        console.error("Error loading manual alarms:", error)
      }
    }
    loadAlarms()
  }, [user.uid])

  useEffect(() => {
    const syncAlarms = async () => {
      try {
        await syncToFirestore(user.uid, "manual-alarms", { alarms: manualAlarms })
      } catch (error) {
        console.error("Error syncing manual alarms:", error)
      }
    }

    if (manualAlarms.length > 0) {
      const timeoutId = setTimeout(syncAlarms, 1000)
      return () => clearTimeout(timeoutId)
    }
  }, [manualAlarms, user.uid])

  const playTimerSound = () => {
    const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg")
    audio.loop = true
    audio.play().catch((e) => console.error("Error playing sound:", e))

    setTimeout(() => {
      audio.pause()
      audio.currentTime = 0
    }, 3000)
  }

  useEffect(() => {
    if (timerState.isRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerState((prev) => {
          let newSeconds = prev.seconds - 1
          let newMinutes = prev.minutes

          if (newSeconds < 0) {
            if (newMinutes === 0) {
              playTimerSound()

              if ("Notification" in window && Notification.permission === "granted") {
                new Notification(prev.isBreak ? "Pausa Completa!" : "Sessão de Foco Completa!", {
                  body: prev.isBreak ? "Hora de voltar ao trabalho!" : "Ótimo trabalho! Hora de uma pausa.",
                })
              }

              if (prev.isBreak) {
                // Pausa completa, voltar para sessão de trabalho
                return {
                  ...prev,
                  minutes: prev.sessionLength,
                  seconds: 0,
                  isBreak: false,
                  isRunning: prev.loopEnabled, // Continua rodando se loop está ativado
                }
              } else {
                // Sessão de trabalho completa, iniciar pausa
                const newCount = prev.mode === "pomodoro" ? prev.sessionsCompleted + 1 : prev.sessionsCompleted
                const breakLength = newCount % 4 === 0 ? prev.longBreak : prev.shortBreak
                return {
                  ...prev,
                  minutes: breakLength,
                  seconds: 0,
                  sessionsCompleted: newCount,
                  isBreak: true,
                  isRunning: prev.loopEnabled, // Continua rodando se loop está ativado
                }
              }
            }
            newMinutes -= 1
            newSeconds = 59
          }

          return {
            ...prev,
            minutes: newMinutes,
            seconds: newSeconds,
          }
        })
      }, 1000)
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [timerState.isRunning])

  useEffect(() => {
    const resetActivity = () => {
      setLastActivityTime(Date.now())
      setShowAlarm(false)
    }

    const events = ["mousedown", "keydown", "scroll", "touchstart"]
    events.forEach((event) => {
      window.addEventListener(event, resetActivity)
    })

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, resetActivity)
      })
    }
  }, [])

  useEffect(() => {
    if (!alarmEnabled) {
      setRemainingSeconds(0)
      if (alarmTimerRef.current) {
        clearInterval(alarmTimerRef.current)
        alarmTimerRef.current = null
      }
      return
    }

    alarmTimerRef.current = setInterval(() => {
      const inactiveTime = Date.now() - lastActivityTime
      const thresholdMs = alarmTimeoutMinutes * 60 * 1000
      const remaining = Math.max(0, Math.floor((thresholdMs - inactiveTime) / 1000))

      setRemainingSeconds(remaining)

      if (remaining === 0) {
        setShowAlarm(true)
      }
    }, 1000)

    return () => {
      if (alarmTimerRef.current) {
        clearInterval(alarmTimerRef.current)
        alarmTimerRef.current = null
      }
    }
  }, [alarmEnabled, alarmTimeoutMinutes, lastActivityTime])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setManualAlarms((prev) => {
        let hasChanges = false
        const updated = prev.map((alarm) => {
          if (!alarm.isTriggered && now >= alarm.triggerTime) {
            hasChanges = true
            if (!alarmAudioRef.current) {
              alarmAudioRef.current = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg")
              alarmAudioRef.current.loop = true
            }
            alarmAudioRef.current.play().catch((e) => console.error("Error playing alarm sound:", e))

            return { ...alarm, isTriggered: true }
          }
          return alarm
        })
        return hasChanges ? updated : prev
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // AI Command Implementations

  commandCallbacksRef.current.createTask = async (title: string, date?: string) => {
    try {
      // Cria payload com título e data opcional (RFC 3339)
      const payload: any = {
        title: title.trim(),
        status: "needsAction"
      }

      if (date) {
        // Adiciona horário padrão 09:00 se apenas data for fornecida
        payload.due = new Date(`${date}T09:00:00`).toISOString()
      }

      const taskId = await createGoogleTask(payload)

      if (taskId) {
        window.dispatchEvent(new Event("tasks-updated"))
      }
    } catch (e) {
      console.error("Erro ao criar tarefa via IA:", e)
    }
  }

  commandCallbacksRef.current.deleteTask = async (titleOrId: string) => {
    try {
      // First we need to find the task ID if a title was provided
      let taskId = titleOrId

      // If it looks like a title (not a typical ID), try to find it
      // This is a simple heuristic, ideally we'd have the ID from the context
      const googleTasks = await listGoogleTasks()
      const task = googleTasks.find((t: any) => t.title.toLowerCase() === titleOrId.toLowerCase() || t.id === titleOrId)

      if (task) {
        taskId = task.id
        await deleteGoogleTask(taskId)
        window.dispatchEvent(new Event("tasks-updated"))
      } else {
        console.warn("Task not found for deletion:", titleOrId)
      }
    } catch (e) {
      console.error("Error deleting task via AI:", e)
    }
  }

  commandCallbacksRef.current.createKanbanItem = async (title: string, column: string = "todo") => {
    try {
      const data = await loadFromFirestore(user.uid, "kanban-tasks")
      const currentTasks = data?.tasks || []

      const newTask = {
        id: Date.now().toString(),
        title: title.trim(),
        column: column,
      }

      const updatedTasks = [...currentTasks, newTask]
      await syncToFirestore(user.uid, "kanban-tasks", { tasks: updatedTasks })
      window.dispatchEvent(new Event("kanban-updated"))
      openWindow("kanban")
    } catch (e) {
      console.error("Error creating kanban item via AI:", e)
    }
  }

  commandCallbacksRef.current.moveKanbanItem = async (titleOrId: string, newColumn: string) => {
    try {
      const data = await loadFromFirestore(user.uid, "kanban-tasks")
      if (!data || !data.tasks) return

      const updatedTasks = data.tasks.map((t: any) => {
        if (t.id === titleOrId || t.title.toLowerCase() === titleOrId.toLowerCase()) {
          return { ...t, column: newColumn }
        }
        return t
      })

      await syncToFirestore(user.uid, "kanban-tasks", { tasks: updatedTasks })
      window.dispatchEvent(new Event("kanban-updated"))
      openWindow("kanban")
    } catch (e) {
      console.error("Error moving kanban item via AI:", e)
    }
  }

  commandCallbacksRef.current.loadYouTubeVideo = (url: string) => {
    openWindow("youtube-player")
    // Dispatch event after a short delay to ensure component is mounted/listening
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("play-youtube-video", { detail: { url } }))
    }, 500)
  }

  commandCallbacksRef.current.setAlarm = (enabled: boolean, minutes: number) => {
    setAlarmEnabled(enabled)
    setAlarmTimeoutMinutes(minutes)
    setLastActivityTime(Date.now())
  }

  commandCallbacksRef.current.createManualAlarm = (title: string, minutes: number) => {
    const newAlarm: ManualAlarm = {
      id: crypto.randomUUID(),
      title,
      triggerTime: Date.now() + minutes * 60 * 1000,
      isTriggered: false,
    }
    setManualAlarms((prev) => [...prev, newAlarm])
    openWindow("focus-timer")
  }

  commandCallbacksRef.current.startTimer = (mins?: number) => {
    setTimerState((prev) => {
      if (mins) {
        return {
          ...prev,
          minutes: mins,
          seconds: 0,
          sessionLength: mins,
          isBreak: false,
          isRunning: true,
        }
      }
      if (!prev.isRunning && (prev.minutes > 0 || prev.seconds > 0)) {
        return { ...prev, isRunning: true }
      }
      const modeMinutes = {
        pomodoro: prev.sessionLength,
        short: prev.shortBreak,
        long: prev.longBreak,
        custom: prev.customMinutes,
      }
      return {
        ...prev,
        minutes: modeMinutes[prev.mode],
        seconds: 0,
        isRunning: true,
      }
    })
    openWindow("focus-timer")
  }

  commandCallbacksRef.current.pauseTimer = () => {
    setTimerState((prev) => ({ ...prev, isRunning: false }))
  }

  commandCallbacksRef.current.stopTimer = () => {
    setTimerState((prev) => {
      const modeMinutes = {
        pomodoro: prev.sessionLength,
        short: prev.shortBreak,
        long: prev.longBreak,
        custom: prev.customMinutes,
      }
      return {
        ...prev,
        minutes: modeMinutes[prev.mode],
        seconds: 0,
        isRunning: false,
        isBreak: false,
      }
    })
  }

  commandCallbacksRef.current.setTimerMode = (mode: TimerMode, start?: boolean) => {
    setTimerState((prev) => {
      const modeMinutes = {
        pomodoro: prev.sessionLength,
        short: prev.shortBreak,
        long: prev.longBreak,
        custom: prev.customMinutes,
      }
      return {
        ...prev,
        mode,
        minutes: modeMinutes[mode],
        seconds: 0,
        isRunning: start === true,
        isBreak: false,
      }
    })
    openWindow("focus-timer")
  }

  commandCallbacksRef.current.toggleTimerLoop = (enabled: boolean) => {
    setTimerState((prev) => ({ ...prev, loopEnabled: enabled }))
    openWindow("focus-timer")
  }

  commandCallbacksRef.current.createSchedule = async (schedule: any) => {
    // Create a new schedule document instead of appending to a list
    // This matches SchedulePage's behavior and the backend's expectation for /data/schedules

    const newSchedule = {
      id: crypto.randomUUID(),
      ...schedule,
      activities: schedule.activities.map((a: any) => ({
        id: crypto.randomUUID(),
        ...a,
        completed_dates: [],
      })),
    }

    try {
      await apiFetch("/data/schedules", {
        method: "POST",
        body: JSON.stringify(newSchedule)
      })

      // Despacha evento para atualizar UI
      window.dispatchEvent(new Event("schedules-updated"))

      // Abre visualização de cronogramas
      setViewMode("schedules")

      console.log("Schedule created and synced to backend")

      // Sincronização automática com Google Agenda
      // Usa datas fornecidas pela IA ou padrão de 7 dias

      const now = new Date()
      let startDate = now.toISOString().split('T')[0]
      let endDate = ""

      if (schedule.data_inicio) {
        startDate = schedule.data_inicio
      }

      if (schedule.data_fim) {
        endDate = schedule.data_fim
      } else {
        // Padrão: 7 dias a partir do início
        const start = new Date(startDate)
        const end = new Date(start)
        end.setDate(start.getDate() + 7)
        endDate = end.toISOString().split('T')[0]
      }

      import("@/lib/schedule-utils").then(async ({ syncScheduleToCalendar }) => {
        try {
          const success = await syncScheduleToCalendar(newSchedule, startDate, endDate)
          if (success) {
            toast.success("Cronograma criado e sincronizado com Google Agenda!")
          } else {
            toast.warning("Cronograma criado, mas erro ao sincronizar com Google Agenda.")
          }
        } catch (err) {
          console.error("Auto-sync failed:", err)
        }
      })

    } catch (e) {
      console.error("Error creating schedule:", e)
    }
  }


  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        const keyMap: Record<string, PageType | null> = {
          "0": null,
          "1": "tasks",
          "2": "kanban",
          "3": "schedules",
          "4": "focus-timer",
          "5": "notes",
          "7": "youtube-player",
        }

        const target = keyMap[e.key]
        if (target !== undefined) {
          e.preventDefault()
          if (target === null) {
            setOpenWindows([])
          } else {
            openWindow(target)
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [openWindows])

  const openWindow = (pageType: PageType) => {
    if (pageType === "schedules") {
      setViewMode(pageType)
      return
    }

    if (pageType === "chat") return

    const existingWindow = openWindows.find((w) => w.id === pageType)
    if (existingWindow) {
      closeWindow(pageType)
      return
    }

    const defaultSizes: Record<string, { width: number; height: number }> = {
      tasks: { width: 550, height: 650 },
      kanban: { width: 1200, height: 700 },
      "focus-timer": { width: 550, height: 650 },
      notes: { width: 750, height: 700 },
      "youtube-player": { width: 850, height: 750 },
    }

    const offset = openWindows.length * 30
    const maxX = window.innerWidth - defaultSizes[pageType]?.width - 100 || window.innerWidth - 600 - 100
    const maxY = window.innerHeight - defaultSizes[pageType]?.height - 150 || window.innerHeight - 600 - 150

    const width = defaultSizes[pageType]?.width || 600
    const height = defaultSizes[pageType]?.height || 600

    const position = {
      x: Math.max(0, (window.innerWidth - width) / 2 + offset),
      y: Math.max(0, (window.innerHeight - height) / 2 + offset),
    }

    const newWindow: FloatingWindowState = {
      id: pageType,
      position,
      size: defaultSizes[pageType] || { width: 600, height: 600 },
      isMinimized: false,
      zIndex: topZIndex + 1,
    }

    setOpenWindows([...openWindows, newWindow])
    setTopZIndex(topZIndex + 1)
  }

  const closeWindow = (pageType: PageType) => {
    setOpenWindows(openWindows.filter((w) => w.id !== pageType))
  }

  const bringToFront = (pageType: PageType) => {
    setOpenWindows(openWindows.map((w) => (w.id === pageType ? { ...w, zIndex: topZIndex + 1 } : w)))
    setTopZIndex(topZIndex + 1)
  }

  const updateWindowPosition = (pageType: PageType, position: { x: number; y: number }) => {
    const maxX = window.innerWidth - 400
    const maxY = window.innerHeight - 100

    const boundedPosition = {
      x: Math.max(0, Math.min(position.x, maxX)),
      y: Math.max(0, Math.min(position.y, maxY)),
    }

    setOpenWindows(openWindows.map((w) => (w.id === pageType ? { ...w, position: boundedPosition } : w)))
  }

  const updateWindowSize = (pageType: PageType, size: { width: number; height: number }) => {
    setOpenWindows(openWindows.map((w) => (w.id === pageType ? { ...w, size } : w)))
  }

  const toggleMinimize = (pageType: PageType) => {
    setOpenWindows(openWindows.map((w) => (w.id === pageType ? { ...w, isMinimized: !w.isMinimized } : w)))
  }

  const getPageTitle = (pageType: PageType): string => {
    const titles: Record<PageType, string> = {
      tasks: "Metas",
      kanban: "Kanban",
      "focus-timer": "Timer de Foco",
      notes: "Notas",
      "youtube-player": "YouTube Player",
      schedules: "Cronogramas",
      chat: "Chat",
    }
    return titles[pageType]
  }

  const renderPageContent = (pageType: PageType) => {
    switch (pageType) {
      case "tasks":
        return <TasksPage {...commandCallbacksRef} userId={user.uid} />
      case "kanban":
        return <KanbanPage userId={user.uid} />
      case "focus-timer":
        return (
          <FocusTimerPage
            commandCallbacks={commandCallbacksRef}
            timerState={timerState}
            setTimerState={setTimerState}
            manualAlarms={manualAlarms} // Pass manual alarms to FocusTimerPage
            onDeleteAlarm={(id: string) => dismissManualAlarm(id)} // Pass delete handler
          />
        )
      case "notes":
        return <NotesPage userId={user.uid} />
      case "youtube-player":
        return <YouTubePlayerPage commandCallbacks={commandCallbacksRef} />
      default:
        return null
    }
  }

  const dismissManualAlarm = (id: string) => {
    setManualAlarms((prev) => {
      const updated = prev.filter((a) => a.id !== id)

      const hasTriggered = updated.some((a) => a.isTriggered)
      if (!hasTriggered && alarmAudioRef.current) {
        alarmAudioRef.current.pause()
        alarmAudioRef.current.currentTime = 0
      }

      return updated
    })
  }

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const data = await loadFromFirestore(user.uid, "app-state")
        if (data) {
          // Restore state from Firestore if available
          if (data.currentPage) setViewMode(data.currentPage)
          if (data.chatCollapsed !== undefined) {
            // Assuming chatCollapsed is a boolean
            // If it's not, you need to adjust this logic accordingly
          }
          // Add more state restoration as needed
        }
      } catch (error) {
        console.error("Error loading user data:", error)
      }
    }

    loadUserData()
  }, [user.uid])

  useEffect(() => {
    const syncData = async () => {
      try {
        await syncToFirestore(user.uid, "app-state", {
          currentPage: viewMode,
          chatCollapsed: viewMode !== "chat",
          lastActive: new Date().toISOString(),
        })
      } catch (error) {
        console.error("Error syncing data:", error)
      }
    }

    // Debounce sync to avoid too many writes
    const timeoutId = setTimeout(syncData, 1000)
    return () => clearTimeout(timeoutId)
  }, [viewMode, user.uid])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {user && onSignOut && <UserProfileMenu user={user} onSignOut={onSignOut} />}

      <ProcrastinationAlarm
        isActive={showAlarm}
        onDismiss={() => {
          setShowAlarm(false)
          setAlarmEnabled(false)
          setRemainingSeconds(0)
          setLastActivityTime(Date.now())
        }}
      />

      <div className="fixed top-4 left-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {manualAlarms
          .filter((a) => a.isTriggered)
          .map((alarm) => (
            <AlarmToast
              key={alarm.id}
              title="Alarme Importante"
              message={alarm.title}
              onClose={() => dismissManualAlarm(alarm.id)}
            />
          ))}
      </div>

      <main className="w-full h-full overflow-hidden bg-background flex flex-col">
        <div className="flex-1 overflow-hidden relative">
          {viewMode === "chat" ? (
            <AIChat
              onNavigate={openWindow}
              commandCallbacks={commandCallbacksRef}
              viewMode={viewMode}
              openWindows={new Set(openWindows.map((w) => w.id as ToolType))}
              onViewModeChange={setViewMode}
              onToggleWindow={(tool) => openWindow(tool as PageType)}
              userId={user.uid}
            />
          ) : viewMode === "schedules" ? (
            <SchedulePage />
          ) : null}

          {openWindows.map((window) => (
            <FloatingWindow
              key={window.id}
              title={getPageTitle(window.id)}
              position={window.position}
              size={window.size}
              isMinimized={window.isMinimized}
              zIndex={window.zIndex}
              onClose={() => closeWindow(window.id)}
              onMinimize={() => toggleMinimize(window.id)}
              onPositionChange={(pos) => updateWindowPosition(window.id, pos)}
              onSizeChange={(size) => updateWindowSize(window.id, size)}
              onFocus={() => bringToFront(window.id)}
            >
              {renderPageContent(window.id)}
            </FloatingWindow>
          ))}
        </div>

        <div className="flex-shrink-0 border-t border-border/50">
          <Navbar
            viewMode={viewMode}
            openWindows={new Set(openWindows.map((w) => w.id as ToolType))}
            onViewModeChange={setViewMode}
            onToggleWindow={(tool) => openWindow(tool as PageType)}
          />
        </div>
      </main>
    </div>
  )
}
