"use client"

import { useEffect, useMemo, useState } from "react"
import { PostCard } from "@/components/post-card"
import { FeedFilters, type FilterType } from "@/components/feed-filters"
import { supabase } from "@/lib/supabase"
import type { Post } from "@/lib/types"

type SupabasePostRow = {
  id: string
  created_at: string
  image_url: string
  caption: string
  username: string
  is_flagged: boolean
  confidence_score: number
  status?: "visible" | "labeled" | "removed" | null
  moderator_note?: string | null
}

export function Feed() {
  const [filter, setFilter] = useState<FilterType>("all")
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPosts = async () => {
      if (!supabase) {
        setError("Missing Supabase configuration.")
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from("posts")
        .select(
          "id, created_at, image_url, caption, username, is_flagged, confidence_score, status, moderator_note"
        )
        .neq("status", "removed")
        .order("created_at", { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        setIsLoading(false)
        return
      }

      const mappedPosts: Post[] = (data as SupabasePostRow[]).map((row) => {
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
          moderatorNote: row.moderator_note ?? null,
        }
      })

      setPosts(mappedPosts)
      setIsLoading(false)
    }

    void loadPosts()
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

  return (
    <div className="flex flex-col">
      <FeedFilters activeFilter={filter} onFilterChange={setFilter} />

      <div className="divide-y divide-border">
        {isLoading ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">Loading posts...</div>
        ) : error ? (
          <div className="px-4 py-10 text-sm text-destructive">Failed to load posts: {error}</div>
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
