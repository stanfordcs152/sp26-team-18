"use client"

import { useState } from "react"
import { Inbox } from "lucide-react"
import { ModerationCardLive } from "@/components/moderation-card-live"
import type { LiveQueueItem } from "@/lib/types"

interface Props {
  items: LiveQueueItem[]
}

// Presentational live queue. The data is fetched server-side (as the signed-in
// moderator, so RLS applies) and passed in. Resolved cards are hidden locally;
// a navigation / refresh re-fetches fresh state from the server.
export function ModerationQueueLive({ items }: Props) {
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set())

  const markResolved = (postId: string) => {
    setResolvedKeys((prev) => new Set(prev).add(postId))
  }

  const visibleItems = items.filter((it) => !resolvedKeys.has(it.groupKey))

  if (visibleItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Inbox className="size-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground">No open reports</h3>
        <p className="text-sm text-muted-foreground mt-1">
          When users report posts, they&apos;ll appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {visibleItems.map((item) => (
        <ModerationCardLive
          key={item.groupKey}
          item={item}
          onResolved={markResolved}
        />
      ))}
    </div>
  )
}
