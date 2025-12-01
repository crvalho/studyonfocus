'use client'

import { useState, useEffect } from 'react'
import { Bell, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AlarmConfigDialogProps {
  isEnabled: boolean
  timeoutMinutes: number
  remainingSeconds: number
  onConfigChange: (enabled: boolean, minutes: number) => void
}

export function AlarmConfigDialog({ isEnabled, timeoutMinutes, remainingSeconds, onConfigChange }: AlarmConfigDialogProps) {
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(isEnabled)
  const [minutes, setMinutes] = useState(timeoutMinutes)
  const [unit, setUnit] = useState<'minutes' | 'seconds'>('minutes')
  const [value, setValue] = useState(timeoutMinutes)

  useEffect(() => {
    setEnabled(isEnabled)
    setMinutes(timeoutMinutes)
    setValue(unit === 'minutes' ? timeoutMinutes : timeoutMinutes * 60)
  }, [isEnabled, timeoutMinutes, unit])

  const handleSave = () => {
    const minutesToSave = unit === 'seconds' ? value / 60 : value
    onConfigChange(enabled, minutesToSave)
    setOpen(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleDialogInteraction = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleToggle = (checked: boolean) => {
    setEnabled(checked)
    const minutesToSave = unit === 'seconds' ? value / 60 : value
    onConfigChange(checked, minutesToSave)
  }

  const handleUnitChange = (newUnit: 'minutes' | 'seconds') => {
    if (newUnit === 'seconds') {
      setValue(value * 60)
    } else {
      setValue(value / 60)
    }
    setUnit(newUnit)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`fixed top-4 right-4 z-50 rounded-full ${isEnabled ? 'text-blue-500 hover:text-blue-600' : ''}`}
          onClick={handleDialogInteraction}
          onMouseDown={handleDialogInteraction}
        >
          <Bell className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent onClick={handleDialogInteraction} onMouseDown={handleDialogInteraction}>
        <DialogHeader>
          <DialogTitle>Alarme de Procrastinação</DialogTitle>
          <DialogDescription>
            Configure o alarme que toca quando você fica muito tempo inativo
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {isEnabled && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Alarme Ativo
                  </span>
                </div>
                <div className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400">
                  {formatTime(remainingSeconds)}
                </div>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                Tempo restante até o alarme tocar
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="alarm-enabled" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Ativar alarme
            </Label>
            <Switch
              id="alarm-enabled"
              checked={enabled}
              onCheckedChange={handleToggle}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeout" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Tempo de inatividade
            </Label>
            
            <Tabs value={unit} onValueChange={(v) => handleUnitChange(v as 'minutes' | 'seconds')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="minutes">Minutos</TabsTrigger>
                <TabsTrigger value="seconds">Segundos</TabsTrigger>
              </TabsList>
            </Tabs>

            <Input
              id="timeout"
              type="number"
              min="1"
              max={unit === 'minutes' ? 120 : 7200}
              value={value}
              onChange={(e) => setValue(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={!enabled}
            />
            <p className="text-xs text-muted-foreground">
              O alarme tocará após {value} {unit === 'minutes' ? 'minutos' : 'segundos'} sem usar nenhuma ferramenta
            </p>
          </div>

          <Button onClick={handleSave} className="w-full">
            Salvar Configurações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
