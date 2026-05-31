/**
 * Free LLM / text classification for llm + hybrid approaches.
 * Default: rules (OpenFake metadata). Optional: Gemini free tier.
 */
import { EVAL_CONFIG, type FreeLlmProvider } from "../config";
import { classifyCaptionRules } from "./caption-rules";
import type { VisionAnalysisResult } from "./vision-result";
import { extractCaptionFromNotes } from "./vision-result";

let lastGeminiCallMs = 0;
/** Set when API returns free-tier limit:0 — skip further Gemini calls this run. */
let geminiQuotaBlocked = false;
let geminiFallbackWarned = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isZeroQuotaError(body: string): boolean {
  return body.includes("limit: 0") || body.includes('"limit":0');
}

function rulesFallbackResult(manifestNotes?: string, filename?: string) {
  const vision = classifyCaptionRules(manifestNotes, filename);
  return {
    vision,
    provider: "rules" as const,
    model: "openfake-metadata-rules (gemini-unavailable)",
  };
}

function warnGeminiFallbackOnce() {
  if (geminiFallbackWarned) return;
  geminiFallbackWarned = true;
  console.warn(
    "\n*** Gemini free tier unavailable (limit: 0 on this API key/project). ***\n" +
      "    Falling back to metadata rules for llm + hybrid this run.\n" +
      "    Fixes to try later:\n" +
      "      - Enable billing on the Google Cloud project (still free within limits)\n" +
      "      - Create a new key at https://aistudio.google.com/apikey\n" +
      "      - Remove EVAL_LLM_PROVIDER=gemini from .env.local to use rules only\n" +
      "      - Or run a small paid eval: npm run eval -- --limit 20 (OpenAI)\n"
  );
}

async function throttleGemini() {
  const delay = EVAL_CONFIG.geminiDelayMs;
  const now = Date.now();
  const wait = lastGeminiCallMs + delay - now;
  if (wait > 0) await sleep(wait);
  lastGeminiCallMs = Date.now();
}

