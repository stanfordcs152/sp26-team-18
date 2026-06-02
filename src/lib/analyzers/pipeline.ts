import { extractImageText } from "./ocr";
import { buildAIDetectionResult } from "./detector";
import { calculateRisk } from "./risk";

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
    risk,
  };
}
