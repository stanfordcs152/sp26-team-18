"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, Clock, Inbox, ShieldCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { ModeratorAnalytics } from "@/lib/types"

// PRD target false-positive rate; the FPR card turns red above this.
const FPR_TARGET = 0.05

function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return "—"
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hours = Math.round((ms / 3_600_000) * 10) / 10
  if (hours < 24) return `${hours}h`
  const days = Math.round((ms / 86_400_000) * 10) / 10
  return `${days}d`
}

export function ModeratorAnalyticsPanel({
  analytics,
}: {
  analytics: ModeratorAnalytics
}) {
  const { weeklyFlags, decisionTrend, falsePositiveRate, reviewedTotal, backlog, avgReviewMs } =
    analytics

  const fprOk = falsePositiveRate !== null && falsePositiveRate <= FPR_TARGET

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Moderator statistics</h2>
        <span className="text-xs text-muted-foreground">
          Trailing {weeklyFlags.length} weeks
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="False-positive rate"
          value={
            falsePositiveRate === null
              ? "—"
              : `${(falsePositiveRate * 100).toFixed(1)}%`
          }
          hint={`Target ≤ ${(FPR_TARGET * 100).toFixed(0)}%`}
          icon={AlertTriangle}
          className={
            falsePositiveRate === null
              ? "text-muted-foreground"
              : fprOk
                ? "text-emerald-500"
                : "text-red-500"
          }
        />
        <StatCard
          label="Open reports (backlog)"
          value={String(backlog)}
          hint="Awaiting review"
          icon={Inbox}
          className="text-amber-500"
        />
        <StatCard
          label="Avg. time to review"
          value={formatDuration(avgReviewMs)}
          hint="Report filed → resolved"
          icon={Clock}
          className="text-muted-foreground"
        />
        <StatCard
          label="Reviewed (all time)"
          value={String(reviewedTotal)}
          hint="Resolved reports"
          icon={ShieldCheck}
          className="text-blue-500"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-medium">Weekly flag counts</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weeklyFlags} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" name="Flagged" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-medium">Decisions over time</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={decisionTrend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="approved" name="Approved" stackId="d" fill="#10b981" />
                <Bar dataKey="labeled" name="Labeled" stackId="d" fill="#f59e0b" />
                <Bar dataKey="removed" name="Removed" stackId="d" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: {
  label: string
  value: string
  hint: string
  icon: typeof Clock
  className: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-1 flex items-center gap-2">
          <Icon className={`size-4 ${className}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
