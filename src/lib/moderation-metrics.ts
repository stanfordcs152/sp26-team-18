import { MODERATION_RISK_SCORE_THRESHOLD, shouldFlagAnalysis } from "./analyzers/flag"
import type { LiveQueueItem } from "./types"

export const CRITICAL_RISK_SCORE_THRESHOLD = 0.85

export type ModerationMetricFilter =
  | "pending"
  | "highRisk"
  | "critical"
  | "reviewedToday"
  | "flagsToday"
  | "flagsThisWeek"
  | "removalsToday"
  | "approvalsToday"
  | "escalationsToday"

export const MODERATION_FILTER_LABELS: Record<ModerationMetricFilter, string> = {
  pending: "Pending Review",
  highRisk: "High Risk",
  critical: "Critical",
  reviewedToday: "Reviewed Today",
  flagsToday: "Flags Today",
  flagsThisWeek: "Flags This Week",
  removalsToday: "Removals Today",
  approvalsToday: "Approvals Today",
  escalationsToday: "Escalations Today",
}

function since(referenceTime: number, milliseconds: number) {
  return referenceTime - milliseconds
}

function timeValue(value: string | null | undefined) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function withinLast(value: string | null | undefined, milliseconds: number, referenceTime: number) {
  const parsed = timeValue(value)
  return parsed !== null && parsed >= since(referenceTime, milliseconds)
}

export function isHighRiskItem(item: LiveQueueItem) {
  return (
    item.riskLevel === "HIGH" ||
    item.riskLevel === "CRITICAL" ||
    (item.riskScore ?? 0) >= MODERATION_RISK_SCORE_THRESHOLD
  )
}

export function isCriticalRiskItem(item: LiveQueueItem) {
  return item.riskLevel === "CRITICAL" || (item.riskScore ?? 0) >= CRITICAL_RISK_SCORE_THRESHOLD
}

export function isAnalysisFlaggedItem(item: LiveQueueItem) {
  return (
    item.isFlagged === true ||
    shouldFlagAnalysis(item.analysis) ||
    isHighRiskItem(item) ||
    item.analysis?.vision?.appearsAIGenerated === true ||
    item.analysis?.manipulationSignals?.possibleKnownManipulation === true ||
    item.analysis?.vision?.possibleKnownManipulation === true
  )
}

export function matchesModerationFilter(
  item: LiveQueueItem,
  filter: ModerationMetricFilter,
  referenceTime = Date.now()
) {
  const oneDay = 24 * 60 * 60 * 1000
  const oneWeek = 7 * oneDay

  switch (filter) {
    case "pending":
      return (
        item.isFlagged === true ||
        item.moderationStatus === "pending_review" ||
        item.moderationStatus === "escalated"
      )
    case "highRisk":
      return isHighRiskItem(item)
    case "critical":
      return isCriticalRiskItem(item)
    case "reviewedToday":
      return withinLast(item.reviewedAt, oneDay, referenceTime)
    case "flagsToday":
      return withinLast(item.post.createdAt, oneDay, referenceTime) && isAnalysisFlaggedItem(item)
    case "flagsThisWeek":
      return withinLast(item.post.createdAt, oneWeek, referenceTime) && isAnalysisFlaggedItem(item)
    case "removalsToday":
      return item.moderationStatus === "removed" || withinLast(item.removedAt, oneDay, referenceTime)
    case "approvalsToday":
      return item.moderationStatus === "approved" && withinLast(item.reviewedAt, oneDay, referenceTime)
    case "escalationsToday":
      return (
        item.moderationStatus === "escalated" &&
        (withinLast(item.reviewedAt, oneDay, referenceTime) ||
          withinLast(item.escalatedAt, oneDay, referenceTime))
      )
  }
}

export function countModerationFilter(
  items: LiveQueueItem[],
  filter: ModerationMetricFilter,
  referenceTime = Date.now()
) {
  return items.filter((item) => matchesModerationFilter(item, filter, referenceTime)).length
}
