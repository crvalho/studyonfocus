import { Activity, Schedule } from "@/components/pages/schedule-page"
import { apiFetch } from "@/lib/api"
import { deleteGoogleCalendarEvent } from "@/lib/google-calendar"

export async function syncScheduleToCalendar(
    schedule: Schedule,
    startDate: string,
    endDate: string
): Promise<boolean> {
    try {
        const eventsToCreate: any[] = []
        const activitiesToUpdate: Activity[] = []

        // Data limite para recorrência (UTC)
        const untilDate = new Date(endDate)
        untilDate.setHours(23, 59, 59, 999)
        const untilStr = untilDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

        // Prepara lote de eventos
        for (const activity of schedule.activities) {
            // Deleta evento existente se houver
            if (activity.googleEventId) {
                try {
                    await deleteGoogleCalendarEvent(activity.googleEventId)
                } catch (e) {
                    console.warn("Erro ao deletar evento:", e)
                }
            }

            // Calcula data da primeira ocorrência
            const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
            const rangeStart = new Date(startYear, startMonth - 1, startDay)

            const dayOfWeek = rangeStart.getDay()
            const daysToAdd = (activity.day_of_week - dayOfWeek + 7) % 7

            const eventStartDate = new Date(rangeStart)
            eventStartDate.setDate(rangeStart.getDate() + daysToAdd)

            // Se passar da data limite, pula
            if (eventStartDate > untilDate) {
                activitiesToUpdate.push({ ...activity, googleEventId: undefined })
                continue
            }

            const eventEndDate = new Date(eventStartDate)

            if (activity.start_time) {
                const [hours, minutes] = activity.start_time.split(':').map(Number)
                eventStartDate.setHours(hours, minutes, 0, 0)

                if (activity.end_time) {
                    const [endHours, endMinutes] = activity.end_time.split(':').map(Number)
                    eventEndDate.setHours(endHours, endMinutes, 0, 0)
                } else {
                    eventEndDate.setHours(hours + 1, minutes, 0, 0)
                }
            } else {
                eventStartDate.setHours(9, 0, 0, 0)
                eventEndDate.setHours(10, 0, 0, 0)
            }

            eventsToCreate.push({
                summary: activity.title,
                description: activity.description,
                start_time: eventStartDate.toISOString(),
                end_time: eventEndDate.toISOString(),
                recurrence: [`RRULE:FREQ=WEEKLY;UNTIL=${untilStr}`],
                activityId: activity.id
            })
        }

        if (eventsToCreate.length > 0) {
            const token = localStorage.getItem("google_access_token")
            if (!token) {
                console.error("Token de acesso do Google não encontrado")
                throw new Error("Sem token do Google")
            }

            const batchPayload = {
                events: eventsToCreate.map(e => ({
                    summary: e.summary,
                    description: e.description,
                    start_time: e.start_time,
                    end_time: e.end_time,
                    recurrence: e.recurrence,
                    access_token: token
                }))
            }

            const response = await apiFetch("/calendar/create_events_batch", {
                method: "POST",
                body: JSON.stringify(batchPayload)
            })

            // Mapeia resultados de volta para atividades
            for (const activity of schedule.activities) {
                const createdEvent = response.created?.find((e: any) => e.summary === activity.title)

                if (createdEvent) {
                    activitiesToUpdate.push({
                        ...activity,
                        recurrence: 'weekly',
                        googleEventId: createdEvent.eventId
                    })
                } else {
                    activitiesToUpdate.push({ ...activity, googleEventId: undefined })
                }
            }
        } else {
            activitiesToUpdate.push(...schedule.activities.map(a => ({ ...a, googleEventId: undefined })))
        }

        activitiesToUpdate.sort((a, b) => a.day_of_week - b.day_of_week)

        const updatedSchedule = { ...schedule, activities: activitiesToUpdate }

        await apiFetch("/data/schedules", {
            method: "POST",
            body: JSON.stringify(updatedSchedule)
        })

        return true

    } catch (error) {
        console.error("Erro ao sincronizar cronograma:", error)
        return false
    }
}
