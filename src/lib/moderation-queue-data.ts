// Server-side loader for the moderation queue.
//
// Runs as the signed-in moderator (via getModeratorClient, which carries the
// session cookie's access token) so the tightened RLS from migration 0006 —
// reports readable only by moderators — is satisfied. Called from the
// /moderation Server Component; the result is passed down to client components.

import { type SupabaseClient } from "@supabase/supabase-js"
import {
  eachWeekOfInterval,
  format,
  startOfWeek,
  subWeeks,
} from "date-fns"
import { getModeratorClient } from "@/lib/moderator-auth"
import type {
  DashboardCounters,
  DecisionTrendPoint,
  LiveQueueItem,
  ModeratorAnalytics,
  ModerationQueueData,
  ModerationStats,
  Post,
  PostAnalysis,
  PostStatus,
  ReportReason,
  RiskLevel,
  WeeklyCountPoint,
} from "@/lib/types"

// How many trailing weeks to chart in the moderator analytics panel.
const ANALYTICS_WEEKS = 8

type ReportRow = {
  id: string
  post_id: string
  reporter_username: string
  reason: ReportReason
  details: string | null
  created_at: string
}

type PostRow = {
  id: string
  created_at: string
  image_url: string | null
  caption: string | null
  username: string
  is_flagged: boolean
  confidence_score: number | null
  status: PostStatus | null
  moderator_note: string | null
  // Phase 5 (migration 0004) — may be null on legacy posts.
  analysis?: PostAnalysis | null
  risk_score?: number | null
  risk_level?: string | null
}

const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"

const POSTS_SELECT_FULL =
  "id, created_at, image_url, caption, username, is_flagged, confidence_score, status, moderator_note, analysis, risk_score, risk_level"
const POSTS_SELECT_LEGACY =
  "id, created_at, image_url, caption, username, is_flagged, confidence_score, status, moderator_note"

