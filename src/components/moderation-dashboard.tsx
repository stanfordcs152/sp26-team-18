"use client"

import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
} from "lucide-react"
import { ModerationStatsBar } from "@/components/moderation-stats"
import { ModerationQueueLive } from "@/components/moderation-queue-live"
import { ModerationQueue } from "@/components/moderation-queue"
import { mockModerationQueue } from "@/lib/mock-data"
import type { ModerationQueueData } from "@/lib/types"

interface Props {
  // True when Supabase is configured (real auth + data). When false we render
  // the mock-data dashboard so the demo still works without env vars.
  configured: boolean
  // Queue + stats loaded server-side as the signed-in moderator. Null when
  // unconfigured, or when the load failed (RLS / missing migration).
  data: ModerationQueueData | null
}

export function ModerationDashboard({ configured, data }: Props) {
  // Unconfigured, or a load failure: fall back to the mock priority queue.
  if (!configured || !data) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          <span>
            {configured
              ? "Couldn't load live reports — showing mock data. Check that the Supabase migrations have been applied."
              : "Supabase is not configured. Showing mock data; reports submitted from the feed won't appear here until env vars are set."}
          </span>
        </div>
        <ModerationQueue items={mockModerationQueue} />
      </div>
    )
  }

  const { stats, counters } = data

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
        <ModerationQueueLive items={data.items} />
      </section>
    </>
  )
}
