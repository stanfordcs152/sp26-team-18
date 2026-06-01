/**
 * Evaluation thresholds — tune here, then re-run `npm run eval`.
 * See evals/README.md for how these map to the milestone report.
 */
export const EVAL_CONFIG = {
  /** Rekognition celebrity MatchConfidence (0–100). Paid mode only. */
  celebrityConfidenceThreshold: 90,

  /** calculateRisk score band where heuristic hybrid escalates to the LLM. */
  uncertainRiskLow: 0.35,
  uncertainRiskHigh: 0.65,

  /** probaUnallow band where ml_hybrid escalates to the LLM. */
  mlUncertainLow: 0.3,
  mlUncertainHigh: 0.7,
  mlDecisionThreshold: 0.5,

  /** Risk levels treated as a positive (flagged) prediction. */
  flagRiskLevels: ["HIGH", "CRITICAL"] as const,

  /** Hosted LLM for free-mode llm + hybrid (Anthropic Claude). */
  claudeModel:
    process.env.ANTHROPIC_MODEL ??
    process.env.EVAL_CLAUDE_MODEL ??
    "claude-haiku-4-5",
  /** Text-only sends captions/metadata — cheap and fast. Set EVAL_CLAUDE_TEXT_ONLY=0 for vision. */
  claudeTextOnly: process.env.EVAL_CLAUDE_TEXT_ONLY !== "0",
  claudeDelayMs: Number(process.env.EVAL_CLAUDE_DELAY_MS ?? "400"),
} as const;

export function isFreeEvalMode(): boolean {
  return (
    process.env.EVAL_FREE === "1" ||
    process.env.EVAL_FREE === "true"
  );
}
