"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flag,
  Inbox,
  Loader2,
  ShieldAlert,
  Trash2,
} from "lucide-react"
import { ModerationQueueLive } from "@/components/moderation-queue-live"
import { supabase } from "@/lib/supabase"
import {
  MODERATION_RISK_SCORE_THRESHOLD,
  shouldFlagAnalysis,
} from "@/lib/analyzers/flag"
import { countRemovedByAuthor, normalizeUsername } from "@/lib/moderation-strikes"
import {
  MODERATION_FILTER_LABELS,
  countModerationFilter,
  matchesModerationFilter,
  type ModerationMetricFilter,
} from "@/lib/moderation-metrics"
import { cn } from "@/lib/utils"
import type {
  LiveQueueItem,
  ModerationQueueData,
  ModerationStats,
  ModerationActionRecord,
  ModerationDecision,
  ModerationStatus,
  Post,
  PostAnalysis,
  PostStatus,
  RiskLevel,
  UserModerationHistory,
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
  moderation_status?: ModerationStatus | null
  moderator_note?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  removed_at?: string | null
  approved_at?: string | null
  escalated_at?: string | null
  analysis?: PostAnalysis | null
  risk_score?: number | null
  risk_level?: string | null
  self_declared_ai?: boolean | null
}

type ModerationActionRow = {
  id: string
  post_id: string
  username: string | null
  action: ModerationDecision
  moderator: string | null
  note: string | null
  post_caption: string | null
  created_at: string
}

type HistoryPostRow = {
  id: string
  username: string | null
  is_flagged: boolean | null
  status?: PostStatus | null
  moderation_status?: ModerationStatus | null
  reviewed_at?: string | null
}

type DashboardState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: ModerationQueueData; error: null }
  | { status: "error"; data: null; error: string }

const POSTS_SELECT_FULL =
  "id, created_at, image_url, caption, username, is_flagged, confidence_score, status, moderation_status, moderator_note, reviewed_at, reviewed_by, removed_at, approved_at, escalated_at, analysis, risk_score, risk_level, self_declared_ai"
const POSTS_SELECT_LEGACY =
  "id, created_at, image_url, caption, username, is_flagged, confidence_score"
const MODERATION_QUEUE_LIMIT = 20

const FILTER_EMPTY_COPY: Record<ModerationMetricFilter, string> = {
  pending: "No posts are awaiting moderator review.",
  highRisk: "No high-risk posts currently require review.",
  critical: "No critical-risk posts are in the queue.",
  reviewedToday: "No posts were reviewed in the last 24 hours.",
  flagsToday: "No posts were flagged in the last 24 hours.",
  flagsThisWeek: "No posts were flagged in the last 7 days.",
  removalsToday: "No posts were removed in the last 24 hours.",
  approvalsToday: "No posts were approved in the last 24 hours.",
  escalationsToday: "No posts were escalated in the last 24 hours.",
}

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
    shouldFlagAnalysis(analysis) ||
    (analysis.ai?.flagged === true &&
      (analysis.vision?.politicalContext === true || publicFigureContext))
  )
}

function rowNeedsReview(row: PostRow) {
  if (row.moderation_status === "pending_review" || row.moderation_status === "escalated") {
    return true
  }

  const alreadyReviewed =
    row.moderation_status === "approved" ||
    row.moderation_status === "removed" ||
    row.status === "removed" ||
    row.status === "labeled" ||
    Boolean(row.moderator_note)
  if (alreadyReviewed) return false

  return (
    row.is_flagged === true ||
    (riskScore(row) ?? 0) >= MODERATION_RISK_SCORE_THRESHOLD ||
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
  const detectionStatus =
    row.moderation_status === "pending_review" || row.moderation_status === "escalated"
      ? "under_review"
      : isFlagged
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
      avatarUrl: "",
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
    status:
      row.moderation_status === "removed"
        ? "removed"
        : row.status ?? "visible",
    moderatorNote: row.moderator_note ?? null,
  }
}

function actionRecord(row: ModerationActionRow): ModerationActionRecord {
  return {
    id: row.id,
    postId: row.post_id,
    username: row.username?.trim() || "unknown_user",
    action: row.action,
    moderator: row.moderator?.trim() || "demo-moderator",
    note: row.note,
    postCaption: row.post_caption,
    createdAt: row.created_at,
  }
}

