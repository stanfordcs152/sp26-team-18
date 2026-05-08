"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flag,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { resolveReport } from "@/lib/moderation-actions"
import type {
  Post,
  ReportReason,
  ReportResolution,
  PostStatus,
} from "@/lib/types"

export interface LiveQueueItem {
  groupKey: string // post id
  post: Post
  postStatus: PostStatus
  reports: {
    id: string
    reason: ReportReason
    details: string | null
    reporterUsername: string
    createdAt: string
  }[]
  newestReportAt: string
  oldestReportAt: string
}

interface ModerationCardLiveProps {
  item: LiveQueueItem
  onResolved: (postId: string) => void
}

function priorityFromCount(count: number): {
  level: "low" | "medium" | "high" | "critical"
  className: string
  label: string
} {
  if (count >= 20)
    return {
      level: "critical",
      label: "Critical",
      className: "bg-red-500/10 text-red-500 border-red-500/20",
    }
  if (count >= 10)
    return {
      level: "high",
      label: "High",
      className: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    }
  if (count >= 3)
    return {
      level: "medium",
      label: "Medium",
      className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    }
  return {
    level: "low",
    label: "Low",
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  }
}

const REASON_LABELS: Record<ReportReason, string> = {
  ai_generated_political: "AI-generated political media",
  other: "Other",
}

export function ModerationCardLive({
  item,
  onResolved,
}: ModerationCardLiveProps) {
  const [expanded, setExpanded] = useState(false)
  const [pendingAction, setPendingAction] = useState<ReportResolution | null>(
    null
  )
  const [note, setNote] = useState("")
  const [moderator, setModerator] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<ReportResolution | null>(null)

  const { post, reports } = item
  const reportCount = reports.length
  const priority = priorityFromCount(reportCount)
  const media = post.media[0]

  const reasonChips = Array.from(
    new Set(reports.map((r) => REASON_LABELS[r.reason]))
  )

  const handleSubmit = async () => {
    if (!pendingAction) return
    if (!note.trim()) {
      setError("A moderator note is required for any action.")
      return
    }
    setSubmitting(true)
    setError(null)

    // Resolve every open report against this post in sequence.
    let lastError: string | null = null
    for (const r of reports) {
      const result = await resolveReport({
        reportId: r.id,
        postId: post.id,
        resolution: pendingAction,
        moderatorUsername: moderator,
        moderatorNote: note,
      })
      if (!result.ok) {
        lastError = result.error
        break
      }
    }

    setSubmitting(false)
    if (lastError) {
      setError(lastError)
      return
    }
    setDone(pendingAction)
    onResolved(post.id)
  }

  if (done) {
    return (
      <div className="border border-border rounded-lg p-4 bg-card/50 opacity-70">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-5 text-emerald-500" />
          <span className="text-sm">
            Resolved as <strong>{done.replace("_", " ")}</strong> ·{" "}
            {reportCount} report{reportCount !== 1 ? "s" : ""} closed
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "border rounded-lg bg-card overflow-hidden transition-all",
        priority.level === "critical" &&
          "border-red-500/50 shadow-red-500/10 shadow-lg",
        priority.level === "high" && "border-orange-500/30",
        priority.level === "medium" && "border-amber-500/20",
        priority.level === "low" && "border-border"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-border">
        <Avatar className="size-10 shrink-0">
          <AvatarImage
            src={post.author.avatarUrl}
            alt={post.author.displayName}
          />
          <AvatarFallback>
            {post.author.displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">
              @{post.author.username}
            </span>
            {item.postStatus !== "visible" && (
              <Badge variant="outline" className="text-xs">
                {item.postStatus}
              </Badge>
            )}
          </div>
          <p className="text-sm text-foreground mt-1 line-clamp-2">
            {post.content}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge variant="outline" className={priority.className}>
            {priority.level === "critical" && (
              <AlertTriangle className="size-3 mr-1" />
            )}
            {priority.label}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {formatDistanceToNow(new Date(item.newestReportAt), {
              addSuffix: true,
            })}
          </div>
        </div>
      </div>

      {/* Media preview */}
      {media && (
        <div className="relative">
          <div className="relative aspect-video max-h-64 bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media.thumbnailUrl || media.url}
              alt={media.altText || "Reported media"}
              className="absolute inset-0 size-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Report info */}
      <div className="p-4 border-t border-border bg-muted/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Flag className="size-4 text-red-500" />
            <span className="font-medium">
              {reportCount} report{reportCount !== 1 ? "s" : ""}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs gap-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="size-3" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="size-3" />
                Show details
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {reasonChips.map((label) => (
            <Badge key={label} variant="secondary" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>

        {expanded && (
          <ul className="space-y-2 rounded-md border border-border bg-background p-3 text-xs">
            {reports.map((r) => (
              <li key={r.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">@{r.reporterUsername}</span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(r.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Reason: {REASON_LABELS[r.reason]}
                </div>
                {r.details ? (
                  <div className="text-muted-foreground italic">
                    “{r.details}”
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {/* Review panel */}
        <div className="rounded-md border border-border bg-background p-3 space-y-3">
          <div className="text-sm font-medium">Review action</div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={pendingAction === "no_action" ? "default" : "outline"}
              onClick={() => setPendingAction("no_action")}
            >
              <CheckCircle2 className="size-4 mr-1.5" />
              Keep visible
            </Button>
            <Button
              size="sm"
              variant={pendingAction === "labeled" ? "default" : "outline"}
              className={cn(
                pendingAction !== "labeled" &&
                  "text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
              )}
              onClick={() => setPendingAction("labeled")}
            >
              <Flag className="size-4 mr-1.5" />
              Apply label
            </Button>
            <Button
              size="sm"
              variant={pendingAction === "removed" ? "default" : "outline"}
              className={cn(
                pendingAction !== "removed" &&
                  "text-red-500 border-red-500/30 hover:bg-red-500/10"
              )}
              onClick={() => setPendingAction("removed")}
            >
              <XCircle className="size-4 mr-1.5" />
              Remove post
            </Button>
          </div>

          {pendingAction && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  Moderator username
                </label>
                <Input
                  value={moderator}
                  onChange={(e) => setModerator(e.target.value)}
                  placeholder="moderator_username"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  Note (required)
                </label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Why this decision? (e.g. C2PA missing, clearly synthetic)"
                />
              </div>
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPendingAction(null)
                    setNote("")
                    setError(null)
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Resolving..." : "Confirm"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
