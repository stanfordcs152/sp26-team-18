import {
  AI_GENERATED_FLAG_THRESHOLD,
  POLITICAL_AI_REVIEW_THRESHOLD,
  getAnalysisAiLikelihood,
  shouldFlagAnalysis,
} from "./analyzers/flag"
import type { AIDetectionStatus, ModerationStatus, PostAnalysis, RiskLevel } from "./types"

export interface FeedLabelInput {
  isFlagged?: boolean | null
  riskLevel?: RiskLevel | null
  confidenceScore?: number | null
  moderationStatus?: ModerationStatus | null
  status?: "visible" | "labeled" | "removed" | null
  analysis?: Partial<PostAnalysis> | null
}

export interface FeedLabelResult {
  status: AIDetectionStatus
  confidence: number
  flags: string[]
}

function hasExplicitAuthenticAnalysis(analysis: Partial<PostAnalysis> | null | undefined) {
  if (!analysis) return false

  const aiLikelihood = getAnalysisAiLikelihood(analysis)
  const noPublicFigures =
    (analysis.politicians?.detected?.length ?? 0) === 0 &&
    (analysis.vision?.publicFigures?.length ?? 0) === 0

  return (
    analysis.provenance?.verified === true ||
    (analysis.vision?.appearsAIGenerated === false &&
      analysis.manipulationSignals?.possibleKnownManipulation === false &&
      analysis.vision?.possibleKnownManipulation === false &&
      analysis.risk?.level === "LOW" &&
      (aiLikelihood === null || aiLikelihood < POLITICAL_AI_REVIEW_THRESHOLD) &&
      noPublicFigures)
  )
}

function confidenceFromInput(input: FeedLabelInput) {
  const aiLikelihood = getAnalysisAiLikelihood(input.analysis)
  if (aiLikelihood !== null) return Math.round(aiLikelihood * 100)
  if (typeof input.confidenceScore === "number") return Math.round(input.confidenceScore)
  return 0
}

export function deriveFeedLabel(input: FeedLabelInput): FeedLabelResult {
  const confidence = confidenceFromInput(input)
  const flags: string[] = []
  const aiLikelihood = getAnalysisAiLikelihood(input.analysis)

  if (
    input.moderationStatus === "pending_review" ||
    input.moderationStatus === "escalated" ||
    input.status === "labeled"
  ) {
    flags.push("Post is awaiting or continuing review")
    return { status: "under_review", confidence, flags }
  }

  if (
    shouldFlagAnalysis(input.analysis) ||
    input.isFlagged === true ||
    input.riskLevel === "HIGH" ||
    input.riskLevel === "CRITICAL"
  ) {
    if (aiLikelihood !== null && aiLikelihood >= AI_GENERATED_FLAG_THRESHOLD) {
      flags.push("High AI-generation likelihood")
    } else {
      flags.push("Potential AI-generated or manipulated content")
    }

    return {
      status: confidence >= 90 ? "confirmed_ai" : "likely_ai",
      confidence,
      flags,
    }
  }

  if (hasExplicitAuthenticAnalysis(input.analysis)) {
    flags.push("Authenticity supported by analysis")
    return { status: "authentic", confidence, flags }
  }

  return {
    status: "unverified",
    confidence,
    flags: ["Authenticity has not been verified"],
  }
}
