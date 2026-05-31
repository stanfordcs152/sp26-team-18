/**
 * Routes free LLM classification to the configured provider.
 * Default: caption (text-only Ollama) — reliable when vision models crash (GGML_ASSERT).
 */
import { EVAL_CONFIG, type FreeLlmProvider } from "../config";
import { classifyCaptionOllama } from "./caption-llm";
import { extractImageTextOllama } from "./ollama-vision";
import type { VisionAnalysisResult } from "./vision-result";

export async function classifyWithFreeLlm(
  imageBuffer: Buffer,
  filename: string,
  manifestNotes?: string
): Promise<{ vision: VisionAnalysisResult; provider: FreeLlmProvider; model: string }> {
  const provider = EVAL_CONFIG.freeLlmProvider;

  switch (provider) {
    case "caption": {
      const vision = await classifyCaptionOllama(manifestNotes, filename);
      return { vision, provider, model: EVAL_CONFIG.ollamaTextModel };
    }
    case "ollama-vision": {
      const vision = await extractImageTextOllama(imageBuffer);
      return { vision, provider, model: EVAL_CONFIG.ollamaVisionModel };
    }
    case "gemini": {
      const vision = await classifyGemini(imageBuffer, filename, manifestNotes);
      return { vision, provider, model: EVAL_CONFIG.geminiModel };
    }
    default:
      throw new Error(`Unknown EVAL_LLM_PROVIDER: ${provider}`);
  }
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

  const base64 = imageBuffer.toString("base64");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EVAL_CONFIG.geminiModel}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Analyze this image for AI-generated political disinformation. Filename: ${filename}. Dataset notes: ${manifestNotes ?? ""}. Return ONLY JSON with fields: visibleText, publicFigures, publicFigureConfidence, appearsAIGenerated, syntheticMediaConfidence, politicalContext, politicalContextConfidence, possibleKnownManipulation, misinformationRisk (LOW|MEDIUM|HIGH|CRITICAL), reasoning.`,
            },
            { inline_data: { mime_type: "image/jpeg", data: base64 } },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(text) as VisionAnalysisResult;
}

export function describeFreeLlmProvider(): string {
  switch (EVAL_CONFIG.freeLlmProvider) {
    case "caption":
      return `caption LLM via Ollama text (${EVAL_CONFIG.ollamaTextModel}) — uses OpenFake prompts from manifest`;
    case "ollama-vision":
      return `Ollama vision (${EVAL_CONFIG.ollamaVisionModel})`;
    case "gemini":
      return `Gemini free tier (${EVAL_CONFIG.geminiModel})`;
  }
}
