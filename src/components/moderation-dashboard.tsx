"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Inbox,
  Loader2,
  ShieldAlert,
} from "lucide-react"
import { ModerationQueueLive } from "@/components/moderation-queue-live"
import { supabase } from "@/lib/supabase"
import type {
  LiveQueueItem,
  ModerationQueueData,
  ModerationStats,
  Post,
  PostAnalysis,
  PostStatus,
  RiskLevel,
} from "@/lib/types"

type PostRow = {
  id: string
  created_at: string
  image_url: string | null
  caption: string | null
  username: string | null
  is_flagged: boolean | null
  confidence_score: number | null
  status?: PostStatus | null
  moderator_note?: string | null
  analysis?: PostAnalysis | null
  risk_score?: number | null
  risk_level?: string | null
}

type DashboardState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: ModerationQueueData; error: null }
  | { status: "error"; data: null; error: string }

const POSTS_SELECT_FULL =
  "id, created_at, image_url, caption, username, is_flagged, confidence_score, status, moderator_note, analysis, risk_score, risk_level"
const POSTS_SELECT_LEGACY =
  "id, created_at, image_url, caption, username, is_flagged, confidence_score"
const MODERATION_QUEUE_LIMIT = 20

const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"

function isRiskLevel(value: string | null | undefined): value is RiskLevel {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "CRITICAL"
}

function highOrCritical(value: string | null | undefined) {
  return value === "HIGH" || value === "CRITICAL"
}

function analysisNeedsReview(analysis: PostAnalysis | null | undefined) {
  if (!analysis) return false

  const publicFigureContext =
    (analysis.politicians?.detected?.length ?? 0) > 0 ||
    (analysis.vision?.publicFigures?.length ?? 0) > 0

  return (
    highOrCritical(analysis.risk?.level) ||
    highOrCritical(analysis.vision?.misinformationRisk) ||
    analysis.manipulationSignals?.possibleKnownManipulation === true ||
    analysis.vision?.possibleKnownManipulation === true ||
    (analysis.ai?.flagged === true &&
      (analysis.vision?.politicalContext === true || publicFigureContext))
  )
}

function rowNeedsReview(row: PostRow) {
  const alreadyReviewed = row.status === "removed" || row.status === "labeled" || Boolean(row.moderator_note)
  if (alreadyReviewed) return false

  return (
    row.is_flagged === true ||
    highOrCritical(row.risk_level) ||
    analysisNeedsReview(row.analysis)
  )
}

function riskScore(row: PostRow) {
  if (typeof row.risk_score === "number") return row.risk_score
  if (typeof row.analysis?.risk?.score === "number") return row.analysis.risk.score
  if (typeof row.confidence_score === "number") return row.confidence_score / 100
  return null
}

function riskLevel(row: PostRow): RiskLevel | null {
  if (isRiskLevel(row.risk_level)) return row.risk_level
  const analysisLevel = row.analysis?.risk?.level
  return isRiskLevel(analysisLevel) ? analysisLevel : null
}

function rowToPost(row: PostRow): Post {
  const isFlagged = Boolean(row.is_flagged)
  const score = riskScore(row)
  const confidence = Math.round(
    typeof row.confidence_score === "number"
      ? row.confidence_score
      : typeof score === "number"
        ? score * 100
        : 0
  )
  const detectionStatus = isFlagged
    ? confidence >= 90
      ? "confirmed_ai"
      : "likely_ai"
    : "authentic"

  const username = row.username?.trim() || "unknown_user"
  const caption = row.caption ?? ""

  return {
    id: row.id,
    author: {
      id: username,
      username,
      displayName: username,
      avatarUrl: FALLBACK_AVATAR,
      verified: false,
    },
    content: caption,
    media: row.image_url
      ? [
          {
            id: `${row.id}-media`,
            type: "image",
            url: row.image_url,
            altText: caption || "Flagged media",
            aiDetection: {
              status: detectionStatus,
              confidence,
              flags: isFlagged ? ["Potential manipulated or synthetic content"] : [],
              analyzedAt: row.created_at,
            },
          },
        ]
      : [],
    createdAt: row.created_at,
    likes: 0,
    comments: 0,
    shares: 0,
    isLiked: false,
    isBookmarked: false,
    status: row.status ?? "visible",
    moderatorNote: row.moderator_note ?? null,
  }
}