function rowToPost(row: PostRow): Post {
  const isFlagged = Boolean(row.is_flagged)
  const confidence = Math.round(Number(row.confidence_score ?? 0))
  const aiStatus = isFlagged
    ? confidence >= 90
      ? "confirmed_ai"
      : "likely_ai"
    : "authentic"

  return {
    id: row.id,
    author: {
      id: row.username,
      username: row.username,
      displayName: row.username,
      avatarUrl: FALLBACK_AVATAR,
      verified: false,
    },
    content: row.caption ?? "",
    media: row.image_url
      ? [
          {
            id: `${row.id}-media`,
            type: "image",
            url: row.image_url,
            altText: row.caption ?? "Reported image",
            aiDetection: {
              status: aiStatus,
              confidence,
              flags: isFlagged ? ["Potential AI-generated content"] : [],
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
    moderatorNote: row.moderator_note,
  }
}

function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return "—"
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hours = Math.round((ms / 3_600_000) * 10) / 10
  if (hours < 24) return `${hours}h`
  const days = Math.round((ms / 86_400_000) * 10) / 10
  return `${days}d`
}

type ResolvedReportRow = {
  created_at: string
  resolved_at: string | null
  resolution: "no_action" | "labeled" | "removed" | null
}

/**
 * Historical moderator statistics over the trailing ANALYTICS_WEEKS weeks:
 * weekly auto-flag counts, decisions-over-time, false-positive rate, and
 * average time-to-review. Also returns the "today" counters derived from
 * resolved reports. `backlog` (open reports) is supplied by the caller.
 */
async function loadModeratorAnalytics(
  supabase: SupabaseClient,
  backlog: number
): Promise<{
  analytics: ModeratorAnalytics
  reviewedToday: number
  removedToday: number
  avgReviewTime: string
}> {
  const now = new Date()
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Trailing-week buckets (Monday-started), oldest -> newest.
  const weekStarts = eachWeekOfInterval(
    {
      start: startOfWeek(subWeeks(now, ANALYTICS_WEEKS - 1), { weekStartsOn: 1 }),
      end: now,
    },
    { weekStartsOn: 1 }
  )
  const weekKey = (d: Date) =>
    format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd")

  const flagsByWeek = new Map<string, number>()
  const decisionsByWeek = new Map<
    string,
    { approved: number; labeled: number; removed: number }
  >()
  for (const w of weekStarts) {
    const k = weekKey(w)
    flagsByWeek.set(k, 0)
    decisionsByWeek.set(k, { approved: 0, labeled: 0, removed: 0 })
  }

  // Auto-flagged posts -> weekly flag counts.
  const { data: flaggedPosts } = await supabase
    .from("posts")
    .select("created_at")
    .eq("is_flagged", true)
  for (const p of (flaggedPosts ?? []) as { created_at: string }[]) {
    const k = weekKey(new Date(p.created_at))
    if (flagsByWeek.has(k)) flagsByWeek.set(k, (flagsByWeek.get(k) ?? 0) + 1)
  }

  // Resolved reports -> decision trend, FPR, avg review time, today counters.
  const { data: resolved } = await supabase
    .from("reports")
    .select("created_at, resolved_at, resolution")
    .eq("status", "resolved")
  const resolvedRows = (resolved ?? []) as ResolvedReportRow[]

  let reviewedToday = 0
  let removedToday = 0
  let clearedCount = 0
  let reviewMsSum = 0
  let reviewMsCount = 0
  for (const r of resolvedRows) {
    if (r.resolution === "no_action") clearedCount += 1
    if (!r.resolved_at) continue
    const resolvedAt = new Date(r.resolved_at)
    if (resolvedAt >= since) {
      reviewedToday += 1
      if (r.resolution === "removed") removedToday += 1
    }
    const ms = resolvedAt.getTime() - new Date(r.created_at).getTime()
    if (Number.isFinite(ms) && ms >= 0) {
      reviewMsSum += ms
      reviewMsCount += 1
    }
    const bucket = decisionsByWeek.get(weekKey(resolvedAt))
    if (bucket) {
      if (r.resolution === "removed") bucket.removed += 1
      else if (r.resolution === "labeled") bucket.labeled += 1
      else bucket.approved += 1
    }
  }

  const reviewedTotal = resolvedRows.length
  const avgReviewMs = reviewMsCount > 0 ? reviewMsSum / reviewMsCount : null
  const falsePositiveRate =
    reviewedTotal > 0 ? clearedCount / reviewedTotal : null

  const weeklyFlags: WeeklyCountPoint[] = weekStarts.map((w) => {
    const k = weekKey(w)
    return { weekStart: k, label: format(w, "MMM d"), count: flagsByWeek.get(k) ?? 0 }
  })
  const decisionTrend: DecisionTrendPoint[] = weekStarts.map((w) => {
    const k = weekKey(w)
    const b = decisionsByWeek.get(k) ?? { approved: 0, labeled: 0, removed: 0 }
    return { weekStart: k, label: format(w, "MMM d"), ...b }
  })

  return {
    analytics: {
      weeklyFlags,
      decisionTrend,
      falsePositiveRate,
      reviewedTotal,
      backlog,
      avgReviewMs,
    },
    reviewedToday,
    removedToday,
    avgReviewTime: formatDuration(avgReviewMs),
  }
}

/**
 * Loads the open report queue plus dashboard stats as the signed-in moderator.
 * Returns null when Supabase isn't configured / there's no session, or when a
 * query fails (RLS, missing migration) — the caller falls back to mock data.
 */
export async function loadModerationQueue(): Promise<ModerationQueueData | null> {
  const supabase = await getModeratorClient()
  if (!supabase) return null

  const { data: reportData, error: reportErr } = await supabase
    .from("reports")
    .select("id, post_id, reporter_username, reason, details, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })

  if (reportErr) {
    console.error("Failed to load reports:", reportErr.message)
    return null
  }

  const reports = (reportData ?? []) as ReportRow[]
  if (reports.length === 0) {
    // No open reports, but historical stats (resolved reports, flagged posts)
    // are still worth showing.
    const { analytics, reviewedToday, removedToday } =
      await loadModeratorAnalytics(supabase, 0)
    return {
      items: [],
      stats: {
        pending: 0,
        reviewedToday,
        removedToday,
        escalated: 0,
        avgReviewTime: formatDuration(analytics.avgReviewMs),
      },
      counters: { pending: 0, highRisk: 0, approvedToday: 0, escalated: 0 },
      analytics,
    }
  }

  const postIds = Array.from(new Set(reports.map((r) => r.post_id)))

  // Try the full select first; if migration 0004 hasn't run yet, fall back to
  // the legacy column set so the queue still renders.
  let postData: PostRow[] | null = null
  const fullRes = await supabase
    .from("posts")
    .select(POSTS_SELECT_FULL)
    .in("id", postIds)
  if (fullRes.error) {
    const legacyRes = await supabase
      .from("posts")
      .select(POSTS_SELECT_LEGACY)
      .in("id", postIds)
    if (legacyRes.error) {
      console.error("Failed to load posts:", legacyRes.error.message)
      return null
    }
    postData = (legacyRes.data ?? null) as PostRow[] | null
  } else {
    postData = (fullRes.data ?? null) as PostRow[] | null
  }

  const postsById = new Map<string, PostRow>()
  for (const p of (postData ?? []) as PostRow[]) {
    postsById.set(p.id, p)
  }

  const grouped = new Map<string, LiveQueueItem>()
  for (const r of reports) {
    const postRow = postsById.get(r.post_id)
    if (!postRow) continue

    const reportEntry = {
      id: r.id,
      reason: r.reason,
      details: r.details,
      reporterUsername: r.reporter_username,
      createdAt: r.created_at,
    }

    const existing = grouped.get(r.post_id)
    if (existing) {
      existing.reports.push(reportEntry)
      if (r.created_at > existing.newestReportAt) {
        existing.newestReportAt = r.created_at
      }
      if (r.created_at < existing.oldestReportAt) {
        existing.oldestReportAt = r.created_at
      }
    } else {
      const analysis = (postRow.analysis ?? null) as PostAnalysis | null
      const riskLevel = (postRow.risk_level as RiskLevel | null) ?? null
      grouped.set(r.post_id, {
        groupKey: r.post_id,
        post: rowToPost(postRow),
        postStatus: postRow.status ?? "visible",
        reports: [reportEntry],
        newestReportAt: r.created_at,
        oldestReportAt: r.created_at,
        analysis,
        riskScore: postRow.risk_score ?? null,
        riskLevel,
      })
    }
  }

  const sorted = Array.from(grouped.values()).sort((a, b) =>
    a.newestReportAt < b.newestReportAt ? 1 : -1
  )

  // Per-author malicious-post history (moderator-only — this loader only runs
  // for signed-in moderators). Counts span every post by the author, separating
  // moderator-confirmed removals from auto-flagged high-risk uploads.
  const authorUsernames = Array.from(
    new Set(sorted.map((it) => it.post.author.username))
  )
  if (authorUsernames.length > 0) {
    const removedByAuthor = new Map<string, number>()
    const flaggedByAuthor = new Map<string, number>()
    const { data: authorPosts } = await supabase
      .from("posts")
      .select("username, is_flagged, status")
      .in("username", authorUsernames)
    for (const p of (authorPosts ?? []) as {
      username: string
      is_flagged: boolean | null
      status: PostStatus | null
    }[]) {
      if (p.status === "removed") {
        removedByAuthor.set(p.username, (removedByAuthor.get(p.username) ?? 0) + 1)
      }
      if (p.is_flagged) {
        flaggedByAuthor.set(p.username, (flaggedByAuthor.get(p.username) ?? 0) + 1)
      }
    }
    for (const it of sorted) {
      const name = it.post.author.username
      it.authorRemovedCount = removedByAuthor.get(name) ?? 0
      it.authorFlaggedCount = flaggedByAuthor.get(name) ?? 0
    }
  }

  const highRisk = sorted.filter(
    (it) => it.riskLevel === "HIGH" || it.riskLevel === "CRITICAL"
  ).length
  const escalated = sorted.filter((it) => it.riskLevel === "CRITICAL").length

  // Historical stats + today counters. backlog = open reports across the queue.
  const { analytics, reviewedToday, removedToday, avgReviewTime } =
    await loadModeratorAnalytics(supabase, reports.length)

  const stats: ModerationStats = {
    pending: sorted.length,
    reviewedToday,
    removedToday,
    escalated,
    avgReviewTime,
  }
  const counters: DashboardCounters = {
    pending: sorted.length,
    highRisk,
    approvedToday: Math.max(0, reviewedToday - removedToday),
    escalated,
  }

  return { items: sorted, stats, counters, analytics }
}
