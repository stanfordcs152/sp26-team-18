/**
 * Text-only LLM classifier using OpenFake captions from manifest notes.
 * No vision / GPU required — runs on small Ollama text models (llama3.2:1b).
 */
import { EVAL_CONFIG } from "../config";
import type { VisionAnalysisResult } from "./vision-result";
import { extractCaptionFromNotes } from "./vision-result";

const SYSTEM_PROMPT =
  "You classify political image posts for AI-generated disinformation risk. Return ONLY valid JSON.";

function buildUserPrompt(caption: string, filename: string) {
  return `A moderation system is reviewing an image post. You do NOT see the image — only metadata:

Filename: ${filename}
Caption / visible text (from dataset): ${caption || "(none)"}

Decide if this post should be RESTRICTED as likely AI-generated political disinformation.

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

All confidence fields 0-1.`;
}

export async function classifyCaptionOllama(
  manifestNotes?: string,
  filename = "image.jpg"
): Promise<VisionAnalysisResult> {
  const caption = extractCaptionFromNotes(manifestNotes, filename);

  const res = await fetch(`${EVAL_CONFIG.ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(EVAL_CONFIG.ollamaRequestTimeoutMs),
    body: JSON.stringify({
      model: EVAL_CONFIG.ollamaTextModel,
      stream: false,
      format: "json",
      keep_alive: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(caption, filename) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Ollama text LLM failed (${res.status}): ${body}. Run: ollama pull ${EVAL_CONFIG.ollamaTextModel}`
    );
  }

  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? "{}";
  return JSON.parse(content) as VisionAnalysisResult;
}