function buildUserHistories(
  posts: HistoryPostRow[],
  actions: ModerationActionRow[]
): Map<string, UserModerationHistory> {
  const usernames = new Set<string>()
  for (const post of posts) usernames.add(post.username?.trim() || "unknown_user")
  for (const action of actions) usernames.add(action.username?.trim() || "unknown_user")

  const byUsername = new Map<string, UserModerationHistory>()

  for (const username of usernames) {
    const userPosts = posts.filter(
      (post) => (post.username?.trim() || "unknown_user") === username
    )
    const userActions = actions
      .filter((action) => (action.username?.trim() || "unknown_user") === username)
      .map(actionRecord)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

    const flaggedIds = new Set<string>()
    for (const post of userPosts) {
      if (
        post.is_flagged === true ||
        post.moderation_status === "pending_review" ||
        post.moderation_status === "escalated"
      ) {
        flaggedIds.add(post.id)
      }
    }
    for (const action of userActions) flaggedIds.add(action.postId)

    byUsername.set(username, {
      username,
      totalFlagged: flaggedIds.size,
      totalRemoved:
        userActions.filter((action) => action.action === "removed").length ||
        userPosts.filter(
          (post) => post.moderation_status === "removed" || post.status === "removed"
        ).length,
      totalApproved:
        userActions.filter((action) => action.action === "approved").length ||
        userPosts.filter(
          (post) => post.moderation_status === "approved" && Boolean(post.reviewed_at)
        ).length,
      totalEscalated:
        userActions.filter((action) => action.action === "escalated").length ||
        userPosts.filter((post) => post.moderation_status === "escalated").length,
      mostRecentAction: userActions[0] ?? null,
      recentActions: userActions.slice(0, 5),
    })
  }

  return byUsername
}

