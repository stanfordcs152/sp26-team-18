"use client"

import { useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  Inbox,
  ShieldAlert,
  ShieldX,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { resolvePostModeration } from "@/lib/moderation-actions"
import type { LiveQueueItem, ReportResolution, RiskLevel } from "@/lib/types"

interface Props {
  items: LiveQueueItem[]
}

type ConsoleDecision = "pending" | "approved" | "removed" | "escalated"

// A flagged author reaches "repeat offender" status once moderators have
// removed at least this many of their posts. Advisory only — it surfaces a
// warning in the queue but does not block the account from uploading.
const STRIKE_LIMIT = 3

function isRepeatOffender(item: LiveQueueItem): boolean {
  return (item.authorRemovedCount ?? 0) >= STRIKE_LIMIT
}

const RISK_CLASS: Record<RiskLevel, string> = {
  LOW: "border-slate-500/20 bg-slate-500/10 text-slate-500",
  MEDIUM: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  HIGH: "border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  CRITICAL: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
}

function scoreLabel(score: number | null) {
  return score === null ? "—" : `${Math.round(score * 100)}%`
}

function decisionCopy(decision: ConsoleDecision) {
  switch (decision) {
    case "approved":
      return {
        label: "Approved",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        icon: CheckCircle2,
      }
    case "removed":
      return {
        label: "Removed",
        className: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
        icon: XCircle,
      }
    case "escalated":
      return {
        label: "Escalated",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
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

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

type EvidenceItem = {
  label: string
  value: string
}

function buildRiskSummary(item: LiveQueueItem): EvidenceItem[] {
  const rows: EvidenceItem[] = []

  if (item.riskLevel) {
    rows.push({ label: "Risk level", value: item.riskLevel })
  }
  if (typeof item.riskScore === "number") {
    rows.push({ label: "Risk score", value: scoreLabel(item.riskScore) })
  }
  if (item.analysis?.risk?.reasons?.length) {
    rows.push({ label: "Risk reasons", value: item.analysis.risk.reasons.join("; ") })
  }
  if (typeof item.selfDeclaredAi === "boolean") {
    rows.push({
      label: "Uploader self-label",
      value: item.selfDeclaredAi ? "AI-generated" : "Not AI-generated",
    })
  }

  return rows
}

function buildEvidence(item: LiveQueueItem): EvidenceItem[] {
  const analysis = item.analysis
  if (!analysis) return []

  const rows: EvidenceItem[] = []

  if (analysis.provenance?.verified) {
    rows.push({ label: "C2PA/provenance", value: "Verified" })
  } else if (analysis.provenance?.present) {
    rows.push({ label: "C2PA/provenance", value: "Present" })
  }

  const ocrText = hasText(analysis.ocr?.text)
    ? analysis.ocr.text
    : hasText(analysis.vision?.visibleText)
      ? analysis.vision.visibleText
      : null
  if (ocrText) {
    rows.push({ label: "OCR text", value: ocrText })
  }

  const publicFigures = analysis.politicians?.detected?.length
    ? analysis.politicians.detected
    : analysis.vision?.publicFigures ?? []
  if (publicFigures.length > 0) {
    const confidence =
      typeof analysis.politicians?.confidence === "number"
        ? ` (${formatPercent(analysis.politicians.confidence)})`
        : ""
    rows.push({ label: "Public figures", value: `${publicFigures.join(", ")}${confidence}` })
  }

  if (typeof analysis.ai?.aiProbability === "number") {
    rows.push({ label: "AI generated probability", value: formatPercent(analysis.ai.aiProbability) })
  } else if (typeof analysis.vision?.syntheticMediaConfidence === "number") {
    rows.push({
      label: "Synthetic media confidence",
      value: formatPercent(analysis.vision.syntheticMediaConfidence),
    })
  }

  if (analysis.manipulationSignals?.politicalContext || analysis.vision?.politicalContext) {
    const confidence =
      typeof analysis.manipulationSignals?.politicalContextConfidence === "number"
        ? ` (${formatPercent(analysis.manipulationSignals.politicalContextConfidence)})`
        : ""
    rows.push({ label: "Political context", value: `Detected${confidence}` })
  }

  if (analysis.vision?.misinformationRisk) {
    rows.push({ label: "Misinformation risk", value: analysis.vision.misinformationRisk })
  }

  if (analysis.manipulationSignals?.possibleKnownManipulation || analysis.vision?.possibleKnownManipulation) {
    rows.push({ label: "Manipulation signal", value: "Possible known manipulation pattern" })
  }

  if (analysis.ocr?.matchedKeywords?.length) {
    rows.push({ label: "Matched keywords", value: analysis.ocr.matchedKeywords.join(", ") })
  }

  if (hasText(analysis.vision?.reasoning)) {
    rows.push({ label: "Classifier reasoning", value: analysis.vision.reasoning })
  }

  return rows
}

export function ModerationQueueLive({ items }: Props) {
  const [selectedId, setSelectedId] = useState(items[0]?.groupKey ?? "")
  const [decisions, setDecisions] = useState<Record<string, ConsoleDecision>>({})
  const [dismissedIds, setDismissedIds] = useState<Record<string, true>>({})
  const [pendingAction, setPendingAction] = useState<ConsoleDecision>("pending")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const sortedItems = useMemo(() => {
    return items.filter((item) => !dismissedIds[item.groupKey])
  }, [dismissedIds, items])

  const selected = sortedItems.find((item) => item.groupKey === selectedId) ?? sortedItems[0]
  const selectedDecision = selected ? decisions[selected.groupKey] ?? "pending" : "pending"

  const chooseAction = (action: ConsoleDecision) => {
    setPendingAction(action)
    setError(null)
    setWarning(null)
  }

  const submitDecision = async () => {
    if (!selected || pendingAction === "pending") return

    setSubmitting(true)
    setError(null)
    setWarning(null)

    const resolution: ReportResolution =
      pendingAction === "removed"
        ? "removed"
        : pendingAction === "escalated"
          ? "labeled"
          : "no_action"

    const result = await resolvePostModeration({
      postId: selected.post.id,
      resolution,
      moderatorNote:
        note.trim() || `${decisionCopy(pendingAction).label} from moderator console`,
    })

    setSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    if (result.warning) setWarning(result.warning)

    setDecisions((prev) => ({ ...prev, [selected.groupKey]: pendingAction }))
    // Only clear the row from the queue when the decision actually persisted.
    // An unpersisted write (no moderator session / RLS-blocked) leaves the post
    // unchanged in the DB, so it would reappear on reload — keep it visible with
    // the warning instead of optimistically hiding it.
    if (result.persisted) {
      setDismissedIds((prev) => ({ ...prev, [selected.groupKey]: true }))
      setNote("")
      setPendingAction("pending")
    }
  }

  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border/70 bg-card/80 py-16 text-center shadow-sm">
        <Inbox className="mb-4 size-12 text-muted-foreground/50" />
        <h3 className="text-lg font-medium text-foreground">No flagged posts awaiting review.</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          New flagged uploads will appear here after automated analysis.
        </p>
      </div>
    )
  }

  const media = selected.post.media[0]
  const decision = decisionCopy(selectedDecision)
  const DecisionIcon = decision.icon
  const riskSummary = buildRiskSummary(selected)
  const evidence = buildEvidence(selected)

  return (
    <div className="space-y-4">
      {warning ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {warning}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
        <aside className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm">
          <div className="border-b border-border/70 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Flagged Queue
            </p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Highest risk first, then newest.
            </p>
          </div>
          <div className="max-h-[720px] space-y-2 overflow-auto p-2">
            {sortedItems.map((item) => {
              const isActive = item.groupKey === selected.groupKey

              return (
                <button
                  key={item.groupKey}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.groupKey)
                    setPendingAction("pending")
                    setNote("")
                    setError(null)
                    setWarning(null)
                  }}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-all",
                    isActive
                      ? "border-primary/40 bg-primary/10 shadow-sm ring-1 ring-primary/15"
                      : "border-transparent bg-transparent hover:bg-muted/45"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        @{item.post.author.username}
                      </p>
                      {hasText(item.post.content) ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {item.post.content}
                        </p>
                      ) : null}
                    </div>
                    {item.riskLevel ? (
                      <Badge
                        variant="outline"
                        className={cn("shrink-0 text-[10px]", RISK_CLASS[item.riskLevel])}
                      >
                        {item.riskLevel}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {typeof item.riskScore === "number" ? (
                      <span>Risk {scoreLabel(item.riskScore)}</span>
                    ) : null}
                    <span>
                      {formatDistanceToNow(new Date(item.newestReportAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  {isRepeatOffender(item) ? (
                    <Badge
                      variant="outline"
                      className="mt-2 gap-1 border-red-500/30 bg-red-500/10 text-[10px] text-red-600 dark:text-red-400"
                    >
                      <ShieldX className="size-3" />
                      Repeat offender · {item.authorRemovedCount}
                    </Badge>
                  ) : null}
                </button>
              )
            })}
          </div>
        </aside>

        <section className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm">
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
                  Posted{" "}
                  {formatDistanceToNow(new Date(selected.post.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                decision.className
              )}
            >
              <DecisionIcon className="size-3.5" />
              {decision.label}
            </span>
          </div>

          {isRepeatOffender(selected) ? (
            <div className="flex items-start gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <ShieldX className="mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-semibold">Repeat offender.</span>{" "}
                Moderators have removed {selected.authorRemovedCount} of
                @{selected.post.author.username}&apos;s posts (3-strike
                threshold reached).
              </p>
            </div>
          ) : null}

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
            {hasText(selected.post.content) ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Caption
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                  {selected.post.content}
                </p>
              </div>
            ) : null}

            {riskSummary.length > 0 ? (
              <section className="rounded-xl border border-border/70 bg-muted/15 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldAlert className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold">Risk summary</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {riskSummary.map((item) => (
                    <EvidenceMetric
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      icon={ShieldAlert}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Decision</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Apply a review outcome to this post.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
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
                    variant={pendingAction === "removed" ? "destructive" : "outline"}
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
              </div>

              {pendingAction !== "pending" ? (
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-medium">Moderator note</label>
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder="Optional audit note."
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
                      {submitting ? "Saving..." : "Confirm"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">Evidence</h3>
            </div>
            {evidence.length > 0 ? (
              <div className="space-y-3 text-sm">
                {evidence.map((item) => (
                  <EvidenceRow key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-border/70 bg-background/70 p-3 text-sm text-muted-foreground">
                No evidence details available.
              </p>
            )}
          </section>
        </aside>
      </div>
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
    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1 line-clamp-2 text-sm font-semibold">{value}</p>
    </div>
  )
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 max-h-28 overflow-auto text-xs leading-relaxed text-foreground">
        {value}
      </p>
    </div>
  )
}
