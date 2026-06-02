export type AiDetectionResult = {
  aiProbability: number;
  model: string;
  flagged: boolean;
  indicators: string[];
};

// Routing threshold for the AI flag. A post is flagged when the synthetic-media
// probability is at or above this value. Tuned to keep recall >= 0.85 (catch
// most true deepfakes) while holding the false-positive rate <= 0.05 (avoid
// flagging real images). Lowering it catches more deepfakes but floods
// moderators with false positives; raising it lets more synthetic political
// images slip through. Matches the "high AI-generation likelihood" cutoff in
// risk.ts so "flagged" stays consistent with the risk reasoning.
export const AI_FLAG_THRESHOLD = 0.7;

export function buildAIDetectionResult(
  aiConfidence: number,
  reasoning: string
): AiDetectionResult {
  return {
    aiProbability: aiConfidence,
    model: "gpt-4.1",
    flagged: aiConfidence >= AI_FLAG_THRESHOLD,
    indicators: [reasoning],
  };
}
