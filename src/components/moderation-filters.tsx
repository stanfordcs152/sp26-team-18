"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Flame, AlertCircle, CircleDot } from "lucide-react"

type PriorityFilter = "all" | "critical" | "high" | "medium" | "low"

interface ModerationFiltersProps {
  activeFilter: PriorityFilter
  onFilterChange: (filter: PriorityFilter) => void
  counts: Record<PriorityFilter, number>
}

const filterConfig: Record<
  PriorityFilter,
  { label: string; icon?: typeof AlertTriangle; className: string }
> = {
  all: {
    label: "All",
    className: "data-[active=true]:bg-foreground data-[active=true]:text-background",
  },
  critical: {
    label: "Critical",
    icon: AlertTriangle,
    className: "data-[active=true]:bg-red-500/20 data-[active=true]:text-red-500 data-[active=true]:border-red-500/30",
  },
  high: {
    label: "High",
    icon: Flame,
    className: "data-[active=true]:bg-orange-500/20 data-[active=true]:text-orange-500 data-[active=true]:border-orange-500/30",
  },
  medium: {
    label: "Medium",
    icon: AlertCircle,
    className: "data-[active=true]:bg-amber-500/20 data-[active=true]:text-amber-500 data-[active=true]:border-amber-500/30",
  },
  low: {
    label: "Low",
    icon: CircleDot,
    className: "data-[active=true]:bg-slate-500/20 data-[active=true]:text-slate-400 data-[active=true]:border-slate-500/30",
  },
}

export function ModerationFilters({
  activeFilter,
  onFilterChange,
  counts,
}: ModerationFiltersProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {(Object.keys(filterConfig) as PriorityFilter[]).map((filter) => {
        const config = filterConfig[filter]
        const Icon = config.icon
        const isActive = activeFilter === filter
        const count = counts[filter]

        return (
          <Button
            key={filter}
            variant="outline"
            size="sm"
            data-active={isActive}
            onClick={() => onFilterChange(filter)}
            className={cn(
              "gap-1.5 border-border",
              config.className
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {config.label}
            <span className="ml-1 text-xs opacity-70">({count})</span>
          </Button>
        )
      })}
    </div>
  )
}
