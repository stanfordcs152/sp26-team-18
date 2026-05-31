import type { ApproachId } from "./types";

/** Override via env when you have real billing numbers for the poster. */
export const PRICING = {
  rekognitionCelebrityPerImageUsd: Number(
    process.env.EVAL_REKOGNITION_USD_PER_IMAGE ?? "0.001"
  ),
  openaiVisionPerImageUsd: Number(
    process.env.EVAL_OPENAI_VISION_USD_PER_IMAGE ?? "0.012"
  ),
  c2paLocalPerImageUsd: 0,
} as const;

export function estimateCostUsdPer1000(
  approach: ApproachId,
  stats: { totalExamples: number; llmCalls: number }
): number {
  const n = stats.totalExamples;
  if (n === 0) return 0;

  const rek = PRICING.rekognitionCelebrityPerImageUsd;
  const llm = PRICING.openaiVisionPerImageUsd;

  let perImage = 0;
  switch (approach) {
    case "heuristic":
      perImage = rek + PRICING.c2paLocalPerImageUsd;
      break;
    case "llm":
      perImage = rek + llm;
      break;
    case "hybrid": {
      const llmRate = stats.llmCalls / n;
      perImage = rek + llmRate * llm;
      break;
    }
  }

  return perImage * 1000;
}
