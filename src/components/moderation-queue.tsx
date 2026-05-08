"use client"

import { useState, useMemo } from "react"
import type { ModerationQueueItem, ModerationAction } from "@/lib/types"
import { ModerationCard } from "@/components/moderation-card"
import { ModerationFilters } from "@/components/moderation-filters"
import { Inbox } from "lucide-react"

type PriorityFilter = "all" | "critical" | "high" | "medium" | "low"

interface ModerationQueueProps {
  items: ModerationQueueItem[]
}

export function ModerationQueue({ items }: ModerationQueueProps) {
  const [filter, setFilter] = useState<PriorityFilter>("all")
  const [actionedItems, setActionedItems] = useState<Set<string>>(new Set())

  const filteredItems = useMemo(() => {
    let filtered = items
    if (filter !== "all") {
      filtered = items.filter((item) => item.priority === filter)
    }
    // Sort by priority: critical > high > medium > low
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return filtered.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    )
  }, [items, filter])

  const counts = useMemo(() => {
    return {
      all: items.length,
      critical: items.filter((i) => i.priority === "critical").length,
      high: items.filter((i) => i.priority === "high").length,
      medium: items.filter((i) => i.priority === "medium").length,
      low: items.filter((i) => i.priority === "low").length,
    }
  }, [items])

  const handleAction = (id: string, action: ModerationAction) => {
    if (action !== "pending") {
      setActionedItems((prev) => new Set(prev).add(id))
    } else {
      setActionedItems((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <div className="space-y-4">
      <ModerationFilters
        activeFilter={filter}
        onFilterChange={setFilter}
        counts={counts}
      />

      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="size-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              No items in queue
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === "all"
                ? "All flagged content has been reviewed"
                : `No ${filter} priority items to review`}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <ModerationCard
              key={item.id}
              item={item}
              onAction={handleAction}
            />
          ))
        )}
      </div>
    </div>
  )
}
