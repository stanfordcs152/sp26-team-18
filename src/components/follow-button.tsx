"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { UserCheck, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"

// Follow / unfollow toggle for another user's profile. Optimistically flips
// state, calls /api/follow, then refreshes server data so counts update.
export function FollowButton({
  userId,
  initialFollowing,
}: {
  userId: string
  initialFollowing: boolean
}) {
  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const toggle = async () => {
    const next = !following
    setFollowing(next)
    setError(null)

    const res = await fetch("/api/follow", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })

    if (!res.ok) {
      setFollowing(!next) // revert
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null
      setError(data?.error ?? "Something went wrong.")
      return
    }

    startTransition(() => router.refresh())
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={following ? "outline" : "default"}
        size="sm"
        disabled={pending}
        onClick={toggle}
      >
        {following ? (
          <>
            <UserCheck className="size-4" />
            Following
          </>
        ) : (
          <>
            <UserPlus className="size-4" />
            Follow
          </>
        )}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
