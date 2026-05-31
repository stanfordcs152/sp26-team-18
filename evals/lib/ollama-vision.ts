/**
 * Free local vision classifier via Ollama (no OpenAI / AWS charges).
 * Install: https://ollama.com — then `ollama pull llava` (or llama3.2-vision).
 */

import { EVAL_CONFIG } from "../config";

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

export async function extractImageTextOllama(
  imageBuffer: Buffer
): Promise<VisionAnalysisResult> {
  const base64 = imageBuffer.toString("base64");
  const res = await fetch(`${EVAL_CONFIG.ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EVAL_CONFIG.ollamaVisionModel,
      stream: false,
      format: "json",
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
      `Ollama request failed (${res.status}): ${body}. Is Ollama running? Try: ollama pull ${EVAL_CONFIG.ollamaVisionModel}`
    );
  }

  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? "{}";
  return JSON.parse(content) as VisionAnalysisResult;
}
