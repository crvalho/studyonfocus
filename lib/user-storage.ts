/**
 * Helper functions for user-scoped localStorage
 * Automatically prefixes keys with user ID to isolate data per user
 */

let currentUserId: string | null = null

export function setCurrentUserId(userId: string | null) {
  currentUserId = userId
}

export function getCurrentUserId(): string | null {
  return currentUserId
}

function getUserKey(key: string): string {
  if (!currentUserId) {
    // Fallback to non-prefixed key if no user is logged in
    return key
  }
  return `user_${currentUserId}_${key}`
}

export const userLocalStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null
    return localStorage.getItem(getUserKey(key))
  },

  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return
    localStorage.setItem(getUserKey(key), value)
  },

  removeItem(key: string): void {
    if (typeof window === "undefined") return
    localStorage.removeItem(getUserKey(key))
  },

  clear(): void {
    if (typeof window === "undefined" || !currentUserId) return

    // Only clear keys for the current user
    const prefix = `user_${currentUserId}_`
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key))
  },
}
