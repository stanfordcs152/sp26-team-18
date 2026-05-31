/**
 * Zero-API-cost classifiers for milestone evals.
 * - heuristic: C2PA + filename heuristics + rule risk (optional prompt keywords from manifest notes)
 * - llm: Ollama vision (local)
 * - hybrid: heuristic first, Ollama on uncertain band
 */

import { EVAL_CONFIG } from "../config";
import { detectAi } from "@/lib/ai-detection";
import { calculateRisk, type RiskLevel } from "@/lib/analyzers/risk";
import { checkC2pa } from "@/lib/c2pa";
import {
  extractImageTextOllama,
  type VisionAnalysisResult,
} from "./ollama-vision";
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

function visionShouldFlag(vision: VisionAnalysisResult) {
  if (vision.misinformationRisk === "HIGH" || vision.misinformationRisk === "CRITICAL") {
    return true;
  }
  return (
    vision.appearsAIGenerated &&
    vision.politicalContext &&
    vision.publicFigures.length > 0
  );
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

/** Free traditional path: C2PA + filename + keyword hints from manifest (no AWS). */
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

/** Free LLM path: Ollama vision (local). */
export async function classifyLlmFree(
  imageBuffer: Buffer,
  _filename?: string,
  _manifestNotes?: string
): Promise<ClassifierPrediction> {
  const start = performance.now();
  const vision = await extractImageTextOllama(imageBuffer);

  return {
    flagged: visionShouldFlag(vision),
    latencyMs: performance.now() - start,
    usedLlm: true,
    meta: {
      mode: "free",
      provider: "ollama",
      model: EVAL_CONFIG.ollamaVisionModel,
      misinformationRisk: vision.misinformationRisk,
      appearsAIGenerated: vision.appearsAIGenerated,
      politicalContext: vision.politicalContext,
    },
  };
}

/** Free hybrid: C2PA/heuristic first, Ollama only when uncertain. */
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

  const vision = await extractImageTextOllama(imageBuffer);

  return {
    flagged: visionShouldFlag(vision),
    latencyMs: performance.now() - start,
    usedLlm: true,
    meta: {
      mode: "free",
      route: "ollama-adjudication",
      model: EVAL_CONFIG.ollamaVisionModel,
      heuristicRiskScore: signals.risk.score,
      misinformationRisk: vision.misinformationRisk,
    },
  };
}
