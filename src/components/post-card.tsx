"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  BadgeCheck,
  Play,
  Flag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Post } from "@/lib/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AIDetectionBadge } from "@/components/ai-detection-badge"
import { ReportModal } from "@/components/report-modal"

interface PostCardProps {
  post: Post
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toString()
}

export function PostCard({ post }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLiked)
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked)
  const [likes, setLikes] = useState(post.likes)
  const [reportOpen, setReportOpen] = useState(false)
  const isLabeled = post.status === "labeled"

  const handleLike = () => {
    setIsLiked(!isLiked)
    setLikes(isLiked ? likes - 1 : likes + 1)
  }

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked)
  }

  const media = post.media[0]
  const hasAIFlags = media && media.aiDetection.status !== "authentic"

  return (
    <article
      className={cn(
        "border-b border-border bg-card transition-colors hover:bg-accent/30",
        hasAIFlags && "border-l-2 border-l-amber-500/50"
      )}
    >
      <div className="flex gap-3 p-4">
        {/* Avatar */}
        <Avatar className="size-10 shrink-0">
          <AvatarImage src={post.author.avatarUrl} alt={post.author.displayName} />
          <AvatarFallback>
            {post.author.displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-foreground truncate">
                {post.author.displayName}
              </span>
              {post.author.verified && (
                <BadgeCheck className="size-4 text-blue-500 shrink-0" />
              )}
              <span className="text-muted-foreground text-sm">
                @{post.author.username}
              </span>
              <span className="text-muted-foreground text-sm">·</span>
              <time className="text-muted-foreground text-sm">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </time>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">More options</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setReportOpen(true)}>
                  <Flag className="size-4" />
                  Report content
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Not interested in this</DropdownMenuItem>
                <DropdownMenuItem>Mute @{post.author.username}</DropdownMenuItem>
                <DropdownMenuItem>Block @{post.author.username}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Moderator label banner (Phase 4) */}
          {isLabeled && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <Flag className="size-3.5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">
                  ⚠️ This post was flagged for potential AI-generated political
                  content
                </p>
                {post.moderatorNote ? (
                  <p className="mt-1 text-amber-700/80 dark:text-amber-300/80">
                    Moderator note: {post.moderatorNote}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {/* Post text */}
          <p className="mt-1 text-foreground whitespace-pre-wrap break-words">
            {post.content}
          </p>

          {/* Media */}
          {media && (
            <div className="mt-3 relative rounded-xl overflow-hidden border border-border">
              <div className="relative aspect-video">
                <img
                  src={media.thumbnailUrl || media.url}
                  alt={media.altText || "Post media"}
                  className="size-full object-cover"
                />
                {media.type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="flex items-center justify-center size-14 rounded-full bg-black/60 text-white">
                      <Play className="size-6 ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                )}
              </div>

              {/* AI Detection Badge */}
              <div className="absolute top-2 right-2">
                <AIDetectionBadge
                  status={media.aiDetection.status}
                  confidence={media.aiDetection.confidence}
                  flags={media.aiDetection.flags}
                />
              </div>
            </div>
          )}

          {/* Engagement */}
          <div className="flex items-center justify-between mt-3 -ml-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 gap-1.5"
            >
              <MessageCircle className="size-4" />
              <span className="text-xs">{formatNumber(post.comments)}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-green-500 hover:bg-green-500/10 gap-1.5"
            >
              <Share2 className="size-4" />
              <span className="text-xs">{formatNumber(post.shares)}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={cn(
                "gap-1.5",
                isLiked
                  ? "text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
              )}
            >
              <Heart
                className={cn("size-4", isLiked && "fill-current")}
              />
              <span className="text-xs">{formatNumber(likes)}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleBookmark}
              className={cn(
                isBookmarked
                  ? "text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                  : "text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10"
              )}
            >
              <Bookmark
                className={cn("size-4", isBookmarked && "fill-current")}
              />
            </Button>
          </div>
        </div>
      </div>

      <ReportModal
        postId={post.id}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </article>
  )
}
