export type AiDetectionResult = {
  aiProbability: number;
  model: string;
  flagged: boolean;
  indicators: string[];
};

export function buildAIDetectionResult(
  appearsAIGenerated: boolean,
  aiConfidence: number,
  reasoning: string
): AiDetectionResult {
  return {
    aiProbability: aiConfidence,
    model: "gpt-4.1",
    flagged: appearsAIGenerated,
    indicators: [reasoning],
  };
}
