export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ProvenanceResult = {
  verified?: boolean;
  present?: boolean;
};

export type OcrResult = {
  text?: string;
  hasText?: boolean;
  matchedKeywords?: string[];
};

export type AiDetectionResult = {
  aiProbability?: number;
};

export type PoliticalFigureResult = {
  detected?: string[];
  confidence?: number;
};

export type ManipulationSignalsResult = {
  possibleKnownManipulation?: boolean;
  politicalContext?: boolean;
  politicalContextConfidence?: number;
};

export type RiskInput = {
  provenance?: ProvenanceResult;
  ocr?: OcrResult;
  ai?: AiDetectionResult;
  politicians?: PoliticalFigureResult;
  manipulationSignals?: ManipulationSignalsResult;
  reportCount?: number;
};

export type RiskResult = {
  score: number;
  level: RiskLevel;
  reasons: string[];
};

function clampScore(score: number) {
  return Math.max(0, Math.min(1, score));
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 0.85) return "CRITICAL";
  if (score >= 0.65) return "HIGH";
  if (score >= 0.35) return "MEDIUM";
  return "LOW";
}

export function calculateRisk(input: RiskInput): RiskResult {
  const reasons: string[] = [];

  const aiProbability = input.ai?.aiProbability ?? 0;
  const provenanceMissing =
    input.provenance?.verified === false ||
    input.provenance?.present === false;
  const politicianDetected =
    (input.politicians?.detected?.length ?? 0) > 0;
  const electionKeywordCount =
    input.ocr?.matchedKeywords?.length ?? 0;
  const reportCount = input.reportCount ?? 0;

  const possibleKnownManipulation =
    input.manipulationSignals?.possibleKnownManipulation ?? false;

  const politicalContext =
    input.manipulationSignals?.politicalContext ?? false;

  const politicalContextConfidence =
    input.manipulationSignals?.politicalContextConfidence ?? 0;

  let score = 0;

  score += 0.4 * clampScore(aiProbability);

  if (provenanceMissing) {
    score += 0.25;
    reasons.push("Missing or unverifiable provenance metadata");
  }

  if (politicianDetected) {
    score += 0.2;
    reasons.push(
      `Political figure detected: ${input.politicians?.detected?.join(", ")}`
    );
  }

  if (politicalContext) {
    score += 0.1 * clampScore(politicalContextConfidence);
    reasons.push("Political context detected");
  }

  if (possibleKnownManipulation) {
    score += 0.15;
    reasons.push("Possible known political manipulation or deepfake pattern detected");
  }

  if (electionKeywordCount > 0) {
    score += Math.min(0.1, electionKeywordCount * 0.03);
    reasons.push(
      `Election-related text detected: ${input.ocr?.matchedKeywords?.join(
        ", "
      )}`
    );
  }

  if (reportCount > 0) {
    score += Math.min(0.05, reportCount * 0.01);
    reasons.push(
      `${reportCount} user report${reportCount === 1 ? "" : "s"}`
    );
  }

  if (aiProbability >= 0.7) {
    reasons.push(
      `High AI-generation likelihood: ${Math.round(aiProbability * 100)}%`
    );
  } else if (aiProbability >= 0.4) {
    reasons.push(
      `Moderate AI-generation likelihood: ${Math.round(aiProbability * 100)}%`
    );
  }

  const finalScore = clampScore(score);

  return {
    score: finalScore,
    level: getRiskLevel(finalScore),
    reasons,
  };
}
