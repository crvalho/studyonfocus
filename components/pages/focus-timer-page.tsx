"use client"

import type React from "react"
import { useRef, useState, useEffect } from "react"
import { Play, Pause, RotateCcw, Volume2, Repeat, Bell, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import type { AICommandCallbacks } from "@/components/app-layout"
import { cn } from "@/lib/utils"

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

interface FocusTimerPageProps {
  commandCallbacks?: React.MutableRefObject<AICommandCallbacks>
  timerState: TimerState
  setTimerState: React.Dispatch<React.SetStateAction<TimerState>>
  manualAlarms?: { id: string; title: string; triggerTime: number; isTriggered: boolean }[]
  onDeleteAlarm?: (id: string) => void
}

function AlarmCountdown({ triggerTime, isTriggered }: { triggerTime: number; isTriggered: boolean }) {
  const [timeLeft, setTimeLeft] = useState("")

  useEffect(() => {
    if (isTriggered) return

    const update = () => {
      const now = Date.now()
      const diff = triggerTime - now
      if (diff <= 0) {
        setTimeLeft("00:00:00")
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeLeft(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      )
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [triggerTime, isTriggered])

  if (isTriggered) return <span className="text-red-400 font-medium">Disparado!</span>
  return <span className="font-mono text-xs text-muted-foreground">{timeLeft}</span>
}

export function FocusTimerPage({
  commandCallbacks,
  timerState,
  setTimerState,
  manualAlarms = [],
  onDeleteAlarm,
}: FocusTimerPageProps) {
  const notificationRequestedRef = useRef(false)
  const [newAlarmTitle, setNewAlarmTitle] = useState("")
  const [newAlarmTime, setNewAlarmTime] = useState("")

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "")
    if (value.length > 4) value = value.slice(0, 4)

    if (value.length >= 3) {
      value = value.slice(0, 2) + ":" + value.slice(2)
    }

    setNewAlarmTime(value)
  }

  const handleCreateAlarm = () => {
    if (!newAlarmTitle || !newAlarmTime) return

    // Parse HH:MM
    const parts = newAlarmTime.split(":")
    if (parts.length < 1) return

    let hours = 0
    let minutes = 0

    if (parts.length === 2) {
      hours = Number.parseInt(parts[0] || "0")
      minutes = Number.parseInt(parts[1] || "0")
    } else if (parts.length === 1 && newAlarmTime.length <= 2) {
      // If user just typed "30", treat as minutes? Or require 00:30?
      // The prompt asked for 00:00 structure.
      // Let's assume standard HH:MM parsing
      minutes = Number.parseInt(parts[0])
    }

    // Validate
    if (isNaN(hours) || isNaN(minutes) || (hours === 0 && minutes === 0)) return
    if (hours < 0 || minutes < 0) return // Should be prevented by input mask but good to check

    const totalMinutes = hours * 60 + minutes

    if (commandCallbacks?.current.createManualAlarm) {
      commandCallbacks.current.createManualAlarm(newAlarmTitle, totalMinutes)
      setNewAlarmTitle("")
      setNewAlarmTime("")
    }
  }

  const toggleTimer = () => {
    if ("Notification" in window && Notification.permission === "default" && !notificationRequestedRef.current) {
      Notification.requestPermission()
      notificationRequestedRef.current = true
    }
    setTimerState((prev) => ({ ...prev, isRunning: !prev.isRunning }))
  }

  const resetTimer = () => {
    const modeMinutes = {
      pomodoro: timerState.sessionLength,
      short: timerState.shortBreak,
      long: timerState.longBreak,
      custom: timerState.customMinutes,
    }
    setTimerState((prev) => ({
      ...prev,
      minutes: modeMinutes[prev.mode],
      seconds: 0,
      isRunning: false,
      isBreak: false,
    }))
  }

  const changeTimerMode = (mode: TimerMode) => {
    const modeMinutes = {
      pomodoro: timerState.sessionLength,
      short: timerState.shortBreak,
      long: timerState.longBreak,
      custom: timerState.customMinutes,
    }
    setTimerState((prev) => ({
      ...prev,
      mode,
      minutes: modeMinutes[mode],
      seconds: 0,
      isRunning: false,
      isBreak: false,
    }))
  }

  const toggleLoop = () => {
    setTimerState((prev) => ({ ...prev, loopEnabled: !prev.loopEnabled }))
  }

  const totalSeconds = timerState.minutes * 60 + timerState.seconds
  const maxSeconds =
    (timerState.isBreak
      ? timerState.sessionsCompleted % 4 === 0
        ? timerState.longBreak
        : timerState.shortBreak
      : timerState.sessionLength) * 60
  const progress = ((maxSeconds - totalSeconds) / maxSeconds) * 100

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Tabs */}
        <div className="flex justify-center gap-2">
          <button
            onClick={() => changeTimerMode("pomodoro")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              timerState.mode === "pomodoro"
                ? "bg-white text-black"
                : "text-muted-foreground hover:text-white hover:bg-white/5",
            )}
          >
            Pomodoro
          </button>
          <button
            onClick={() => changeTimerMode("short")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              timerState.mode === "short"
                ? "bg-white text-black"
                : "text-muted-foreground hover:text-white hover:bg-white/5",
            )}
          >
            Pausa Curta
          </button>
          <button
            onClick={() => changeTimerMode("long")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              timerState.mode === "long"
                ? "bg-white text-black"
                : "text-muted-foreground hover:text-white hover:bg-white/5",
            )}
          >
            Pausa Longa
          </button>
          <button
            onClick={() => changeTimerMode("custom")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              timerState.mode === "custom"
                ? "bg-white text-black"
                : "text-muted-foreground hover:text-white hover:bg-white/5",
            )}
          >
            Personalizado
          </button>
        </div>

        {/* Custom Time Input */}
        {timerState.mode === "custom" && (
          <div className="flex items-center justify-center gap-2">
            <Input
              type="number"
              min="1"
              max="120"
              value={timerState.customMinutes}
              onChange={(e) => {
                const val = Number.parseInt(e.target.value) || 1
                setTimerState((prev) => ({
                  ...prev,
                  customMinutes: val,
                  minutes: val,
                  seconds: 0,
                }))
              }}
              className="w-20 text-center"
            />
            <span className="text-muted-foreground">minutos</span>
          </div>
        )}

        {/* Timer */}
        <div className="relative flex items-center justify-center py-8">
          <div className="w-64 h-64 rounded-full border-4 border-white/5 flex items-center justify-center relative">
            {/* Progress Circle */}
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle
                cx="128"
                cy="128"
                r="120"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 120}`}
                strokeDashoffset={`${2 * Math.PI * 120 * (1 - progress / 100)}`}
                className="text-white transition-all duration-1000"
                strokeLinecap="round"
              />
            </svg>
            <div className="text-6xl font-bold text-white font-mono tracking-wider">
              {String(timerState.minutes).padStart(2, "0")}:{String(timerState.seconds).padStart(2, "0")}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-6">
          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              onClick={toggleTimer}
              className="w-32 bg-white text-black hover:bg-white/90 h-12 text-base font-medium"
            >
              {timerState.isRunning ? (
                <>
                  <Pause className="h-5 w-5 mr-2" />
                  Pausar
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Iniciar
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={resetTimer}
              className="border-white/10 text-white hover:bg-white/5 h-12 bg-transparent"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              Reiniciar
            </Button>
          </div>

          {/* Volume & Loop */}
          <div className="flex flex-col items-center gap-4 max-w-xs mx-auto">
            <div className="flex items-center gap-3 w-full">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Slider defaultValue={[50]} max={100} step={1} className="flex-1" />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLoop}
              className={cn(
                "transition-colors",
                timerState.loopEnabled ? "text-white hover:text-white/80" : "text-muted-foreground hover:text-white",
              )}
            >
              <Repeat className="h-4 w-4 mr-2" />
              Loop {timerState.loopEnabled ? "Ligado" : "Desligado"}
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Pomodoros Completados: {timerState.sessionsCompleted}
          </div>
        </div>

        {/* Manual Alarms Section */}
        <div className="pt-8 border-t border-white/10 w-full">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alarmes importantes
          </h3>

          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Título do alarme"
              value={newAlarmTitle}
              onChange={(e) => setNewAlarmTitle(e.target.value)}
              className="flex-1"
            />
            <Input
              type="text"
              placeholder="00:00"
              value={newAlarmTime}
              onChange={handleTimeChange}
              className="w-24 text-center font-mono"
              maxLength={5}
            />
            {/* </CHANGE> */}
            <Button onClick={handleCreateAlarm} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
            {manualAlarms.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">Nenhum alarme configurado</p>
            ) : (
              manualAlarms.map((alarm) => {
                // Use AlarmCountdown component
                return (
                  <div key={alarm.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg text-sm">
                    <div>
                      <p className="font-medium">{alarm.title}</p>
                      <AlarmCountdown triggerTime={alarm.triggerTime} isTriggered={alarm.isTriggered} />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => onDeleteAlarm?.(alarm.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