function parseRetryDelaySeconds(errorBody: string): number | null {
  try {
    const json = JSON.parse(errorBody) as {
      error?: {
        details?: { retryDelay?: string }[];
        message?: string;
      };
    };
    for (const d of json.error?.details ?? []) {
      if (d.retryDelay) {
        const sec = parseFloat(d.retryDelay.replace("s", ""));
        if (!Number.isNaN(sec) && sec >= 1) return sec;
      }
    }
    const m = json.error?.message?.match(/retry in ([\d.]+)s/i);
    if (m) {
      const sec = parseFloat(m[1]);
      if (sec >= 1) return sec;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Call once before a full eval to detect limit:0 without burning retries per image. */
export async function probeGeminiQuota(): Promise<"ok" | "blocked" | "missing"> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "missing";

  try {
    await callGeminiApi(key, [
      {
        text: 'Return JSON only: {"status":"ok","misinformationRisk":"LOW","appearsAIGenerated":false,"politicalContext":false,"publicFigures":[],"publicFigureConfidence":0,"syntheticMediaConfidence":0,"politicalContextConfidence":0,"possibleKnownManipulation":false,"visibleText":"","reasoning":"probe"}',
      },
    ]);
    return "ok";
  } catch (err) {
    const body = (err as { body?: string }).body ?? "";
    const status = (err as { status?: number }).status;
    if (status === 429 && isZeroQuotaError(body)) {
      geminiQuotaBlocked = true;
      return "blocked";
    }
    if (status === 429) {
      geminiQuotaBlocked = true;
      return "blocked";
    }
    throw err;
  }
}

export async function classifyWithFreeLlm(
  imageBuffer: Buffer,
  filename: string,
  manifestNotes?: string
): Promise<{ vision: VisionAnalysisResult; provider: FreeLlmProvider; model: string }> {
  const provider = EVAL_CONFIG.freeLlmProvider;

  switch (provider) {
    case "rules": {
      const vision = classifyCaptionRules(manifestNotes, filename);
      return { vision, provider, model: "openfake-metadata-rules" };
    }
    case "gemini": {
      if (geminiQuotaBlocked && EVAL_CONFIG.geminiFallbackRules) {
        return rulesFallbackResult(manifestNotes, filename);
      }

      try {
        const vision = await classifyGemini(imageBuffer, filename, manifestNotes);
        const mode = EVAL_CONFIG.geminiTextOnly ? "text" : "vision";
        return { vision, provider, model: `${EVAL_CONFIG.geminiModel} (${mode})` };
      } catch (err) {
        const body = (err as { body?: string }).body ?? String(err);
        const status = (err as { status?: number }).status;
        if (
          EVAL_CONFIG.geminiFallbackRules &&
          (status === 429 || isZeroQuotaError(body))
        ) {
          geminiQuotaBlocked = true;
          warnGeminiFallbackOnce();
          return rulesFallbackResult(manifestNotes, filename);
        }
        throw err;
      }
    }
    default:
      throw new Error(`Unknown EVAL_LLM_PROVIDER: ${provider}`);
  }
}

function buildGeminiPrompt(filename: string, manifestNotes?: string, textOnly = false) {
  const caption = extractCaptionFromNotes(manifestNotes, filename);
  if (textOnly) {
    return `You are a Trust & Safety classifier for political image disinformation. You receive metadata about a social image post (not the image itself).

Filename: ${filename}
Caption / visible text: ${caption || "(none)"}
Dataset metadata: ${manifestNotes ?? ""}

Decide moderation risk for AI-generated political disinformation. Return ONLY JSON with fields: visibleText, publicFigures, publicFigureConfidence, appearsAIGenerated, syntheticMediaConfidence, politicalContext, politicalContextConfidence, possibleKnownManipulation, misinformationRisk (LOW|MEDIUM|HIGH|CRITICAL), reasoning.`;
  }
  return `You are a Trust & Safety classifier for political image disinformation. Analyze the image and metadata. Filename: ${filename}. Dataset notes: ${manifestNotes ?? ""}. Caption hint: ${caption}. Return ONLY JSON with fields: visibleText, publicFigures, publicFigureConfidence, appearsAIGenerated, syntheticMediaConfidence, politicalContext, politicalContextConfidence, possibleKnownManipulation, misinformationRisk (LOW|MEDIUM|HIGH|CRITICAL), reasoning.`;
}

async function callGeminiApi(
  key: string,
  parts: { text?: string; inline_data?: { mime_type: string; data: string } }[]
): Promise<VisionAnalysisResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EVAL_CONFIG.geminiModel}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    const err = new Error(`Gemini failed (${res.status}): ${body}`) as Error & {
      status?: number;
      body?: string;
    };
    err.status = res.status;
    err.body = body;
    throw err;
  }

  const data = JSON.parse(body) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(text) as VisionAnalysisResult;
}

async function classifyGemini(
  imageBuffer: Buffer,
  filename: string,
  manifestNotes?: string
): Promise<VisionAnalysisResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is required for EVAL_LLM_PROVIDER=gemini");
  }

  const textOnly = EVAL_CONFIG.geminiTextOnly;
  const prompt = buildGeminiPrompt(filename, manifestNotes, textOnly);
  const parts: { text?: string; inline_data?: { mime_type: string; data: string } }[] =
    [{ text: prompt }];

  if (!textOnly) {
    parts.push({
      inline_data: { mime_type: "image/jpeg", data: imageBuffer.toString("base64") },
    });
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < EVAL_CONFIG.geminiMaxRetries; attempt++) {
    await throttleGemini();
    try {
      return await callGeminiApi(key, parts);
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status;
      const body = (err as { body?: string }).body ?? String(err);

      if (isZeroQuotaError(body)) break;

      if (status !== 429 || attempt === EVAL_CONFIG.geminiMaxRetries - 1) break;

      const retrySec = parseRetryDelaySeconds(body) ?? 15 * (attempt + 1);
      console.warn(
        `  Gemini rate limit — waiting ${Math.ceil(retrySec)}s (attempt ${attempt + 2}/${EVAL_CONFIG.geminiMaxRetries})...`
      );
      await sleep(retrySec * 1000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function describeFreeLlmProvider(): string {
  if (geminiQuotaBlocked && EVAL_CONFIG.freeLlmProvider === "gemini") {
    return "rules fallback (Gemini quota unavailable)";
  }
  switch (EVAL_CONFIG.freeLlmProvider) {
    case "rules":
      return "OpenFake metadata + caption rules (text classifier, not a hosted LLM)";
    case "gemini": {
      const mode = EVAL_CONFIG.geminiTextOnly ? "text/caption" : "vision";
      return `Gemini hosted LLM (${EVAL_CONFIG.geminiModel}, ${mode})`;
    }
  }
}
