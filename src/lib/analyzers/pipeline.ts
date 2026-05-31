import { extractImageText } from "./ocr";
import { buildAIDetectionResult } from "./detector";
import { calculateRisk } from "./risk";

// Minimum confidence required to treat detected political context as the
// authoritative `posts.is_political` signal. The single source of truth for
// scoping political content into moderation — tune here only.
export const POLITICAL_CONTEXT_CONFIDENCE_THRESHOLD = 0.6;

export async function runAnalysisPipeline(imageBuffer: Buffer) {
  const provenance = {
    verified: false,
    present: false,
  };

  const vision = await extractImageText(imageBuffer);

  const electionKeywords = [
    "election",
    "vote",
    "fraud",
    "ballot",
    "protest",
    "candidate",
    "president",
    "prime minister",
    "campaign",
  ];

  const matchedKeywords = electionKeywords.filter((keyword) =>
    vision.visibleText.toLowerCase().includes(keyword)
  );

  const ocr = {
    text: vision.visibleText,
    hasText: vision.visibleText.trim().length > 0,
    matchedKeywords,
  };

  const ai = buildAIDetectionResult(
    vision.appearsAIGenerated,
    vision.syntheticMediaConfidence,
    vision.reasoning
  );

  const politicians = {
    detected: vision.publicFigures,
    confidence: vision.publicFigureConfidence,
  };

  const manipulationSignals = {
    possibleKnownManipulation: vision.possibleKnownManipulation,
    politicalContext: vision.politicalContext,
    politicalContextConfidence: vision.politicalContextConfidence,
  };

  // Authoritative political-scope flag persisted to posts.is_political and used
  // to gate the moderation queue. Only confident political context counts.
  const isPolitical =
    vision.politicalContext &&
    vision.politicalContextConfidence > POLITICAL_CONTEXT_CONFIDENCE_THRESHOLD;

  const risk = calculateRisk({
    provenance,
    ocr,
    ai,
    politicians,
    manipulationSignals,
    reportCount: 3,
  });

  return {
    provenance,
    vision,
    ocr,
    ai,
    politicians,
    manipulationSignals,
    isPolitical,
    risk,
  };
}
