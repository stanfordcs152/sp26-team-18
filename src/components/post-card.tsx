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
  ShieldCheck,
  ShieldAlert,
  Clock3,
  XCircle,
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
import { C2paBadge } from "@/components/c2pa-badge"
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
  const isRemoved = post.status === "removed"

  const statusConfig = isRemoved
    ? {
        label: "Removed",
        description: "Moderator action removed this content from distribution.",
        icon: XCircle,
        className: "border-red-500/30 bg-red-500/10 text-red-500",
      }
    : isLabeled
      ? {
          label: "Flagged by Moderator",
          description: "A moderator applied a public warning label.",
          icon: Flag,
          className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
        }
      : hasAIFlags
        ? {
            label: "AI Risk",
            description: "Automated analysis found synthetic-media signals.",
            icon: ShieldAlert,
            className: "border-orange-500/30 bg-orange-500/10 text-orange-500",
          }
        : {
            label: "Verified Authentic",
            description: "No high-risk AI signals were detected.",
            icon: ShieldCheck,
            className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
          }
  const StatusIcon = statusConfig.icon

  return (
    <article
      className={cn(
        "bg-background transition-colors hover:bg-muted/20",
        isRemoved && "bg-muted/10"
      )}
    >
      {isRemoved ? (
        <div className="flex items-start gap-3 bg-red-500/10 px-4 py-3">
          <XCircle className="mt-0.5 size-5 shrink-0 text-red-500" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-500">
              This post was removed after moderator review
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {post.moderatorNote
                ? `Moderator note: ${post.moderatorNote}`
                : "The original media is no longer distributed in the product feed."}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex gap-3 px-4 py-4">
        <Avatar className="size-10 shrink-0 ring-1 ring-border/60">
          <AvatarImage src={post.author.avatarUrl} alt={post.author.displayName} />
          <AvatarFallback>
            {post.author.displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
              {post.isPolitical ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Political
                </span>
              ) : null}
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

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                statusConfig.className
              )}
              title={statusConfig.description}
            >
              <StatusIcon className="size-3.5" />
              {statusConfig.label}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Clock3 className="size-3.5" />
              Uploaded - Analyzed - {isRemoved ? "Removed" : isLabeled ? "Labeled" : hasAIFlags ? "Flagged" : "Visible"}
            </span>
          </div>

          {isLabeled && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <Flag className="mt-0.5 size-3.5 shrink-0" />
              <div>
                <p className="font-medium">
                  This post was flagged for potential AI-generated political content
                </p>
                {post.moderatorNote ? (
                  <p className="mt-1 text-amber-700/80 dark:text-amber-300/80">
                    Moderator note: {post.moderatorNote}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-6 text-foreground">
            {isRemoved ? "Content unavailable" : post.content}
          </p>

          {media && !isRemoved && (
            <div className="relative mt-3 overflow-hidden rounded-2xl border border-border/80 bg-muted">
              <div className="relative aspect-video">
                {/* eslint-disable-next-line @next/next/no-img-element -- using <img> for arbitrary remote URLs without next/image domain config */}
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
            </div>
          )}

          {media && !isRemoved ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <AIDetectionBadge
                status={media.aiDetection.status}
                confidence={media.aiDetection.confidence}
                flags={media.aiDetection.flags}
              />
              {post.c2paStatus ? <C2paBadge status={post.c2paStatus} /> : null}
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between -ml-2 text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-full text-muted-foreground hover:bg-sky-500/10 hover:text-sky-500"
            >
              <MessageCircle className="size-4" />
              <span className="text-xs">{formatNumber(post.comments)}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-full text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500"
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
                  ? "rounded-full text-red-500 hover:bg-red-500/10 hover:text-red-600"
                  : "rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
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
                  ? "rounded-full text-sky-500 hover:bg-sky-500/10 hover:text-sky-600"
                  : "rounded-full text-muted-foreground hover:bg-sky-500/10 hover:text-sky-500"
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
