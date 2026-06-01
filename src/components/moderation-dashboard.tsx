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
import { mockModerationQueue } from "@/lib/mock-data"
import type { LiveQueueItem, ModerationQueueData, RiskLevel } from "@/lib/types"

interface Props {
  // True only when live moderator data was loaded. When false we render the
  // mock-data dashboard so the poster demo works without a login step.
  configured: boolean
  // Queue + stats loaded server-side as the signed-in moderator. Null when
  // unconfigured, or when the load failed (RLS / missing migration).
  data: ModerationQueueData | null
}

export function ModerationDashboard({ configured, data }: Props) {
  // Unconfigured, or a load failure: fall back to the mock priority queue.
  if (!configured || !data) {
    const mockItems: LiveQueueItem[] = mockModerationQueue.map((item) => {
      const riskLevelByPriority: Record<typeof item.priority, RiskLevel> = {
        low: "LOW",
        medium: "MEDIUM",
        high: "HIGH",
        critical: "CRITICAL",
      }
      const media = item.post.media[0]

      return {
        groupKey: item.post.id,
        post: item.post,
        postStatus: item.post.status ?? "visible",
        reports: Array.from({ length: Math.max(1, item.reportCount) }).map(
          (_, index) => ({
            id: `mock-${item.id}-${index}`,
            reason: "ai_generated_political",
            details: item.reportReasons[index % item.reportReasons.length] ?? null,
            reporterUsername: `reporter_${index + 1}`,
            createdAt: item.flaggedAt,
          })
        ),
        newestReportAt: item.flaggedAt,
        oldestReportAt: item.flaggedAt,
        analysis: null,
        riskScore: media ? media.aiDetection.confidence / 100 : null,
        riskLevel: riskLevelByPriority[item.priority],
      }
    })

    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          <span>
            {configured
              ? "Couldn't load live reports — showing mock data. Check that the Supabase migrations have been applied."
              : "Demo mode is active. Showing a sample flagged-content queue so judges can open the moderator console without signing in."}
          </span>
        </div>
        <ModerationQueueLive items={mockItems} />
      </div>
    )
  }

  const { stats, counters } = data

  return (
    <>
      {counters.highRisk > 0 && (
        <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-red-500">
          <AlertTriangle className="size-4" />
          <span className="text-sm font-medium">
            {counters.highRisk} high-risk item{counters.highRisk > 1 ? "s" : ""}{" "}
            in queue
          </span>
        </div>
      )}

      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-card/75 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Posts Under Review</p>
            <Clock3 className="size-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold">{counters.pending}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/75 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">High Risk Content</p>
            <AlertTriangle className="size-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold">{counters.highRisk}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/75 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Approved Today</p>
            <CheckCircle2 className="size-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold">{counters.approvedToday}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/75 p-4 shadow-sm">
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Review Queue</h2>
          <span className="text-sm text-muted-foreground">
            {counters.pending} item{counters.pending === 1 ? "" : "s"} pending
          </span>
        </div>
        <ModerationQueueLive items={data.items} />
      </section>
    </>
  )
}
