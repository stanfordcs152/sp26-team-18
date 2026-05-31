/**
 * Evaluation thresholds — tune here, then re-run `npm run eval`.
 * See evals/README.md for how these map to the milestone report.
 */
export const EVAL_CONFIG = {
  /** Rekognition celebrity MatchConfidence (0–100). Paid mode only. */
  celebrityConfidenceThreshold: 90,

  /** calculateRisk score band where hybrid escalates to the LLM. */
  uncertainRiskLow: 0.35,
  uncertainRiskHigh: 0.65,

  /** Risk levels treated as a positive (flagged) prediction. */
  flagRiskLevels: ["HIGH", "CRITICAL"] as const,

  /** Free mode: local Ollama vision (https://ollama.com). */
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  ollamaVisionModel: process.env.OLLAMA_VISION_MODEL ?? "llava",
} as const;

export function isFreeEvalMode(): boolean {
  return (
    process.env.EVAL_FREE === "1" ||
    process.env.EVAL_FREE === "true"
  );
}
