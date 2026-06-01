"use client"

import { useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  History,
  Inbox,
  ScanText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { resolveReport } from "@/lib/moderation-actions"
import type {
  LiveQueueItem,
  ReportReason,
  ReportResolution,
  RiskLevel,
} from "@/lib/types"

interface Props {
  items: LiveQueueItem[]
}

type ConsoleDecision = "pending" | "approved" | "removed" | "escalated"

const REASON_LABELS: Record<ReportReason, string> = {
  ai_generated_political: "AI-generated political media",
  other: "Other",
}

const RISK_CLASS: Record<RiskLevel, string> = {
  LOW: "border-slate-500/20 bg-slate-500/10 text-slate-400",
  MEDIUM: "border-amber-500/25 bg-amber-500/10 text-amber-500",
  HIGH: "border-orange-500/25 bg-orange-500/10 text-orange-500",
  CRITICAL: "border-red-500/30 bg-red-500/10 text-red-500",
}

function scoreLabel(score: number | null) {
  return score === null ? "—" : `${Math.round(score * 100)}%`
}

function recommendationFor(item: LiveQueueItem) {
  if (item.riskLevel === "CRITICAL") return "Escalate and apply public label"
  if (item.riskLevel === "HIGH") return "Remove or label after review"
  if (item.riskLevel === "MEDIUM") return "Review evidence before labeling"
  return "Approve if no policy issue is found"
}

function decisionCopy(decision: ConsoleDecision) {
  switch (decision) {
    case "approved":
      return {
        label: "Approved",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
        icon: CheckCircle2,
      }
    case "removed":
      return {
        label: "Removed",
        className: "border-red-500/30 bg-red-500/10 text-red-500",
        icon: XCircle,
      }
    case "escalated":
      return {
        label: "Escalated",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
        icon: Flag,
      }
    default:
      return {
        label: "Pending review",
        className: "border-border bg-muted/40 text-muted-foreground",
        icon: Clock,
      }
  }
}

function primaryReason(item: LiveQueueItem) {
  const reason = item.reports[0]?.reason
  return reason ? REASON_LABELS[reason] : "Automated risk signal"
}

export function ModerationQueueLive({ items }: Props) {
  const [selectedId, setSelectedId] = useState(items[0]?.groupKey ?? "")
  const [decisions, setDecisions] = useState<Record<string, ConsoleDecision>>({})
  const [pendingAction, setPendingAction] = useState<ConsoleDecision>("pending")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedItems = useMemo(() => {
    const riskRank: Record<RiskLevel, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    }
    return [...items].sort((a, b) => {
      const aRank = a.riskLevel ? riskRank[a.riskLevel] : 4
      const bRank = b.riskLevel ? riskRank[b.riskLevel] : 4
      if (aRank !== bRank) return aRank - bRank
      if (a.reports.length !== b.reports.length) {
        return b.reports.length - a.reports.length
      }
      return a.newestReportAt < b.newestReportAt ? 1 : -1
    })
  }, [items])

  const selected = sortedItems.find((item) => item.groupKey === selectedId) ?? sortedItems[0]
  const selectedDecision = selected
    ? decisions[selected.groupKey] ?? "pending"
    : "pending"

  const localStats = useMemo(() => {
    const values = Object.values(decisions)
    return {
      pending: Math.max(0, items.length - values.filter((v) => v !== "pending").length),
      approved: values.filter((v) => v === "approved").length,
      removed: values.filter((v) => v === "removed").length,
      escalated: values.filter((v) => v === "escalated").length,
    }
  }, [decisions, items.length])

  const chooseAction = (action: ConsoleDecision) => {
    setPendingAction(action)
    setError(null)
  }

  const submitDecision = async () => {
    if (!selected || pendingAction === "pending") return
    if (!note.trim()) {
      setError("Add a short moderator note before confirming.")
      return
    }

    setSubmitting(true)
    setError(null)

    const resolution: ReportResolution =
      pendingAction === "removed"
        ? "removed"
        : pendingAction === "escalated"
          ? "labeled"
          : "no_action"

    let lastError: string | null = null
    const realReports = selected.reports.filter((r) => !r.id.startsWith("mock-"))

    for (const report of realReports) {
      const result = await resolveReport({
        reportId: report.id,
        postId: selected.post.id,
        resolution,
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

    setDecisions((prev) => ({
      ...prev,
      [selected.groupKey]: pendingAction,
    }))
    setNote("")
    setPendingAction("pending")
  }

  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
        <Inbox className="mb-4 size-12 text-muted-foreground/50" />
        <h3 className="text-lg font-medium text-foreground">No open reports</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Flagged uploads and user reports will appear here for review.
        </p>
      </div>
    )
  }

  const media = selected.post.media[0]
  const decision = decisionCopy(selectedDecision)
  const DecisionIcon = decision.icon

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <ConsoleStat label="Pending" value={localStats.pending} icon={Clock} />
        <ConsoleStat label="Approved" value={localStats.approved} icon={ShieldCheck} />
        <ConsoleStat label="Removed" value={localStats.removed} icon={XCircle} />
        <ConsoleStat label="Escalated" value={localStats.escalated} icon={Flag} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[292px_minmax(0,1fr)_320px]">
        <aside className="overflow-hidden rounded-2xl border border-border/70 bg-card/75 shadow-sm">
          <div className="border-b border-border/70 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Flagged Queue
            </p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Sorted by risk, reports, and recency.
            </p>
          </div>
          <div className="max-h-[720px] space-y-2 overflow-auto p-2">
            {sortedItems.map((item) => {
              const isActive = item.groupKey === selected.groupKey
              const itemDecision = decisionCopy(decisions[item.groupKey] ?? "pending")
              const ItemDecisionIcon = itemDecision.icon
              return (
                <button
                  key={item.groupKey}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.groupKey)
                    setPendingAction("pending")
                    setNote("")
                    setError(null)
                  }}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-all",
                    isActive
                      ? "border-foreground/25 bg-muted/70 shadow-sm"
                      : "border-transparent bg-transparent hover:bg-muted/45"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        @{item.post.author.username}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {item.post.content}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 text-[10px]",
                        item.riskLevel
                          ? RISK_CLASS[item.riskLevel]
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {item.riskLevel ?? "NEW"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <span>Risk {scoreLabel(item.riskScore)}</span>
                    <span>{item.reports.length} report{item.reports.length === 1 ? "" : "s"}</span>
                    <span>Image</span>
                    <span>{formatDistanceToNow(new Date(item.newestReportAt), { addSuffix: true })}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-muted-foreground">
                      {primaryReason(item)}
                    </span>
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]", itemDecision.className)}>
                      <ItemDecisionIcon className="size-3" />
                      {itemDecision.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/75 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 p-4">
            <div className="flex items-start gap-3">
              <Avatar className="size-11">
                <AvatarImage
                  src={selected.post.author.avatarUrl}
                  alt={selected.post.author.displayName}
                />
                <AvatarFallback>
                  {selected.post.author.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Review Detail
                </p>
                <h3 className="text-lg font-semibold">@{selected.post.author.username}</h3>
                <p className="text-xs text-muted-foreground">
                  Posted {formatDistanceToNow(new Date(selected.post.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", decision.className)}>
              <DecisionIcon className="size-3.5" />
              {decision.label}
            </span>
          </div>

          {media ? (
            <div className="relative aspect-video bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.thumbnailUrl || media.url}
                alt={media.altText || "Flagged media"}
                className="absolute inset-0 size-full object-cover"
              />
            </div>
          ) : null}

          <div className="space-y-4 p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Caption
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{selected.post.content}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <EvidenceMetric
                label="Risk score"
                value={scoreLabel(selected.riskScore)}
                icon={ShieldAlert}
              />
              <EvidenceMetric
                label="AI likelihood"
                value={
                  selected.analysis
                    ? `${Math.round(selected.analysis.ai.aiProbability * 100)}%`
                    : "—"
                }
                icon={Sparkles}
              />
              <EvidenceMetric
                label="Recommendation"
                value={recommendationFor(selected)}
                icon={Flag}
              />
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
              <p className="text-sm font-medium">Decision workflow</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={pendingAction === "approved" ? "default" : "outline"}
                  onClick={() => chooseAction("approved")}
                >
                  <CheckCircle2 className="size-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant={pendingAction === "removed" ? "default" : "outline"}
                  className={cn(
                    pendingAction !== "removed" &&
                      "border-red-500/30 text-red-500 hover:bg-red-500/10"
                  )}
                  onClick={() => chooseAction("removed")}
                >
                  <XCircle className="size-4" />
                  Remove
                </Button>
                <Button
                  size="sm"
                  variant={pendingAction === "escalated" ? "default" : "outline"}
                  className={cn(
                    pendingAction !== "escalated" &&
                      "border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                  )}
                  onClick={() => chooseAction("escalated")}
                >
                  <Flag className="size-4" />
                  Escalate
                </Button>
              </div>

              {pendingAction !== "pending" ? (
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-medium">Moderator note</label>
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder="Document the decision for audit and downstream labels."
                  />
                  {error ? <p className="text-xs text-destructive">{error}</p> : null}
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPendingAction("pending")
                        setNote("")
                        setError(null)
                      }}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={submitDecision} disabled={submitting}>
                      {submitting ? "Saving..." : "Confirm decision"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border/70 bg-card/75 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">Evidence</h3>
            </div>
            <div className="space-y-3 text-sm">
              <EvidenceRow
                label="C2PA provenance"
                value={
                  selected.analysis?.provenance.verified
                    ? "Verified"
                    : selected.analysis?.provenance.present
                      ? "Present, not verified"
                      : "Missing or unavailable"
                }
              />
              <EvidenceRow
                label="OCR text"
                value={selected.analysis?.ocr.text || "No visible text extracted"}
              />
              <EvidenceRow
                label="Public figures"
                value={
                  selected.analysis?.politicians.detected.length
                    ? selected.analysis.politicians.detected.join(", ")
                    : "None detected"
                }
              />
              <EvidenceRow
                label="Classifier reasoning"
                value={selected.analysis?.vision.reasoning || "No classifier reasoning available"}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card/75 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <History className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">User & Content History</h3>
            </div>
            <ol className="space-y-3 text-sm">
              <HistoryItem
                icon={UserRound}
                title={`${selected.reports.length} open report${selected.reports.length === 1 ? "" : "s"}`}
                detail={`First flagged ${formatDistanceToNow(new Date(selected.oldestReportAt), { addSuffix: true })}`}
              />
              <HistoryItem
                icon={ScanText}
                title="Analysis completed"
                detail={`${scoreLabel(selected.riskScore)} risk score stored with this post`}
              />
              <HistoryItem
                icon={decision.icon}
                title={decision.label}
                detail={
                  selectedDecision === "pending"
                    ? "Awaiting moderator decision"
                    : "Decision reflected locally and persisted when backed by reports"
                }
              />
            </ol>
          </section>
        </aside>
      </div>
    </div>
  )
}

function ConsoleStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof Clock
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/75 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}

function EvidenceMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof ShieldAlert
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/70 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/70 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 max-h-28 overflow-auto text-xs leading-relaxed text-foreground">
        {value}
      </p>
    </div>
  )
}

function HistoryItem({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof History
  title: string
  detail: string
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background">
        <Icon className="size-3.5 text-muted-foreground" />
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </li>
  )
}
