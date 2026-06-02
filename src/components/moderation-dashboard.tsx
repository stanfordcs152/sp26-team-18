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
import { shouldFlagAnalysis } from "@/lib/analyzers/flag"
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
  "id, created_at, image_url, caption, username, is_flagged, confidence_score, status, moderation_status, moderator_note, reviewed_at, reviewed_by, removed_at, analysis, risk_score, risk_level, self_declared_ai"
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
  stats: ModerationStats,
  removedByAuthor: Map<string, number>
): ModerationQueueData {
  const items: LiveQueueItem[] = rows
    .filter(rowNeedsReview)
    .slice(0, MODERATION_QUEUE_LIMIT)
    .map((row) => {
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
        confidenceScore: row.confidence_score,
        moderationStatus: row.moderation_status ?? null,
        reviewedAt: row.reviewed_at ?? null,
        reviewedBy: row.reviewed_by ?? null,
        removedAt: row.removed_at ?? null,
        userHistory: histories.get(username) ?? null,
        selfDeclaredAi: row.self_declared_ai ?? null,
        authorRemovedCount: removedByAuthor.get(normalizeUsername(row.username)) ?? 0,
      }
    })

  return {
    items,
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

async function loadStats(fallbackPending: number): Promise<ModerationStats> {
  if (!supabase) {
    return {
      pending: fallbackPending,
      reviewedToday: 0,
      removedToday: 0,
      escalated: 0,
      avgReviewTime: "—",
      flagsToday: null,
      flagsThisWeek: null,
      approvalsToday: null,
      escalationsToday: null,
    }
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    pendingRes,
    highRiskRes,
    criticalRes,
    reviewedTodayRes,
    flagsTodayRes,
    flagsThisWeekRes,
    removalsTodayRes,
    approvalsTodayRes,
    escalationsTodayRes,
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .or("is_flagged.eq.true,moderation_status.in.(pending_review,escalated)"),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .in("risk_level", ["HIGH", "CRITICAL"]),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("risk_level", "CRITICAL"),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .not("reviewed_at", "is", null)
      .gte("reviewed_at", dayAgo),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("is_flagged", true)
      .gte("created_at", dayAgo),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("is_flagged", true)
      .gte("created_at", weekAgo),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "removed")
      .gte("reviewed_at", dayAgo),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "approved")
      .gte("reviewed_at", dayAgo),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "escalated")
      .gte("reviewed_at", dayAgo),
  ])

  const pending = pendingRes.error ? null : pendingRes.count ?? 0
  const highRisk = highRiskRes.error ? null : highRiskRes.count ?? 0
  const critical = criticalRes.error ? null : criticalRes.count ?? 0
  const reviewedToday = reviewedTodayRes.error ? null : reviewedTodayRes.count ?? 0
  const flagsToday = flagsTodayRes.error ? null : flagsTodayRes.count ?? 0
  const flagsThisWeek = flagsThisWeekRes.error ? null : flagsThisWeekRes.count ?? 0
  const removalsToday = removalsTodayRes.error ? null : removalsTodayRes.count ?? 0
  const approvalsToday = approvalsTodayRes.error ? null : approvalsTodayRes.count ?? 0
  const escalationsToday = escalationsTodayRes.error ? null : escalationsTodayRes.count ?? 0

  return {
    pending: pending ?? fallbackPending,
    highRisk,
    critical,
    reviewedToday: reviewedToday ?? 0,
    removedToday: removalsToday ?? 0,
    escalated: escalationsToday ?? 0,
    avgReviewTime: "—",
    flagsToday,
    flagsThisWeek,
    approvalsToday,
    escalationsToday,
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
        .or("is_flagged.eq.true,risk_level.in.(HIGH,CRITICAL),moderation_status.in.(pending_review,escalated)")
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
        const recent = await supabase
          .from("posts")
          .select(POSTS_SELECT_FULL)
          .order("created_at", { ascending: false })
          .limit(50)

        const byId = new Map<string, PostRow>()
        for (const row of (full.data ?? []) as PostRow[]) {
          byId.set(row.id, row)
        }
        if (!recent.error) {
          for (const row of (recent.data ?? []) as PostRow[]) {
            byId.set(row.id, row)
          }
        }

        rows = Array.from(byId.values()).sort((a, b) => {
          const scoreDiff = (riskScore(b) ?? -1) - (riskScore(a) ?? -1)
          if (scoreDiff !== 0) return scoreDiff
          return a.created_at < b.created_at ? 1 : -1
        })
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

      const filteredRows = rows.filter(rowNeedsReview)
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

      const stats = await loadStats(filteredRows.length)

      if (!cancelled) {
        setState({
          status: "ready",
          data: buildQueueData(rows, histories, stats, removedByAuthor),
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
        <SummaryCard
          label="Flags Today"
          value={summary.flagsToday}
          detail="Flagged in last 24h"
          icon={Flag}
        />
        <SummaryCard
          label="Flags This Week"
          value={summary.flagsThisWeek}
          detail="Flagged in last 7 days"
          icon={CalendarDays}
        />
        <SummaryCard
          label="Removals Today"
          value={summary.removalsToday}
          detail="Removed in last 24h"
          icon={Trash2}
        />
        <SummaryCard
          label="Approvals Today"
          value={summary.approvalsToday}
          detail="Approved in last 24h"
          icon={CheckCircle2}
        />
        <SummaryCard
          label="Escalations Today"
          value={summary.escalationsToday}
          detail="Escalated in last 24h"
          icon={Flag}
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
  value: number | string | null
  detail: string
  icon: typeof Clock3
}) {
  const displayValue = value === null ? "Unavailable" : value

  return (
    <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{displayValue}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}
