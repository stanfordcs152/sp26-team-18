import {
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpCircle,
  Inbox,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { ModerationStats } from "@/lib/types"

interface ModerationStatsProps {
  stats: ModerationStats
}

export function ModerationStatsBar({ stats }: ModerationStatsProps) {
  const statItems = [
    {
      label: "Pending",
      value: stats.pending,
      icon: Inbox,
      className: "text-amber-500",
    },
    {
      label: "Reviewed Today",
      value: stats.reviewedToday,
      icon: CheckCircle2,
      className: "text-emerald-500",
    },
    {
      label: "Removed Today",
      value: stats.removedToday,
      icon: XCircle,
      className: "text-red-500",
    },
    {
      label: "Escalated",
      value: stats.escalated,
      icon: ArrowUpCircle,
      className: "text-blue-500",
    },
    {
      label: "Avg. Review Time",
      value: stats.avgReviewTime,
      icon: Clock,
      className: "text-muted-foreground",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {statItems.map((item) => {
        const Icon = item.icon
        return (
          <Card key={item.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`size-4 ${item.className}`} />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
              <p className="text-2xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