function buildQueueData(rows: PostRow[]): ModerationQueueData {
  const items: LiveQueueItem[] = rows
    .filter(rowNeedsReview)
    .slice(0, MODERATION_QUEUE_LIMIT)
    .map((row) => ({
      groupKey: row.id,
      post: rowToPost(row),
      postStatus: row.status ?? "visible",
      reports: [],
      newestReportAt: row.created_at,
      oldestReportAt: row.created_at,
      analysis: row.analysis ?? null,
      riskScore: riskScore(row),
      riskLevel: riskLevel(row),
    }))

  const reviewedToday = rows.filter((row) => {
    if (!row.moderator_note) return false
    return Date.now() - new Date(row.created_at).getTime() < 24 * 60 * 60 * 1000
  }).length

  const removedToday = rows.filter((row) => {
    if (row.status !== "removed") return false
    return Date.now() - new Date(row.created_at).getTime() < 24 * 60 * 60 * 1000
  }).length

  const stats: ModerationStats = {
    pending: items.length,
    reviewedToday,
    removedToday,
    escalated: items.filter((item) => item.riskLevel === "CRITICAL").length,
    avgReviewTime: "—",
  }

  return {
    items,
    stats,
    counters: {
      pending: items.length,
      highRisk: items.filter(
        (item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL"
      ).length,
      approvedToday: Math.max(0, reviewedToday - removedToday),
      escalated: stats.escalated,
    },
  }
}

export function ModerationDashboard() {
  const [state, setState] = useState<DashboardState>({
    status: "loading",
    data: null,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    const loadQueue = async () => {
      if (!supabase) {
        setState({
          status: "error",
          data: null,
          error: "Supabase environment variables are missing.",
        })
        return
      }

      setState({ status: "loading", data: null, error: null })

      const full = await supabase
        .from("posts")
        .select(POSTS_SELECT_FULL)
        .or("is_flagged.eq.true,risk_level.in.(HIGH,CRITICAL)")
        .order("risk_score", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(MODERATION_QUEUE_LIMIT)

      let rows: PostRow[] | null = null

      if (!full.error) {
        rows = (full.data ?? []) as PostRow[]
      } else {
        const legacy = await supabase
          .from("posts")
          .select(POSTS_SELECT_LEGACY)
          .eq("is_flagged", true)
          .order("created_at", { ascending: false })
          .limit(MODERATION_QUEUE_LIMIT)

        if (legacy.error) {
          if (!cancelled) {
            setState({
              status: "error",
              data: null,
              error: legacy.error.message,
            })
          }
          return
        }

        rows = (legacy.data ?? []) as PostRow[]
      }

      if (!cancelled) {
        setState({
          status: "ready",
          data: buildQueueData(rows),
          error: null,
        })
      }
    }

    void loadQueue()

    return () => {
      cancelled = true
    }
  }, [])

  const summary = useMemo(() => {
    const items = state.data?.items ?? []

    return {
      pending: items.length,
      highRisk: items.filter(
        (item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL"
      ).length,
      critical: items.filter((item) => item.riskLevel === "CRITICAL").length,
      reviewedToday: state.data?.stats.reviewedToday ?? 0,
    }
  }, [state.data])

  if (state.status === "loading") {
    return (
      <div className="rounded-xl border border-border/70 bg-card/80 p-10 text-center shadow-sm">
        <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Loading moderation queue</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Reading flagged posts and risk analysis from Supabase.
        </p>
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <h2 className="font-semibold">Could not load moderation data</h2>
            <p className="mt-1 text-sm">{state.error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          label="Pending Review"
          value={summary.pending}
          detail="Posts in queue"
          icon={Clock3}
        />
        <SummaryCard
          label="High Risk"
          value={summary.highRisk}
          detail="HIGH or CRITICAL risk"
          icon={ShieldAlert}
        />
        <SummaryCard
          label="Critical"
          value={summary.critical}
          detail="Highest-priority reviews"
          icon={AlertTriangle}
        />
        <SummaryCard
          label="Reviewed Today"
          value={summary.reviewedToday}
          detail="Resolved in last 24h"
          icon={CheckCircle2}
        />
      </section>

      {state.data.items.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-border/70 bg-card/80 px-6 text-center shadow-sm">
          <div className="flex size-12 items-center justify-center rounded-full border border-border bg-background">
            <Inbox className="size-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">No flagged posts awaiting review.</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Posts will appear here when Supabase rows are flagged, high risk, or
            contain manipulation and political misinformation signals.
          </p>
        </div>
      ) : (
        <ModerationQueueLive items={state.data.items} />
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: number | string
  detail: string
  icon: typeof Clock3
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}
