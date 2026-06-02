/**
 * Zero-API-cost classifiers for milestone evals.
 */

import { EVAL_CONFIG } from "../config";
import { detectAi } from "@/lib/ai-detection";
import { calculateRisk, type RiskLevel } from "@/lib/analyzers/risk";
import { checkC2pa } from "./c2pa-check";
import { classifyWithFreeLlm } from "./free-llm";
import { visionShouldFlag } from "./vision-result";
import type { ClassifierPrediction } from "./types";

const ELECTION_KEYWORDS = [
  "election",
  "vote",
  "fraud",
  "ballot",
  "protest",
  "candidate",
  "president",
  "prime minister",
  "campaign",
] as const;

function isFlagRiskLevel(level: RiskLevel) {
  return (EVAL_CONFIG.flagRiskLevels as readonly string[]).includes(level);
}

function matchedElectionKeywords(text: string) {
  const lower = text.toLowerCase();
  return ELECTION_KEYWORDS.filter((k) => lower.includes(k));
}

async function heuristicSignalsFree(
  imageBuffer: Buffer,
  filename: string,
  manifestNotes?: string
) {
  const c2pa = await checkC2pa(new Uint8Array(imageBuffer));
  const ai = detectAi({ filename, c2paStatus: c2pa.status });
  const keywordText = [manifestNotes ?? "", filename].join(" ");
  const matchedKeywords = matchedElectionKeywords(keywordText);

  const risk = calculateRisk({
    provenance: {
      verified: c2pa.status === "verified",
      present: c2pa.status !== "missing" && c2pa.status !== "no_image",
    },
    ai: { aiProbability: ai.confidenceScore / 100 },
    ocr: { matchedKeywords, hasText: matchedKeywords.length > 0 },
    reportCount: 0,
  });

  return { c2pa, ai, risk, matchedKeywords };
}

export async function classifyHeuristicFree(
  imageBuffer: Buffer,
  filename: string,
  manifestNotes?: string
): Promise<ClassifierPrediction> {
  const start = performance.now();
  const { c2pa, ai, risk, matchedKeywords } = await heuristicSignalsFree(
    imageBuffer,
    filename,
    manifestNotes
  );

  const flagged =
    isFlagRiskLevel(risk.level) ||
    (ai.isFlagged && matchedKeywords.length > 0) ||
    (c2pa.status === "invalid" && ai.isFlagged);

  return {
    flagged,
    latencyMs: performance.now() - start,
    usedLlm: false,
    meta: {
      mode: "free",
      c2paStatus: c2pa.status,
      riskLevel: risk.level,
      riskScore: risk.score,
      aiScore: ai.confidenceScore,
      matchedKeywords,
    },
  };
}

export async function classifyLlmFree(
  imageBuffer: Buffer,
  filename = "image.jpg",
  manifestNotes?: string
): Promise<ClassifierPrediction> {
  const start = performance.now();
  const { vision, provider, model } = await classifyWithFreeLlm(
    imageBuffer,
    filename,
    manifestNotes
  );

  return {
    flagged: visionShouldFlag(vision),
    latencyMs: performance.now() - start,
    usedLlm: true,
    meta: {
      mode: "free",
      provider,
      model,
      misinformationRisk: vision.misinformationRisk,
      appearsAIGenerated: vision.appearsAIGenerated,
      politicalContext: vision.politicalContext,
    },
  };
}

export async function classifyHybridFree(
  imageBuffer: Buffer,
  filename: string,
  manifestNotes?: string
): Promise<ClassifierPrediction> {
  const start = performance.now();
  const signals = await heuristicSignalsFree(imageBuffer, filename, manifestNotes);

  const clearlyAllow =
    signals.c2pa.status === "verified" &&
    signals.risk.score < EVAL_CONFIG.uncertainRiskLow;

  if (clearlyAllow) {
    return {
      flagged: false,
      latencyMs: performance.now() - start,
      usedLlm: false,
      meta: { mode: "free", route: "fast-allow", riskScore: signals.risk.score },
    };
  }

  const clearlyBlock =
    isFlagRiskLevel(signals.risk.level) && signals.ai.isFlagged;

  if (clearlyBlock) {
    return {
      flagged: true,
      latencyMs: performance.now() - start,
      usedLlm: false,
      meta: { mode: "free", route: "fast-block", riskScore: signals.risk.score },
    };
  }

  const uncertain =
    signals.risk.score >= EVAL_CONFIG.uncertainRiskLow &&
    signals.risk.score < EVAL_CONFIG.uncertainRiskHigh;

  const needsLlm = uncertain || signals.c2pa.status === "invalid";

  if (!needsLlm) {
    return {
      flagged: isFlagRiskLevel(signals.risk.level),
      latencyMs: performance.now() - start,
      usedLlm: false,
      meta: { mode: "free", route: "heuristic-final", riskScore: signals.risk.score },
    };
  }

  const { vision, provider, model } = await classifyWithFreeLlm(
    imageBuffer,
    filename,
    manifestNotes
  );

  return {
    flagged: visionShouldFlag(vision),
    latencyMs: performance.now() - start,
    usedLlm: true,
    meta: {
      mode: "free",
      route: "llm-adjudication",
      provider,
      model,
      heuristicRiskScore: signals.risk.score,
      misinformationRisk: vision.misinformationRisk,
    },
  };
}
