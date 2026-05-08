"use client"

import { useState } from "react"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import {
  BadgeCheck,
  Play,
  Flag,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowUpCircle,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ModerationQueueItem, ModerationAction } from "@/lib/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AIDetectionBadge } from "@/components/ai-detection-badge"

interface ModerationCardProps {
  item: ModerationQueueItem
  onAction: (id: string, action: ModerationAction) => void
}

const priorityConfig = {
  low: {
    label: "Low",
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  },
  medium: {
    label: "Medium",
    className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  high: {
    label: "High",
    className: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  },
  critical: {
    label: "Critical",
    className: "bg-red-500/10 text-red-500 border-red-500/20",
  },
}

export function ModerationCard({ item, onAction }: ModerationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [actionTaken, setActionTaken] = useState<ModerationAction | null>(null)

  const { post, priority, reportCount, reportReasons, flaggedAt } = item
  const media = post.media[0]
  const priorityStyle = priorityConfig[priority]

  const handleAction = (action: ModerationAction) => {
    setActionTaken(action)
    onAction(item.id, action)
  }

  if (actionTaken && actionTaken !== "pending") {
    return (
      <div className="border border-border rounded-lg p-4 bg-card/50 opacity-60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {actionTaken === "approve" && (
              <CheckCircle2 className="size-5 text-emerald-500" />
            )}
            {actionTaken === "remove" && (
              <XCircle className="size-5 text-red-500" />
            )}
            {actionTaken === "escalate" && (
              <ArrowUpCircle className="size-5 text-amber-500" />
            )}
            <span className="text-sm text-muted-foreground">
              {actionTaken === "approve" && "Marked as authentic"}
              {actionTaken === "remove" && "Content removed"}
              {actionTaken === "escalate" && "Escalated to senior moderator"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActionTaken(null)}
            className="text-xs"
          >
            Undo
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "border rounded-lg bg-card overflow-hidden transition-all",
        priority === "critical" && "border-red-500/50 shadow-red-500/10 shadow-lg",
        priority === "high" && "border-orange-500/30",
        priority === "medium" && "border-amber-500/20",
        priority === "low" && "border-border"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-border">
        <Avatar className="size-10 shrink-0">
          <AvatarImage src={post.author.avatarUrl} alt={post.author.displayName} />
          <AvatarFallback>
            {post.author.displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">
              {post.author.displayName}
            </span>
            {post.author.verified && (
              <BadgeCheck className="size-4 text-blue-500" />
            )}
            <span className="text-muted-foreground text-sm">
              @{post.author.username}
            </span>
          </div>
          <p className="text-sm text-foreground mt-1 line-clamp-2">
            {post.content}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge variant="outline" className={priorityStyle.className}>
            {priority === "critical" && <AlertTriangle className="size-3 mr-1" />}
            {priorityStyle.label}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {formatDistanceToNow(new Date(flaggedAt), { addSuffix: true })}
          </div>
        </div>
      </div>

      {/* Media Preview */}
      {media && (
        <div className="relative">
          <div className="relative aspect-video max-h-64">
            <Image
              src={media.thumbnailUrl || media.url}
              alt={media.altText || "Flagged media"}
              fill
              className="object-cover"
              sizes="(max-width: 800px) 100vw, 800px"
            />
            {media.type === "video" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="flex items-center justify-center size-12 rounded-full bg-black/60 text-white">
                  <Play className="size-5 ml-0.5" fill="currentColor" />
                </div>
              </div>
            )}
          </div>

          {/* AI Detection Badge Overlay */}
          <div className="absolute top-3 right-3">
            <AIDetectionBadge
              status={media.aiDetection.status}
              confidence={media.aiDetection.confidence}
              flags={media.aiDetection.flags}
            />
          </div>
        </div>
      )}

      {/* Report Info */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm">
            <Flag className="size-4 text-red-500" />
            <span className="font-medium">{reportCount} reports</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs gap-1"
          >
            {isExpanded ? (
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

        {/* Report Reasons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {reportReasons.map((reason, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {reason}
            </Badge>
          ))}
        </div>

        {/* Expanded Details */}
        {isExpanded && media && (
          <div className="mb-4 p-3 rounded-lg bg-background border border-border">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Users className="size-4" />
              AI Detection Analysis
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Confidence Score</span>
                <span className="font-mono font-medium">
                  {media.aiDetection.confidence}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    media.aiDetection.confidence >= 80 && "bg-red-500",
                    media.aiDetection.confidence >= 60 && media.aiDetection.confidence < 80 && "bg-orange-500",
                    media.aiDetection.confidence >= 40 && media.aiDetection.confidence < 60 && "bg-amber-500",
                    media.aiDetection.confidence < 40 && "bg-emerald-500"
                  )}
                  style={{ width: `${media.aiDetection.confidence}%` }}
                />
              </div>
              <div className="mt-3">
                <span className="text-xs text-muted-foreground font-medium">Detection Flags:</span>
                <ul className="mt-1 space-y-1">
                  {media.aiDetection.flags.map((flag, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-red-500" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
            onClick={() => handleAction("approve")}
          >
            <CheckCircle2 className="size-4 mr-1.5" />
            Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-red-500 border-red-500/30 hover:bg-red-500/10"
            onClick={() => handleAction("remove")}
          >
            <XCircle className="size-4 mr-1.5" />
            Remove
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
            onClick={() => handleAction("escalate")}
          >
            <ArrowUpCircle className="size-4 mr-1.5" />
            Escalate
          </Button>
        </div>
      </div>
    </div>
  )
}
