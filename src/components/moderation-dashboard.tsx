"use client"

import { useState, useCallback } from "react"
import { AlertTriangle, BarChart3, CheckCircle2, Clock3 } from "lucide-react"
import { ModerationStatsBar } from "@/components/moderation-stats"
import { ModerationQueueLive } from "@/components/moderation-queue-live"
import type { ModerationStats } from "@/lib/types"

const EMPTY_STATS: ModerationStats = {
  pending: 0,
  reviewedToday: 0,
  removedToday: 0,
  escalated: 0,
  avgReviewTime: "—",
}

export interface DashboardCounters {
  pending: number
  highRisk: number
  approvedToday: number
  escalated: number
}

const EMPTY_COUNTERS: DashboardCounters = {
  pending: 0,
  highRisk: 0,
  approvedToday: 0,
  escalated: 0,
}

export function ModerationDashboard() {
  const [stats, setStats] = useState<ModerationStats>(EMPTY_STATS)
  const [counters, setCounters] = useState<DashboardCounters>(EMPTY_COUNTERS)

  const handleStats = useCallback(
    (next: ModerationStats, nextCounters: DashboardCounters) => {
      setStats(next)
      setCounters(nextCounters)
    },
    []
  )

  return (
    <>
      {counters.highRisk > 0 && (
        <div className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 w-fit">
          <AlertTriangle className="size-4" />
          <span className="text-sm font-medium">
            {counters.highRisk} high-risk item{counters.highRisk > 1 ? "s" : ""}{" "}
            in queue
          </span>
        </div>
      )}

      <section className="mb-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Posts Under Review</p>
            <Clock3 className="size-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold">{counters.pending}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">High Risk Content</p>
            <AlertTriangle className="size-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold">{counters.highRisk}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Approved Today</p>
            <CheckCircle2 className="size-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold">{counters.approvedToday}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Escalated (Critical)</p>
            <BarChart3 className="size-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold">{counters.escalated}</p>
        </div>
      </section>

      <section className="mb-8">
        <ModerationStatsBar stats={stats} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Review Queue</h2>
          <span className="text-sm text-muted-foreground">
            {counters.pending} item{counters.pending === 1 ? "" : "s"} pending
          </span>
        </div>
        <ModerationQueueLive onStats={handleStats} />
      </section>
    </>
  )
}
