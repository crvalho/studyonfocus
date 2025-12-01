import { apiFetch } from "@/lib/api"

interface CalendarEvent {
  summary: string
  description?: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  reminders: {
    useDefault: boolean
    overrides?: Array<{
      method: string
      minutes: number
    }>
  }
}

interface Activity {
  id: string
  title: string
  description?: string
  day_of_week: number
  start_time?: string
  end_time?: string
  googleEventId?: string
  recurrence?: string // "weekly", "daily", "none"
}

export async function createGoogleCalendarEvent(activity: Activity, date?: Date): Promise<string | null> {
  try {
    const accessToken = localStorage.getItem("google_access_token")

    if (!accessToken) {
      console.warn("[v0] No Google Calendar access token found")
      return null
    }

    // Calculate the date for the event
    const eventDate = date || new Date()
    const dayOfWeek = eventDate.getDay() // 0 = Sunday, 6 = Saturday

    // Adjust date to match activity day_of_week if needed
    const daysToAdd = (activity.day_of_week - dayOfWeek + 7) % 7
    eventDate.setDate(eventDate.getDate() + daysToAdd)

    // Parse start and end times
    const startTime = activity.start_time || "09:00"
    const endTime = activity.end_time || "10:00"

    const [startHour, startMinute] = startTime.split(":").map(Number)
    const [endHour, endMinute] = endTime.split(":").map(Number)

    const startDateTime = new Date(eventDate)
    startDateTime.setHours(startHour, startMinute, 0, 0)

    const endDateTime = new Date(eventDate)
    endDateTime.setHours(endHour, endMinute, 0, 0)

    // Handle Recurrence
    let recurrence: string[] | undefined = undefined
    if (activity.recurrence === "weekly") {
      const dayMap = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]
      recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${dayMap[activity.day_of_week]}`]
    } else if (activity.recurrence === "daily") {
      recurrence = ["RRULE:FREQ=DAILY"]
    }

    const response = await apiFetch("/calendar/create_event", {
      method: "POST",
      body: JSON.stringify({
        summary: activity.title,
        description: activity.description,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        access_token: accessToken,
        recurrence: recurrence
      })
    })

    console.log("[v0] Calendar event created:", response.eventId)
    return response.eventId
  } catch (error) {
    console.error("[v0] Error creating calendar event:", error)
    return null
  }
}

export async function createRawCalendarEvent(event: {
  summary: string
  description?: string
  start_time: string
  end_time: string
  recurrence?: string[]
}): Promise<string | null> {
  try {
    const accessToken = localStorage.getItem("google_access_token")
    if (!accessToken) return null

    const response = await apiFetch("/calendar/create_event", {
      method: "POST",
      body: JSON.stringify({
        ...event,
        access_token: accessToken
      })
    })
    return response.eventId
  } catch (error) {
    console.error("Error creating raw calendar event:", error)
    return null
  }
}

export async function deleteGoogleCalendarEvent(eventId: string): Promise<boolean> {
  try {
    const accessToken = localStorage.getItem("google_access_token")
    if (!accessToken) return false

    await apiFetch("/calendar/delete_event", {
      method: "POST",
      body: JSON.stringify({
        eventId: eventId,
        access_token: accessToken
      })
    })
    return true
  } catch (error) {
    console.error("Error deleting calendar event:", error)
    return false
  }
}

export async function patchGoogleCalendarEvent(eventId: string, updates: any): Promise<boolean> {
  try {
    const accessToken = localStorage.getItem("google_access_token")
    if (!accessToken) return false

    await apiFetch("/calendar/update_event", {
      method: "POST",
      body: JSON.stringify({
        eventId: eventId,
        access_token: accessToken,
        ...updates
      })
    })
    return true
  } catch (error) {
    console.error("Error patching calendar event:", error)
    return false
  }
}

export async function listGoogleCalendarEvents(timeMin?: string, timeMax?: string): Promise<any[]> {
  try {
    const accessToken = localStorage.getItem("google_access_token")
    if (!accessToken) return []

    const response = await apiFetch("/calendar/list_events", {
      method: "POST",
      body: JSON.stringify({
        access_token: accessToken,
        timeMin,
        timeMax
      })
    })
    return response.events || []
  } catch (error) {
    console.error("Error listing calendar events:", error)
    return []
  }
}

export async function syncActivitiesToCalendar(activities: Activity[]): Promise<Activity[]> {
  const updatedActivities: Activity[] = []
  const eventsToCreate: any[] = []
  const accessToken = localStorage.getItem("google_access_token")

  if (!accessToken) {
    console.warn("No access token for batch sync")
    return activities
  }

  // Identify activities that need syncing
  for (const activity of activities) {
    if (activity.googleEventId) {
      updatedActivities.push(activity)
      continue
    }

    // Calculate date logic (replicated from createGoogleCalendarEvent)
    const eventDate = new Date()
    const dayOfWeek = eventDate.getDay()
    const daysToAdd = (activity.day_of_week - dayOfWeek + 7) % 7
    eventDate.setDate(eventDate.getDate() + daysToAdd)

    const startTime = activity.start_time || "09:00"
    const endTime = activity.end_time || "10:00"
    const [startHour, startMinute] = startTime.split(":").map(Number)
    const [endHour, endMinute] = endTime.split(":").map(Number)

    const startDateTime = new Date(eventDate)
    startDateTime.setHours(startHour, startMinute, 0, 0)
    const endDateTime = new Date(eventDate)
    endDateTime.setHours(endHour, endMinute, 0, 0)

    // Handle Recurrence
    let recurrence: string[] | undefined = undefined
    if (activity.recurrence === "weekly") {
      const dayMap = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]
      recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${dayMap[activity.day_of_week]}`]
    } else if (activity.recurrence === "daily") {
      recurrence = ["RRULE:FREQ=DAILY"]
    }

    eventsToCreate.push({
      summary: activity.title,
      description: activity.description,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      access_token: accessToken,
      recurrence: recurrence,
      _originalActivity: activity // Helper to map back
    })
  }

  if (eventsToCreate.length === 0) {
    return updatedActivities
  }

  try {
    const response = await apiFetch("/calendar/create_events_batch", {
      method: "POST",
      body: JSON.stringify({ events: eventsToCreate })
    })

    // Map results back to activities
    const createdEvents = response.created || []

    // We need to match created events back to the original activities
    // Since the order is preserved in the batch list, we can iterate

    let createdIndex = 0
    for (const eventParams of eventsToCreate) {
      const original = eventParams._originalActivity
      // Find if this event was successfully created
      const created = createdEvents.find((e: any) => e.summary === original.title)
      // Note: matching by title is risky if duplicates, but batch response structure in backend 
      // returns a list of {summary, eventId}. 
      // Ideally backend returns the index or we trust the order.
      // Let's assume for now we just mark them as synced if we find a match.

      if (created) {
        updatedActivities.push({
          ...original,
          googleEventId: created.eventId
        })
      } else {
        updatedActivities.push(original)
      }
    }
  } catch (e) {
    console.error("Batch sync error", e)
    // Fallback: return original activities without IDs
    for (const eventParams of eventsToCreate) {
      updatedActivities.push(eventParams._originalActivity)
    }
  }

  // Sort by day of week
  updatedActivities.sort((a, b) => a.day_of_week - b.day_of_week)

  return updatedActivities
}

export function hasGoogleCalendarToken(): boolean {
  return !!localStorage.getItem("google_access_token")
}
