import { EVAL_CONFIG } from "../config";
import { detectAi } from "@/lib/ai-detection";
import { detectCelebrities } from "@/lib/analyzers/celebrity";
import { extractImageText } from "@/lib/analyzers/ocr";
import { calculateRisk, type RiskLevel } from "@/lib/analyzers/risk";
import { checkC2pa } from "@/lib/c2pa";
import type { ClassifierPrediction } from "./types";

function isFlagRiskLevel(level: RiskLevel) {
  return (EVAL_CONFIG.flagRiskLevels as readonly string[]).includes(level);
}

function visionShouldFlag(vision: Awaited<ReturnType<typeof extractImageText>>) {
  if (vision.misinformationRisk === "HIGH" || vision.misinformationRisk === "CRITICAL") {
    return true;
  }
  return (
    vision.appearsAIGenerated &&
    vision.politicalContext &&
    vision.publicFigures.length > 0
  );
}

async function heuristicSignals(imageBuffer: Buffer, filename: string) {
  const c2pa = await checkC2pa(new Uint8Array(imageBuffer));
  const ai = detectAi({ filename, c2paStatus: c2pa.status });
  const celebrities = await detectCelebrities(imageBuffer);
  const top = [...celebrities].sort(
    (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)
  )[0];
  const hasPoliticalFigure =
    (top?.confidence ?? 0) >= EVAL_CONFIG.celebrityConfidenceThreshold;

  const risk = calculateRisk({
    provenance: {
      verified: c2pa.status === "verified",
      present: c2pa.status !== "missing" && c2pa.status !== "no_image",
    },
    ai: { aiProbability: ai.confidenceScore / 100 },
    politicians: {
      detected: hasPoliticalFigure && top?.name ? [top.name] : [],
    },
    reportCount: 0,
  });

  return { c2pa, ai, hasPoliticalFigure, risk };
}

/** C2PA + filename heuristics + Rekognition celebrities + rule-based risk (no LLM). */
export async function classifyHeuristic(
  imageBuffer: Buffer,
  filename: string
): Promise<ClassifierPrediction> {
  const start = performance.now();
  const { c2pa, ai, hasPoliticalFigure, risk } = await heuristicSignals(
    imageBuffer,
    filename
  );

  const flagged =
    isFlagRiskLevel(risk.level) ||
    (hasPoliticalFigure && ai.isFlagged) ||
    (hasPoliticalFigure && c2pa.status !== "verified");

  return {
    flagged,
    latencyMs: performance.now() - start,
    usedLlm: false,
    meta: {
      c2paStatus: c2pa.status,
      riskLevel: risk.level,
      riskScore: risk.score,
      aiScore: ai.confidenceScore,
      hasPoliticalFigure,
    },
  };
}

/** OpenAI Vision JSON classifier (Rekognition hints included in the prompt). */
export async function classifyLlm(
  imageBuffer: Buffer
): Promise<ClassifierPrediction> {
  const start = performance.now();
  const vision = await extractImageText(imageBuffer);

  return {
    flagged: visionShouldFlag(vision),
    latencyMs: performance.now() - start,
    usedLlm: true,
    meta: {
      misinformationRisk: vision.misinformationRisk,
      appearsAIGenerated: vision.appearsAIGenerated,
      politicalContext: vision.politicalContext,
      publicFigures: vision.publicFigures,
    },
  };
}

/**
 * Cheap heuristic first; LLM only on uncertain risk or celebrity / invalid C2PA.
 */
export async function classifyHybrid(
  imageBuffer: Buffer,
  filename: string
): Promise<ClassifierPrediction> {
  const start = performance.now();
  const signals = await heuristicSignals(imageBuffer, filename);

  const clearlyAllow =
    signals.c2pa.status === "verified" &&
    !signals.hasPoliticalFigure &&
    signals.risk.score < EVAL_CONFIG.uncertainRiskLow;

  if (clearlyAllow) {
    return {
      flagged: false,
      latencyMs: performance.now() - start,
      usedLlm: false,
      meta: { route: "fast-allow", riskScore: signals.risk.score },
    };
  }

  const clearlyBlock =
    isFlagRiskLevel(signals.risk.level) &&
    signals.hasPoliticalFigure &&
    signals.ai.isFlagged;

  if (clearlyBlock) {
    return {
      flagged: true,
      latencyMs: performance.now() - start,
      usedLlm: false,
      meta: { route: "fast-block", riskScore: signals.risk.score },
    };
  }

  const uncertain =
    signals.risk.score >= EVAL_CONFIG.uncertainRiskLow &&
    signals.risk.score < EVAL_CONFIG.uncertainRiskHigh;

  const needsLlm =
    uncertain ||
    signals.hasPoliticalFigure ||
    signals.c2pa.status === "invalid";

  if (!needsLlm) {
    return {
      flagged: isFlagRiskLevel(signals.risk.level),
      latencyMs: performance.now() - start,
      usedLlm: false,
      meta: { route: "heuristic-final", riskScore: signals.risk.score },
    };
  }

  const vision = await extractImageText(imageBuffer);

  return {
    flagged: visionShouldFlag(vision),
    latencyMs: performance.now() - start,
    usedLlm: true,
    meta: {
      route: "llm-adjudication",
      heuristicRiskScore: signals.risk.score,
      misinformationRisk: vision.misinformationRisk,
    },
  };
}
