"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { validatePassword } from "@/lib/password"

type Mode = "signin" | "signup"

function AuthForm() {
  const params = useSearchParams()
  const redirect = params.get("redirect") || "/"

  const [mode, setMode] = useState<Mode>("signin")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (mode === "signup") {
      const weak = validatePassword(password)
      if (weak) {
        setError(weak)
        return
      }
    }

    setSubmitting(true)

    const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/signup"
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "signin"
          ? { email, password }
          : { email, password, username }
      ),
    })

    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      // Account created but email confirmation is required: stay on the page
      // and tell the user to confirm before signing in.
      if (data?.needsConfirmation) {
        setNotice("Check your email to confirm your account, then sign in.")
        setMode("signin")
        setPassword("")
        setSubmitting(false)
        return
      }
      // Hard navigation so the freshly-set session cookie is sent on the next
      // request (matches the moderator login flow).
      window.location.assign(redirect)
      return
    }

    setError(data?.error ?? "Something went wrong")
    setSubmitting(false)
  }

  const isSignin = mode === "signin"

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border p-6"
      >
        <div className="flex items-center gap-3">
          <Shield className="size-7 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">
              {isSignin ? "Sign in to TruthGuard" : "Create your account"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isSignin
                ? "Sign in to post and interact with the feed."
                : "Sign up to join the TruthGuard platform."}
            </p>
          </div>
        </div>

        {!isSignin ? (
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete={isSignin ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {!isSignin ? (
            <p className="text-xs text-muted-foreground">
              At least 8 characters, including a number and a special character.
            </p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {notice ? (
          <p className="text-sm text-muted-foreground">{notice}</p>
        ) : null}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting
            ? isSignin
              ? "Signing in..."
              : "Creating account..."
            : isSignin
              ? "Sign in"
              : "Create account"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {isSignin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => {
              setMode(isSignin ? "signup" : "signin")
              setError(null)
              setNotice(null)
            }}
          >
            {isSignin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </form>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
          Loading...
        </main>
      }
    >
      <AuthForm />
    </Suspense>
  )
}