function buildQueueData(
  rows: PostRow[],
  histories: Map<string, UserModerationHistory>,
  removedByAuthor: Map<string, number>
): ModerationQueueData {
  const toItem = (row: PostRow): LiveQueueItem => {
    const username = row.username?.trim() || "unknown_user"

    return {
      groupKey: row.id,
      post: rowToPost(row),
      postStatus: row.status ?? "visible",
      reports: [],
      newestReportAt: row.created_at,
      oldestReportAt: row.created_at,
      analysis: row.analysis ?? null,
      riskScore: riskScore(row),
      riskLevel: riskLevel(row),
      isFlagged: row.is_flagged === true,
      confidenceScore: row.confidence_score,
      moderationStatus: row.moderation_status ?? null,
      reviewedAt: row.reviewed_at ?? null,
      reviewedBy: row.reviewed_by ?? null,
      removedAt: row.removed_at ?? null,
      approvedAt: row.approved_at ?? null,
      escalatedAt: row.escalated_at ?? null,
      userHistory: histories.get(username) ?? null,
      selfDeclaredAi: row.self_declared_ai ?? null,
      authorRemovedCount: removedByAuthor.get(normalizeUsername(row.username)) ?? 0,
    }
  }

  const allItems = rows.map(toItem)
  const items = rows.filter(rowNeedsReview).slice(0, MODERATION_QUEUE_LIMIT).map(toItem)
  const stats = buildStats(allItems)

  return {
    items,
    allItems,
    stats,
    counters: {
      pending: stats.pending,
      highRisk:
        stats?.highRisk ??
        items.filter(
          (item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL"
        ).length,
      critical:
        stats?.critical ??
        items.filter((item) => item.riskLevel === "CRITICAL").length,
      approvedToday: stats.approvalsToday ?? 0,
      escalated: stats.escalated,
      flagsToday: stats.flagsToday,
      flagsThisWeek: stats.flagsThisWeek,
      removalsToday: stats.removedToday,
      escalationsToday: stats.escalationsToday,
    },
  }
}

function buildStats(items: LiveQueueItem[]): ModerationStats {
  return {
    pending: countModerationFilter(items, "pending"),
    highRisk: countModerationFilter(items, "highRisk"),
    critical: countModerationFilter(items, "critical"),
    reviewedToday: countModerationFilter(items, "reviewedToday"),
    removedToday: countModerationFilter(items, "removalsToday"),
    escalated: countModerationFilter(items, "escalationsToday"),
    avgReviewTime: "—",
    flagsToday: countModerationFilter(items, "flagsToday"),
    flagsThisWeek: countModerationFilter(items, "flagsThisWeek"),
    approvalsToday: countModerationFilter(items, "approvalsToday"),
    escalationsToday: countModerationFilter(items, "escalationsToday"),
  }
}

export function ModerationDashboard() {
  const [state, setState] = useState<DashboardState>({
    status: "loading",
    data: null,
    error: null,
  })
  const [activeFilter, setActiveFilter] = useState<ModerationMetricFilter | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

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
        .or(
          `is_flagged.eq.true,risk_score.gte.${MODERATION_RISK_SCORE_THRESHOLD},risk_level.in.(HIGH,CRITICAL),moderation_status.in.(pending_review,escalated)`
        )
        .order("risk_score", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(MODERATION_QUEUE_LIMIT)

      let rows: PostRow[] | null = null
      // Three-strikes signal: how many of each queued author's posts are already
      // removed platform-wide. `posts` is publicly readable, so the anon client
      // can compute this. Only available on the full path (legacy schema may lack
      // the status column); failures are non-fatal — counts default to 0.
      let removedByAuthor = new Map<string, number>()

      if (!full.error) {
        const platformRows = await supabase
          .from("posts")
          .select(POSTS_SELECT_FULL)
          .order("created_at", { ascending: false })
          .limit(1000)
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const recentDecisions = await supabase
          .from("posts")
          .select(POSTS_SELECT_FULL)
          .or(
            `reviewed_at.gte.${dayAgo},removed_at.gte.${dayAgo},approved_at.gte.${dayAgo},escalated_at.gte.${dayAgo},moderation_status.in.(removed,approved,escalated)`
          )
          .order("reviewed_at", { ascending: false, nullsFirst: false })
          .limit(1000)

        const byId = new Map<string, PostRow>()
        for (const row of (full.data ?? []) as PostRow[]) {
          byId.set(row.id, row)
        }
        if (!platformRows.error) {
          for (const row of (platformRows.data ?? []) as PostRow[]) {
            byId.set(row.id, row)
          }
        }
        if (!recentDecisions.error) {
          for (const row of (recentDecisions.data ?? []) as PostRow[]) {
            byId.set(row.id, row)
          }
        }

        rows = Array.from(byId.values()).sort((a, b) => {
          const scoreDiff = (riskScore(b) ?? -1) - (riskScore(a) ?? -1)
          if (scoreDiff !== 0) return scoreDiff
          return a.created_at < b.created_at ? 1 : -1
        })

        const queueAuthors = Array.from(
          new Set(rows.filter(rowNeedsReview).map((r) => normalizeUsername(r.username)))
        )
        if (queueAuthors.length > 0) {
          const { data: authorPosts } = await supabase
            .from("posts")
            .select("username, status")
            .in("username", queueAuthors)
          removedByAuthor = countRemovedByAuthor(
            (authorPosts ?? []) as {
              username: string | null
              status: PostStatus | null
            }[]
          )
        }
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

      const filteredRows = rows
      const usernames = Array.from(
        new Set(filteredRows.map((row) => row.username?.trim() || "unknown_user"))
      )

      let histories = new Map<string, UserModerationHistory>()
      if (usernames.length > 0) {
        const [historyPosts, historyActions] = await Promise.all([
          supabase
            .from("posts")
            .select("id, username, is_flagged, status, moderation_status, reviewed_at")
            .in("username", usernames)
            .limit(1000),
          supabase
            .from("moderation_actions")
            .select("id, post_id, username, action, moderator, note, post_caption, created_at")
            .in("username", usernames)
            .order("created_at", { ascending: false })
            .limit(100),
        ])

        histories = buildUserHistories(
          historyPosts.error ? [] : ((historyPosts.data ?? []) as HistoryPostRow[]),
          historyActions.error ? [] : ((historyActions.data ?? []) as ModerationActionRow[])
        )
      }

      if (!cancelled) {
        setState({
          status: "ready",
          data: buildQueueData(rows, histories, removedByAuthor),
          error: null,
        })
      }
    }

    void loadQueue()

    return () => {
      cancelled = true
    }
  }, [refreshToken])

  const summary = useMemo(() => {
    const items = state.data?.items ?? []
    const stats = state.data?.stats

    return {
      pending: stats?.pending ?? items.length,
      highRisk:
        stats?.highRisk ??
        items.filter(
          (item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL"
        ).length,
      critical:
        stats?.critical ??
        items.filter((item) => item.riskLevel === "CRITICAL").length,
      reviewedToday: stats?.reviewedToday ?? 0,
      flagsToday: stats?.flagsToday ?? null,
      flagsThisWeek: stats?.flagsThisWeek ?? null,
      removalsToday: stats?.removedToday ?? null,
      approvalsToday: stats?.approvalsToday ?? null,
      escalationsToday: stats?.escalationsToday ?? null,
    }
  }, [state.data])

  const queueItems = useMemo(() => {
    if (!state.data) return []
    if (!activeFilter) return state.data.items
    return (state.data.allItems ?? state.data.items).filter((item) =>
      matchesModerationFilter(item, activeFilter)
    )
  }, [activeFilter, state.data])

  const queueTitle = activeFilter
    ? `${MODERATION_FILTER_LABELS[activeFilter]} Queue`
    : "Flagged Queue"
  const queueDescription = activeFilter
    ? `${queueItems.length} matching Supabase post${queueItems.length === 1 ? "" : "s"}.`
    : `${queueItems.length} Supabase post${queueItems.length === 1 ? "" : "s"} awaiting review.`
  const emptyTitle = activeFilter
    ? FILTER_EMPTY_COPY[activeFilter]
    : "No flagged content currently requires moderator review."

  const metricCards: {
    key: ModerationMetricFilter
    label: string
    value: number | string | null
    detail: string
    icon: typeof Clock3
  }[] = [
    {
      key: "pending",
      label: "Pending Review",
      value: summary.pending,
      detail: "Flagged or pending posts",
      icon: Clock3,
    },
    {
      key: "highRisk",
      label: "High Risk",
      value: summary.highRisk,
      detail: "HIGH, CRITICAL, or score >= 60%",
      icon: ShieldAlert,
    },
    {
      key: "critical",
      label: "Critical",
      value: summary.critical,
      detail: "CRITICAL or score >= 85%",
      icon: AlertTriangle,
    },
    {
      key: "reviewedToday",
      label: "Reviewed Today",
      value: summary.reviewedToday,
      detail: "Reviewed in last 24h",
      icon: CheckCircle2,
    },
    {
      key: "flagsToday",
      label: "Flags Today",
      value: summary.flagsToday,
      detail: "Analysis flags in last 24h",
      icon: Flag,
    },
    {
      key: "flagsThisWeek",
      label: "Flags This Week",
      value: summary.flagsThisWeek,
      detail: "Analysis flags in last 7 days",
      icon: CalendarDays,
    },
    {
      key: "removalsToday",
      label: "Removals Today",
      value: summary.removalsToday,
      detail: "Removed posts",
      icon: Trash2,
    },
    {
      key: "approvalsToday",
      label: "Approvals Today",
      value: summary.approvalsToday,
      detail: "Approved in last 24h",
      icon: CheckCircle2,
    },
    {
      key: "escalationsToday",
      label: "Escalations Today",
      value: summary.escalationsToday,
      detail: "Escalated in last 24h",
      icon: Flag,
    },
  ]

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
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metricCards.map((card) => (
          <SummaryCard
            key={card.key}
            label={card.label}
            value={card.value}
            detail={card.detail}
            icon={card.icon}
            active={activeFilter === card.key}
            onClick={() =>
              setActiveFilter((current) => (current === card.key ? null : card.key))
            }
          />
        ))}
      </section>

      {activeFilter ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/80 px-4 py-3 shadow-sm">
          <div>
            <p className="text-sm font-semibold">{MODERATION_FILTER_LABELS[activeFilter]}</p>
            <p className="text-xs text-muted-foreground">
              Showing {queueItems.length} matching post{queueItems.length === 1 ? "" : "s"}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveFilter(null)}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear filter
          </button>
        </div>
      ) : null}

      {queueItems.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-border/70 bg-card/80 px-6 text-center shadow-sm">
          <div className="flex size-12 items-center justify-center rounded-full border border-border bg-background">
            <Inbox className="size-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">{emptyTitle}</h2>
          {!activeFilter ? (
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Posts will appear here when Supabase rows are flagged, high risk, or
              contain manipulation and political misinformation signals.
            </p>
          ) : null}
        </div>
      ) : (
        <ModerationQueueLive
          items={queueItems}
          queueTitle={queueTitle}
          queueDescription={queueDescription}
          emptyTitle={emptyTitle}
          emptyDescription={
            activeFilter
              ? null
              : "New flagged uploads will appear here after automated analysis."
          }
          onDecisionPersisted={() => setRefreshToken((token) => token + 1)}
        />
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  value: number | string | null
  detail: string
  icon: typeof Clock3
  active: boolean
  onClick: () => void
}) {
  const displayValue = value === null ? "Unavailable" : value

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "cursor-pointer rounded-xl border bg-card/80 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary/60 bg-primary/10 ring-1 ring-primary/25"
          : "border-border/70"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{displayValue}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </button>
  )
}
