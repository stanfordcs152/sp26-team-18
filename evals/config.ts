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

  /**
   * Free-mode text/LLM provider for llm + hybrid approaches:
   * - rules: OpenFake metadata + caption keywords (default, $0, not a hosted LLM)
   * - gemini: Google AI Studio free tier (hosted LLM — satisfies milestone LLM row)
   */
  freeLlmProvider: (process.env.EVAL_LLM_PROVIDER ?? "rules") as FreeLlmProvider,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
} as const;

export type FreeLlmProvider = "rules" | "gemini";

export function isFreeEvalMode(): boolean {
  return (
    process.env.EVAL_FREE === "1" ||
    process.env.EVAL_FREE === "true"
  );
}
