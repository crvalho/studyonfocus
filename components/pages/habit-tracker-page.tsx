'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, CalendarIcon, Filter, MoreHorizontal, Info, Droplets } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface Habit {
  id: string
  name: string
  completedDates: string[]
}

export function HabitTrackerPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [newHabit, setNewHabit] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())

  useEffect(() => {
    const saved = localStorage.getItem('habits')
    if (saved) {
      setHabits(JSON.parse(saved))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('habits', JSON.stringify(habits))
  }, [habits])

  const addHabit = () => {
    if (!newHabit.trim()) return

    const habit: Habit = {
      id: Date.now().toString(),
      name: newHabit.trim(),
      completedDates: [],
    }

    setHabits([...habits, habit])
    setNewHabit('')
  }

  const deleteHabit = (id: string) => {
    setHabits(habits.filter(h => h.id !== id))
  }

  const toggleHabit = (habitId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    
    setHabits(habits.map(habit => {
      if (habit.id !== habitId) return habit

      const isCompleted = habit.completedDates.includes(dateStr)
      return {
        ...habit,
        completedDates: isCompleted
          ? habit.completedDates.filter(d => d !== dateStr)
          : [...habit.completedDates, dateStr],
      }
    }))
  }

  const isHabitCompleted = (habit: Habit, date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return habit.completedDates.includes(dateStr)
  }

  const getLast7Days = () => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      days.push(date)
    }
    return days
  }

  const getStreak = (habit: Habit) => {
    let streak = 0
    const today = new Date()
    
    for (let i = 0; i < 365; i++) {
      const date = new Date()
      date.setDate(today.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      if (habit.completedDates.includes(dateStr)) {
        streak++
      } else {
        break
      }
    }
    
    return streak
  }

  const days = getLast7Days()
  const todayStr = new Date().toISOString().split('T')[0]
  const completedToday = habits.filter(h => isHabitCompleted(h, new Date())).length

  return (
    <div className="h-full p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Habits</h1>
            <p className="text-sm text-muted-foreground">Tuesday, November 18</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
              <Filter className="h-5 w-5" />
            </Button>
            <Button onClick={() => setNewHabit('New Habit')} className="bg-white text-black hover:bg-white/90">
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Today's Progress</span>
            <span className="text-muted-foreground">{completedToday}/{habits.length}</span>
          </div>
          <Progress value={habits.length > 0 ? (completedToday / habits.length) * 100 : 0} className="h-1 bg-white/10" />
        </div>

        {/* Add Habit Input (Hidden by default in design, but keeping functionality) */}
        {newHabit !== '' && (
          <div className="flex gap-2">
            <Input
              value={newHabit}
              onChange={(e) => setNewHabit(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addHabit()}
              placeholder="Name your habit..."
              className="bg-transparent border-white/10 text-white"
              autoFocus
            />
          </div>
        )}

        {/* Habits List */}
        <div className="space-y-1">
          {habits.map(habit => {
            const isCompleted = isHabitCompleted(habit, new Date())
            
            return (
              <div
                key={habit.id}
                className="group flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Checkbox
                  checked={isCompleted}
                  onCheckedChange={() => toggleHabit(habit.id, new Date())}
                  className="border-white/20 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                />
                
                <div className="flex-1 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Droplets className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-white">{habit.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      1x/day
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
                    <Info className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteHabit(habit.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
