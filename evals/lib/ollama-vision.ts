/**
 * Free local vision classifier via Ollama (no OpenAI / AWS charges).
 * Install: https://ollama.com
 * Recommended: `ollama pull moondream` (lighter than llava on laptops).
 */

import { EVAL_CONFIG } from "../config";
import { prepareImageForOllama } from "./prepare-image";

export type VisionAnalysisResult = {
  visibleText: string;
  publicFigures: string[];
  publicFigureConfidence: number;
  appearsAIGenerated: boolean;
  syntheticMediaConfidence: number;
  politicalContext: boolean;
  politicalContextConfidence: number;
  possibleKnownManipulation: boolean;
  misinformationRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasoning: string;
};

const SYSTEM_PROMPT =
  "You are a political disinformation image analyst. Return ONLY valid JSON, no markdown.";

const USER_PROMPT = `Analyze this image for AI-generated political disinformation risk.

Return STRICT JSON:
{
  "visibleText": string,
  "publicFigures": string[],
  "publicFigureConfidence": number,
  "appearsAIGenerated": boolean,
  "syntheticMediaConfidence": number,
  "politicalContext": boolean,
  "politicalContextConfidence": number,
  "possibleKnownManipulation": boolean,
  "misinformationRisk": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "reasoning": string
}

All confidence fields 0-1. Be conservative.`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${EVAL_CONFIG.ollamaBaseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function callOllama(imageBuffer: Buffer): Promise<VisionAnalysisResult> {
  const base64 = imageBuffer.toString("base64");
  const res = await fetch(`${EVAL_CONFIG.ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(EVAL_CONFIG.ollamaRequestTimeoutMs),
    body: JSON.stringify({
      model: EVAL_CONFIG.ollamaVisionModel,
      stream: false,
      format: "json",
      options: { num_ctx: 4096 },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: USER_PROMPT,
          images: [base64],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Ollama request failed (${res.status}): ${body}. Try: ollama pull ${EVAL_CONFIG.ollamaVisionModel}`
    );
  }

  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? "{}";
  return JSON.parse(content) as VisionAnalysisResult;
}

export async function extractImageTextOllama(
  imageBuffer: Buffer
): Promise<VisionAnalysisResult> {
  const maxSide = EVAL_CONFIG.ollamaMaxImageSide;
  let prepared = await prepareImageForOllama(imageBuffer, maxSide);
  let lastError: unknown;

  for (let attempt = 0; attempt < EVAL_CONFIG.ollamaMaxRetries; attempt++) {
    try {
      return await callOllama(prepared);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable =
        msg.includes("500") ||
        msg.includes("terminated") ||
        msg.includes("GGML") ||
        msg.includes("timeout");

      if (!retryable || attempt === EVAL_CONFIG.ollamaMaxRetries - 1) {
        break;
      }

      const smaller = Math.max(256, Math.floor(maxSide / (attempt + 2)));
      console.warn(
        `  Ollama vision retry ${attempt + 2}/${EVAL_CONFIG.ollamaMaxRetries} (${smaller}px)...`
      );
      await sleep(2000 * (attempt + 1));
      prepared = await prepareImageForOllama(imageBuffer, smaller);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError));
}
