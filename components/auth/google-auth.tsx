"use client"

import type React from "react"
import { setCurrentUserId } from "@/lib/user-storage"
// import { initializeFirestore } from "@/lib/firestore-sync" // Firestore now handled by backend
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { AppLayout } from "@/components/app-layout"
import { auth } from "@/lib/firebase"
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth"

interface User {
  displayName: string | null
  photoURL: string | null
  email: string | null
  uid: string
}

export function GoogleAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = buttonRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty("--mx", `${e.clientX - r.left}px`)
      el.style.setProperty("--my", `${e.clientY - r.top}px`)
    }
    window.addEventListener("mousemove", onMove, { passive: true })
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log("[v0] User signed in:", firebaseUser.email)
        setCurrentUserId(firebaseUser.uid)

        // Firestore init is now handled by backend, we just need the token
        // The backend verifies the token on requests

        setUser({
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          email: firebaseUser.email,
          uid: firebaseUser.uid,
        })
      } else {
        console.log("[v0] User signed out")
        setCurrentUserId(null)
        setUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleSignIn = async () => {
    setSigning(true)
    try {
      if (!auth) {
        throw new Error("Firebase não inicializado")
      }

      const provider = new GoogleAuthProvider()
      provider.addScope("https://www.googleapis.com/auth/calendar")
      provider.addScope("https://www.googleapis.com/auth/calendar.events")
      provider.addScope("https://www.googleapis.com/auth/tasks")

      const result = await signInWithPopup(auth, provider)

      // We don't strictly need to save the access token in localStorage anymore if we send it to backend
      // But the backend implementation of /calendar/create_event expects 'access_token' in the body.
      // So we should keep saving it or manage it in state.
      // Saving to localStorage is easiest for now to persist across refreshes without complex state management.
      const credential = GoogleAuthProvider.credentialFromResult(result)
      if (credential?.accessToken) {
        localStorage.setItem("google_access_token", credential.accessToken)
        console.log("[v0] Google Calendar access token saved")
      }
    } catch (error) {
      console.error("Sign in error:", error)
      alert("Erro ao fazer login. Verifique se habilitou o Google Sign-In no Firebase Console.")
    } finally {
      setSigning(false)
    }
  }

  const handleSignOut = async () => {
    try {
      if (!auth) return
      localStorage.removeItem("google_access_token")
      await signOut(auth)
    } catch (error) {
      console.error("Sign out error:", error)
      alert("Erro ao fazer logout.")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (user) {
    return <AppLayout user={user} onSignOut={handleSignOut} />
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-12">
      <h1 className="text-5xl font-bold text-foreground tracking-tight">Study Focus AI</h1>

      <div className="relative inline-flex items-center justify-center">
        <button
          ref={buttonRef}
          onClick={handleSignIn}
          disabled={signing}
          className={cn(
            "relative inline-flex items-center justify-center rounded-full",
            "px-2 py-2 isolate select-none",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          style={
            {
              ["--mx" as any]: "50%",
              ["--my" as any]: "50%",
            } as React.CSSProperties
          }
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full">
            <div
              className={cn(
                "absolute inset-0 rounded-full",
                "bg-[radial-gradient(200px_100px_at_var(--mx)_var(--my),rgba(59,130,246,0.4),transparent_70%)]",
                "blur-xl",
              )}
            />
          </div>

          <div
            className={cn(
              "relative z-10 rounded-full px-6 py-3",
              "backdrop-blur-xl",
              "bg-background/10 dark:bg-background/20",
              "ring-1 ring-white/10",
              "shadow-[0_8px_32px_rgba(59,130,246,0.15)]",
              "transition-all duration-200",
              "hover:bg-background/20 hover:shadow-[0_8px_32px_rgba(59,130,246,0.25)]",
            )}
          >
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="text-sm md:text-base font-medium tracking-wide text-foreground">
                {signing ? "Entrando..." : "Entrar com Google"}
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
