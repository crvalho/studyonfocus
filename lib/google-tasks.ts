import { apiFetch } from "@/lib/api"

interface TaskItem {
    id?: string
    title: string
    notes?: string
    due?: string // RFC 3339 timestamp
    status?: string
}

export async function createGoogleTask(task: TaskItem): Promise<string | null> {
    try {
        const accessToken = localStorage.getItem("google_access_token")

        if (!accessToken) {
            console.warn("[v0] No Google Tasks access token found")
            return null
        }

        const response = await apiFetch("/tasks/create_task", {
            method: "POST",
            body: JSON.stringify({
                title: task.title,
                notes: task.notes,
                due: task.due,
                status: task.status,
                access_token: accessToken
            })
        })

        console.log("[v0] Google Task created:", response.taskId)
        return response.taskId
    } catch (error) {
        console.error("[v0] Error creating google task:", error)
        return null
    }
}

export async function deleteGoogleTask(taskId: string): Promise<boolean> {
    try {
        const accessToken = localStorage.getItem("google_access_token")
        if (!accessToken) return false

        await apiFetch("/tasks/delete_task", {
            method: "POST",
            body: JSON.stringify({
                task_id: taskId,
                access_token: accessToken
            })
        })
        return true
    } catch (error) {
        console.error("Error deleting google task:", error)
        return false
    }
}

export async function listGoogleTasks(): Promise<any[]> {
    try {
        const accessToken = localStorage.getItem("google_access_token")
        if (!accessToken) return []

        const response = await apiFetch("/tasks/list_tasks", {
            method: "POST",
            body: JSON.stringify({
                access_token: accessToken
            })
        })
        return response.tasks || []
    } catch (error) {
        console.error("Error listing google tasks:", error)
        return []
    }
}

export function hasGoogleTasksToken(): boolean {
    return !!localStorage.getItem("google_access_token")
}

export async function updateGoogleTask(taskId: string, updates: { title?: string, notes?: string, status?: string }): Promise<boolean> {
    try {
        const accessToken = localStorage.getItem("google_access_token")
        if (!accessToken) return false

        await apiFetch("/tasks/update_task", {
            method: "POST",
            body: JSON.stringify({
                task_id: taskId,
                access_token: accessToken,
                ...updates
            })
        })
        return true
    } catch (error) {
        console.error("Error updating google task:", error)
        return false
    }
}
