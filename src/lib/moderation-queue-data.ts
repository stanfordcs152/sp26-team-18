// Server-side loader for the moderation queue.
//
// Runs as the signed-in moderator (via getModeratorClient, which carries the
// session cookie's access token) so the tightened RLS from migration 0006 —
// reports readable only by moderators — is satisfied. Called from the
// /moderation Server Component; the result is passed down to client components.

import { getModeratorClient } from "@/lib/moderator-auth"
import type {
  DashboardCounters,
  LiveQueueItem,
  ModerationQueueData,
  ModerationStats,
  Post,
  PostAnalysis,
  PostStatus,
  ReportReason,
  RiskLevel,
} from "@/lib/types"

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
    return {
      items: [],
      stats: {
        pending: 0,
        reviewedToday: 0,
        removedToday: 0,
        escalated: 0,
        avgReviewTime: "—",
      },
      counters: { pending: 0, highRisk: 0, approvedToday: 0, escalated: 0 },
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

  const highRisk = sorted.filter(
    (it) => it.riskLevel === "HIGH" || it.riskLevel === "CRITICAL"
  ).length
  const escalated = sorted.filter((it) => it.riskLevel === "CRITICAL").length

  // Cheap "today" counters, scoped to the last 24h. Failures here are
  // non-fatal — we just default to 0.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let reviewedToday = 0
  let removedToday = 0
  const resolvedRes = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "resolved")
    .gte("resolved_at", since)
  if (typeof resolvedRes.count === "number") {
    reviewedToday = resolvedRes.count
  }
  const removedRes = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("status", "removed")
    .gte("created_at", since)
  if (typeof removedRes.count === "number") {
    removedToday = removedRes.count
  }

  const stats: ModerationStats = {
    pending: sorted.length,
    reviewedToday,
    removedToday,
    escalated,
    avgReviewTime: "—",
  }
  const counters: DashboardCounters = {
    pending: sorted.length,
    highRisk,
    approvedToday: Math.max(0, reviewedToday - removedToday),
    escalated,
  }

  return { items: sorted, stats, counters }
}
