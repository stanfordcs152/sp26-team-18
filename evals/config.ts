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
  /** moondream is lighter than llava on consumer GPUs; override with OLLAMA_VISION_MODEL. */
  ollamaVisionModel: process.env.OLLAMA_VISION_MODEL ?? "moondream",
  ollamaMaxImageSide: Number(process.env.OLLAMA_MAX_IMAGE_SIDE ?? "512"),
  ollamaMaxRetries: Number(process.env.OLLAMA_MAX_RETRIES ?? "3"),
  ollamaRequestTimeoutMs: Number(process.env.OLLAMA_REQUEST_TIMEOUT_MS ?? "120000"),

  /**
   * Free LLM provider for llm + hybrid approaches:
   * - caption: text-only Ollama on OpenFake manifest prompts (default, no GPU vision)
   * - ollama-vision: local vision model (needs working GPU/VRAM)
   * - gemini: Google AI Studio free tier (set GEMINI_API_KEY)
   */
  freeLlmProvider: (process.env.EVAL_LLM_PROVIDER ?? "caption") as FreeLlmProvider,
  ollamaTextModel: process.env.OLLAMA_TEXT_MODEL ?? "llama3.2:1b",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
} as const;

export type FreeLlmProvider = "caption" | "ollama-vision" | "gemini";

export function isFreeEvalMode(): boolean {
  return (
    process.env.EVAL_FREE === "1" ||
    process.env.EVAL_FREE === "true"
  );
}
