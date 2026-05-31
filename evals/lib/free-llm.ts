/**
 * Free LLM / text classification for llm + hybrid approaches.
 * Default: rules (OpenFake metadata). Optional: Gemini free tier.
 */
import { EVAL_CONFIG, type FreeLlmProvider } from "../config";
import { classifyCaptionRules } from "./caption-rules";
import type { VisionAnalysisResult } from "./vision-result";
import { extractCaptionFromNotes } from "./vision-result";

let lastGeminiCallMs = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
        if (!Number.isNaN(sec)) return sec;
      }
    }
    const m = json.error?.message?.match(/retry in ([\d.]+)s/i);
    if (m) return parseFloat(m[1]);
  } catch {
    /* ignore */
  }
  return null;
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
      const vision = await classifyGemini(imageBuffer, filename, manifestNotes);
      const mode = EVAL_CONFIG.geminiTextOnly ? "text" : "vision";
      return { vision, provider, model: `${EVAL_CONFIG.geminiModel} (${mode})` };
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
  switch (EVAL_CONFIG.freeLlmProvider) {
    case "rules":
      return "OpenFake metadata + caption rules (text classifier, not a hosted LLM)";
    case "gemini": {
      const mode = EVAL_CONFIG.geminiTextOnly ? "text/caption" : "vision";
      return `Gemini hosted LLM (${EVAL_CONFIG.geminiModel}, ${mode})`;
    }
  }
}
