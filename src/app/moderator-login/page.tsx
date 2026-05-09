"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function LoginForm() {
  const params = useSearchParams()
  const redirect = params.get("redirect") || "/moderation"
  const initialError =
    params.get("error") === "unconfigured"
      ? "Moderator gate is not configured. Set MODERATOR_PASSWORD and MODERATOR_SESSION_SECRET."
      : null

  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(initialError)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const res = await fetch("/api/moderator/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      // Hard navigation so the freshly-set session cookie is sent on the
      // next request and the proxy gate sees it. router.push() does a soft
      // RSC navigation that, if the proxy bounces it back here, leaves the
      // form mounted with `submitting` stuck at true.
      window.location.assign(redirect)
      return
    }

    const data = await res.json().catch(() => ({}))
    setError(data?.error ?? "Login failed")
    setSubmitting(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border p-6"
      >
        <div className="flex items-center gap-3">
          <Shield className="size-7 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Moderator sign-in</h1>
            <p className="text-xs text-muted-foreground">
              Shared password required to view the moderation dashboard.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </main>
  )
}

export default function ModeratorLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
          Loading...
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
