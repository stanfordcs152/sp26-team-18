"use client"

import { cn } from "@/lib/utils"
import { Bot, Layers, ShieldCheck } from "lucide-react"

export type FilterType = "all" | "authentic" | "flagged"

interface FeedFiltersProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
}

const filters: { value: FilterType; label: string; icon: typeof Layers }[] = [
  { value: "all", label: "All Posts", icon: Layers },
  { value: "authentic", label: "Verified Authentic", icon: ShieldCheck },
  { value: "flagged", label: "AI-Generated", icon: Bot },
]

export function FeedFilters({ activeFilter, onFilterChange }: FeedFiltersProps) {
  return (
    <div className="flex border-b border-border/70 bg-background/80">
      {filters.map((filter) => {
        const Icon = filter.icon
        const isActive = activeFilter === filter.value

        return (
          <button
            key={filter.value}
            onClick={() => onFilterChange(filter.value)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            <span>{filter.label}</span>
            {isActive && (
              <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-foreground" />
            )}
          </button>
        )
      })}
    </div>
  )
}
