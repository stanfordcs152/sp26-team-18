"use client"

import { useEffect, useState } from "react"
import { Inbox, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ModerationQueue } from "@/components/moderation-queue"
import {
  ModerationCardLive,
  type LiveQueueItem,
} from "@/components/moderation-card-live"
import { mockModerationQueue } from "@/lib/mock-data"
import type {
  ModerationStats,
  Post,
  PostAnalysis,
  PostStatus,
  ReportReason,
} from "@/lib/types"
import type { DashboardCounters } from "@/components/moderation-dashboard"

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
  is_political: boolean | null
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

interface Props {
  /**
   * Called whenever the queue refetches. Lets a parent dashboard surface
   * top-level counters and stat tiles without re-fetching itself.
   */
  onStats?: (stats: ModerationStats, counters: DashboardCounters) => void
}

const POSTS_SELECT_FULL =
  "id, created_at, image_url, caption, username, is_flagged, is_political, confidence_score, status, moderator_note, analysis, risk_score, risk_level"
const POSTS_SELECT_LEGACY =
  "id, created_at, image_url, caption, username, is_flagged, is_political, confidence_score, status, moderator_note"

export function ModerationQueueLive({ onStats }: Props = {}) {
  const [items, setItems] = useState<LiveQueueItem[]>([])
  // When Supabase isn't configured we render the mock fallback immediately,
  // so initial loading is only true when we actually intend to fetch.
  const [loading, setLoading] = useState<boolean>(() => Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!supabase) {
      return
    }

    let cancelled = false
    const run = async () => {
      const { data: reportData, error: reportErr } = await supabase!
        .from("reports")
        .select(
          "id, post_id, reporter_username, reason, details, created_at"
        )
        .eq("status", "open")
        .order("created_at", { ascending: false })

      if (reportErr) {
        if (!cancelled) {
          setError(reportErr.message)
          setLoading(false)
        }
        return
      }

      const reports = (reportData ?? []) as ReportRow[]
      if (reports.length === 0) {
        if (!cancelled) {
          setItems([])
          setLoading(false)
          onStats?.(
            {
              pending: 0,
              reviewedToday: 0,
              removedToday: 0,
              escalated: 0,
              avgReviewTime: "—",
            },
            { pending: 0, highRisk: 0, approvedToday: 0, escalated: 0 }
          )
        }
        return
      }

      const postIds = Array.from(new Set(reports.map((r) => r.post_id)))

      // Try the full select first; if migration 0004 hasn't run yet, fall
      // back to the legacy column set so the queue still renders.
      // Only political posts are routed into the moderation queue — non-political
      // AI images are filtered out here at the source (is_political, migration 0003).
      let postData: PostRow[] | null = null
      let postErr: { message: string } | null = null
      const fullRes = await supabase!
        .from("posts")
        .select(POSTS_SELECT_FULL)
        .in("id", postIds)
        .eq("is_political", true)
      if (fullRes.error) {
        const legacyRes = await supabase!
          .from("posts")
          .select(POSTS_SELECT_LEGACY)
          .in("id", postIds)
          .eq("is_political", true)
        postData = (legacyRes.data ?? null) as PostRow[] | null
        postErr = legacyRes.error
      } else {
        postData = (fullRes.data ?? null) as PostRow[] | null
      }

      if (postErr) {
        if (!cancelled) {
          setError(postErr.message)
          setLoading(false)
        }
        return
      }

      const postsById = new Map<string, PostRow>()
      for (const p of (postData ?? []) as PostRow[]) {
        postsById.set(p.id, p)
      }

      const grouped = new Map<string, LiveQueueItem>()
      for (const r of reports) {
        const postRow = postsById.get(r.post_id)
        if (!postRow) continue

        const existing = grouped.get(r.post_id)
        const reportEntry = {
          id: r.id,
          reason: r.reason,
          details: r.details,
          reporterUsername: r.reporter_username,
          createdAt: r.created_at,
        }

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
          const riskLevel =
            (postRow.risk_level as LiveQueueItem["riskLevel"]) ?? null
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

      // Derive dashboard counters + stats from the live queue.
      const highRisk = sorted.filter(
        (it) => it.riskLevel === "HIGH" || it.riskLevel === "CRITICAL"
      ).length
      const escalated = sorted.filter(
        (it) => it.riskLevel === "CRITICAL"
      ).length

      // Cheap "today" counters, scoped to resolved reports + removed posts in
      // the last 24h. Failures here are non-fatal — we just default to 0.
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      let reviewedToday = 0
      let removedToday = 0
      const resolvedRes = await supabase!
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "resolved")
        .gte("resolved_at", since)
      if (typeof resolvedRes.count === "number") {
        reviewedToday = resolvedRes.count
      }
      const removedRes = await supabase!
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

      if (!cancelled) {
        setItems(sorted)
        setLoading(false)
        onStats?.(stats, counters)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
    // The fetch only runs once on mount; the parent already wraps `onStats`
    // in `useCallback`, so a missing-dep warning here would be misleading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markResolved = (postId: string) => {
    setResolvedKeys((prev) => new Set(prev).add(postId))
  }

  // Fallback to mock data if Supabase is not configured at all.
  if (!supabase) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          <span>
            Supabase is not configured. Showing mock data; reports submitted
            from the feed won&apos;t appear here until env vars are set.
          </span>
        </div>
        <ModerationQueue items={mockModerationQueue} />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="px-4 py-10 text-sm text-muted-foreground">
        Loading reports...
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Failed to load reports: {error}. Falling back to mock data — make
          sure migration <code>0002_phase4_reports_and_status.sql</code> has
          been applied.
        </div>
        <ModerationQueue items={mockModerationQueue} />
      </div>
    )
  }

  const visibleItems = items.filter((it) => !resolvedKeys.has(it.groupKey))

  if (visibleItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Inbox className="size-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground">
          No open reports
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          When users report posts, they&apos;ll appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {visibleItems.map((item) => (
        <ModerationCardLive
          key={item.groupKey}
          item={item}
          onResolved={markResolved}
        />
      ))}
    </div>
  )
}
