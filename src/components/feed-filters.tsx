"use client"

import { cn } from "@/lib/utils"
import { ShieldCheck, ShieldAlert, Layers } from "lucide-react"

export type FilterType = "all" | "authentic" | "flagged"

interface FeedFiltersProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
}

const filters: { value: FilterType; label: string; icon: typeof Layers }[] = [
  { value: "all", label: "All Posts", icon: Layers },
  { value: "authentic", label: "Verified Authentic", icon: ShieldCheck },
  { value: "flagged", label: "Flagged Content", icon: ShieldAlert },
]

export function FeedFilters({ activeFilter, onFilterChange }: FeedFiltersProps) {
  return (
    <div className="flex border-b border-border">
      {filters.map((filter) => {
        const Icon = filter.icon
        const isActive = activeFilter === filter.value

        return (
          <button
            key={filter.value}
            onClick={() => onFilterChange(filter.value)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors relative",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <Icon className="size-4" />
            <span>{filter.label}</span>
            {isActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-primary" />
            )}
          </button>
        )
      })}
    </div>
  )
}
