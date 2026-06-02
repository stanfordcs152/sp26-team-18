"use client"

import { useEffect, useMemo, useState } from "react"
import { PostCard } from "@/components/post-card"
import { FeedFilters, type FilterType } from "@/components/feed-filters"
import { supabase } from "@/lib/supabase"
import { mockPosts } from "@/lib/mock-data"
import type { Post } from "@/lib/types"

type SupabasePostRow = {
  id: string
  created_at: string
  image_url: string
  caption: string
  username: string
  is_flagged: boolean
  confidence_score: number
  risk_level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null
  status?: "visible" | "labeled" | "removed" | null
}

const FEED_LIMIT = 20
const FEED_SELECT =
  "id, username, caption, image_url, created_at, is_flagged, risk_level, confidence_score, status"

export function Feed() {
  const [filter, setFilter] = useState<FilterType>("all")
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null

    const showDemoFeed = (message: string) => {
      if (cancelled) return
      setPosts(mockPosts.filter((post) => post.status !== "removed"))
      setNotice(message)
      setError(null)
      setIsLoading(false)
    }

    const loadPosts = async () => {
      if (!supabase) {
        showDemoFeed(
          "Live posts are not configured, so sample posts are shown."
        )
        return
      }

      setIsLoading(true)
      setError(null)
      setNotice(null)

      fallbackTimer = setTimeout(() => {
        showDemoFeed(
          "Live posts are taking longer than expected, so demo posts are shown while the backend catches up."
        )
      }, 3500)

      // Try the most-recent schema first (Phase 3 + Phase 4 columns), then
      // fall back to Phase 4 only, then to the legacy schema. Each fallback
      // covers the case where a migration hasn't been applied yet.
      let data: SupabasePostRow[] | null = null

      const currentSchema = await supabase
        .from("posts")
        .select(FEED_SELECT)
        .order("created_at", { ascending: false })
        .limit(FEED_LIMIT)

      if (!currentSchema.error) {
        data = (currentSchema.data ?? []) as SupabasePostRow[]
      } else {
        const phase4 = await supabase
          .from("posts")
          .select(
            "id, username, caption, image_url, created_at, is_flagged, confidence_score, status"
          )
          .order("created_at", { ascending: false })
          .limit(FEED_LIMIT)

        if (!phase4.error) {
          data = (phase4.data ?? []) as SupabasePostRow[]
        } else {
          const legacy = await supabase
            .from("posts")
            .select(
              "id, username, caption, image_url, created_at, is_flagged, confidence_score"
            )
            .order("created_at", { ascending: false })
            .limit(FEED_LIMIT)

          if (legacy.error) {
            if (fallbackTimer) clearTimeout(fallbackTimer)
            showDemoFeed(
              `Live feed could not be loaded (${legacy.error.message}). Showing demo posts.`
            )
            return
          }
          data = (legacy.data ?? []) as SupabasePostRow[]
        }
      }

      const mappedPosts: Post[] = data.map((row) => {
        const isFlagged = Boolean(row.is_flagged)
        const confidence = Math.round(Number(row.confidence_score ?? 0))
        const status = isFlagged
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
            avatarUrl:
              "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
            verified: false,
          },
          content: row.caption ?? "",
          media: [
            {
              id: `${row.id}-media`,
              type: "image",
              url: row.image_url,
              altText: row.caption || "Uploaded image",
              aiDetection: {
                status,
                confidence,
                flags: isFlagged ? ["Potential AI-generated content"] : [],
                analyzedAt: row.created_at,
              },
            },
          ],
          createdAt: row.created_at,
          likes: 0,
          comments: 0,
          shares: 0,
          isLiked: false,
          isBookmarked: false,
          status: row.status ?? "visible",
        }
      })

      if (cancelled) return
      if (fallbackTimer) clearTimeout(fallbackTimer)

      if (mappedPosts.length === 0) {
        showDemoFeed(
          "No live posts are available yet, so sample posts are shown."
        )
        return
      }

      setPosts(mappedPosts.filter((post) => post.status !== "removed"))
      setNotice(null)
      setIsLoading(false)
    }

    void loadPosts()

    return () => {
      cancelled = true
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
  }, [])

  const filteredPosts = useMemo(() => {
    if (filter === "all") {
      return posts
    }
    if (filter === "authentic") {
      return posts.filter((post) =>
        post.media.every((m) => m.aiDetection.status === "authentic")
      )
    }
    return posts.filter((post) =>
      post.media.some((m) => m.aiDetection.status !== "authentic")
    )
  }, [filter, posts])

  const skeletons = [0, 1, 2]

  return (
    <div className="flex flex-col">
      <FeedFilters activeFilter={filter} onFilterChange={setFilter} />

      <div className="divide-y divide-border/70">
        {notice ? (
          <div className="m-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-300">
            {notice}
          </div>
        ) : null}
        {isLoading ? (
          skeletons.map((item) => <FeedSkeleton key={item} />)
        ) : error ? (
          <div className="m-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-10 text-sm text-destructive">
            Failed to load posts: {error}
          </div>
        ) : filteredPosts.length > 0 ? (
          filteredPosts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <p className="text-lg font-medium text-foreground">No posts found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your filter to see more content.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-5">
      <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex gap-2">
          <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded-full bg-muted/70" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded-full bg-muted/80" />
          <div className="h-3 w-3/4 animate-pulse rounded-full bg-muted/80" />
        </div>
        <div className="aspect-video w-full animate-pulse rounded-2xl bg-muted/70" />
      </div>
    </div>
  )
}
