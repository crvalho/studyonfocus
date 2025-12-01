"use client"

import { useEffect, useState, useRef } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface ProcrastinationAlarmProps {
  isActive: boolean
  onDismiss: () => void
}

export function ProcrastinationAlarm({ isActive, onDismiss }: ProcrastinationAlarmProps) {
  const [audio] = useState(() => {
    if (typeof window !== "undefined") {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      return audioContext
    }
    return null
  })

  const isPlayingRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)

  useEffect(() => {
    if (!isActive || !audio) {
      isPlayingRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop()
        } catch (e) {
          // Oscillator already stopped
        }
        oscillatorRef.current = null
      }
      return
    }

    isPlayingRef.current = true

    const playAlarm = () => {
      if (!isPlayingRef.current) return

      const oscillator = audio.createOscillator()
      const gainNode = audio.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audio.destination)

      oscillator.frequency.value = 800
      gainNode.gain.value = 0.3

      oscillatorRef.current = oscillator
      oscillator.start()
      oscillator.stop(audio.currentTime + 0.3)

      timeoutRef.current = setTimeout(() => {
        if (isPlayingRef.current) {
          playAlarm()
        }
      }, 500)
    }

    playAlarm()

    return () => {
      isPlayingRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop()
        } catch (e) {
          // Oscillator already stopped
        }
        oscillatorRef.current = null
      }
    }
  }, [isActive, audio])

  if (!isActive) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-2xl p-8 md:p-12 border-4 border-destructive shadow-2xl animate-in zoom-in duration-300">
        <div className="text-center space-y-6">
          <div className="flex justify-center mb-8 mr-8">
            <div className="relative">
              <AlertTriangle className="w-24 h-24 md:w-32 md:h-32 text-destructive animate-pulse" />
              <div className="absolute inset-0 bg-destructive/20 blur-xl rounded-full animate-ping" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-bold text-destructive">Alerta de Procrastinação!</h1>
            <p className="text-xl md:text-2xl text-muted-foreground">
              Você está há muito tempo sem usar nenhuma ferramenta
            </p>
            <p className="text-base md:text-lg text-muted-foreground/80">
              É hora de voltar aos estudos e ser produtivo!
            </p>
          </div>

          <Button
            onClick={onDismiss}
            size="lg"
            variant="destructive"
            className="text-lg md:text-xl px-8 py-6 h-auto mt-8"
          >
            Retornar aos Estudos
          </Button>
        </div>
      </Card>
    </div>
  )
}
