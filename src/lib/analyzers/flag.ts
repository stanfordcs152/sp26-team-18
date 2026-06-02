import type { PostAnalysis } from "@/lib/types";

export const AI_GENERATED_FLAG_THRESHOLD = 0.6;
export const POLITICAL_AI_REVIEW_THRESHOLD = 0.4;
export const MODERATION_RISK_SCORE_THRESHOLD = 0.6;

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function highOrCritical(value: unknown): boolean {
  return value === "HIGH" || value === "CRITICAL";
}

function hasPublicFigure(analysis: Partial<PostAnalysis>): boolean {
  return (
    (analysis.politicians?.detected?.length ?? 0) > 0 ||
    (analysis.vision?.publicFigures?.length ?? 0) > 0
  );
}

export function getAnalysisAiLikelihood(
  analysis: Partial<PostAnalysis> | null | undefined
): number | null {
  if (!analysis) return null;
  return (
    numeric(analysis.ai?.aiProbability) ??
    numeric(analysis.vision?.syntheticMediaConfidence) ??
    numeric(analysis.vision?.aiConfidence)
  );
}

/** Same allow/unallow decision as the upload flow and moderation warning. */
export function shouldFlagAnalysis(
  analysis: Partial<PostAnalysis> | null | undefined
): boolean {
  if (!analysis) return false;

  const aiLikelihood = getAnalysisAiLikelihood(analysis);
  const politicalOrPublicFigure =
    analysis.vision?.politicalContext === true ||
    analysis.manipulationSignals?.politicalContext === true ||
    hasPublicFigure(analysis);

  return (
    highOrCritical(analysis.risk?.level) ||
    (numeric(analysis.risk?.score) ?? 0) >= MODERATION_RISK_SCORE_THRESHOLD ||
    analysis.manipulationSignals?.possibleKnownManipulation === true ||
    analysis.vision?.possibleKnownManipulation === true ||
    highOrCritical(analysis.vision?.misinformationRisk) ||
    (politicalOrPublicFigure &&
      (analysis.vision?.appearsAIGenerated === true ||
        (aiLikelihood !== null && aiLikelihood >= AI_GENERATED_FLAG_THRESHOLD)))
  );
}
