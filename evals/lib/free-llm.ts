/**
 * Hosted LLM for free-mode llm + hybrid approaches (Anthropic Claude).
 */
import { EVAL_CONFIG } from "../config";
import type { VisionAnalysisResult } from "./vision-result";
import { extractCaptionFromNotes } from "./vision-result";

let lastClaudeCallMs = 0;

type ClaudeContent =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttleClaude() {
  const delay = EVAL_CONFIG.claudeDelayMs;
  const now = Date.now();
  const wait = lastClaudeCallMs + delay - now;
  if (wait > 0) await sleep(wait);
  lastClaudeCallMs = Date.now();
}

function buildClassifierPrompt(filename: string, manifestNotes?: string, textOnly = false) {
  const caption = extractCaptionFromNotes(manifestNotes, filename);
  const jsonFields =
    "visibleText, publicFigures, publicFigureConfidence, appearsAIGenerated, syntheticMediaConfidence, politicalContext, politicalContextConfidence, possibleKnownManipulation, misinformationRisk (LOW|MEDIUM|HIGH|CRITICAL), reasoning";

  if (textOnly) {
    return `You are a Trust & Safety classifier for political image disinformation. You receive metadata about a social image post (not the image itself).

Filename: ${filename}
Caption / visible text: ${caption || "(none)"}
Dataset metadata: ${manifestNotes ?? ""}

Decide moderation risk for AI-generated political disinformation. Return ONLY JSON with fields: ${jsonFields}.`;
  }

  return `You are a Trust & Safety classifier for political image disinformation. Analyze the image and metadata.

Filename: ${filename}
Dataset notes: ${manifestNotes ?? ""}
Caption hint: ${caption || "(none)"}

Return ONLY JSON with fields: ${jsonFields}.`;
}

function parseJsonFromModelText(text: string): VisionAnalysisResult {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(jsonText) as VisionAnalysisResult;
}

async function callClaudeApi(content: ClaudeContent[]): Promise<VisionAnalysisResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is required for npm run eval:free");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: EVAL_CONFIG.claudeModel,
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Claude failed (${res.status}): ${body}`);
  }

  const data = JSON.parse(body) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((part) => part.type === "text")?.text ?? "{}";
  return parseJsonFromModelText(text);
}

async function classifyClaude(
  imageBuffer: Buffer,
  filename: string,
  manifestNotes?: string
): Promise<VisionAnalysisResult> {
  const textOnly = EVAL_CONFIG.claudeTextOnly;
  const prompt = buildClassifierPrompt(filename, manifestNotes, textOnly);

  await throttleClaude();

  const content: ClaudeContent[] = [{ type: "text", text: prompt }];
  if (!textOnly) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: imageBuffer.toString("base64"),
      },
    });
  }

  return callClaudeApi(content);
}

export async function classifyWithFreeLlm(
  imageBuffer: Buffer,
  filename: string,
  manifestNotes?: string
): Promise<{ vision: VisionAnalysisResult; provider: "claude"; model: string }> {
  const vision = await classifyClaude(imageBuffer, filename, manifestNotes);
  const mode = EVAL_CONFIG.claudeTextOnly ? "text" : "vision";
  return {
    vision,
    provider: "claude",
    model: `${EVAL_CONFIG.claudeModel} (${mode})`,
  };
}

export function describeFreeLlmProvider(): string {
  const mode = EVAL_CONFIG.claudeTextOnly ? "text/caption" : "vision";
  return `Claude hosted LLM (${EVAL_CONFIG.claudeModel}, ${mode})`;
}
