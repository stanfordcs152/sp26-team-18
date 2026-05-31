/**
 * Zero-dependency text classifier using OpenFake manifest metadata.
 * Uses generator/source (model=...) and caption keywords — no API keys.
 */
import type { VisionAnalysisResult } from "./vision-result";
import { extractCaptionFromNotes } from "./vision-result";

const SYNTHETIC_MODEL_HINTS = [
  "gpt-image",
  "midjourney",
  "dalle",
  "dall-e",
  "stable-diffusion",
  "sd-1",
  "sd-2",
  "sdxl",
  "flux",
  "ideogram",
  "recraft",
  "imagen-",
  "nano-banana",
  "finetune",
  "lora",
  "veo-",
  "wan-",
  "kling",
  "hunyuan",
  "seedream",
  "playground",
  "kolors",
  "chroma",
  "z-image",
  "qwen-image",
  "grok-2-image",
];

const REAL_SOURCE_HINTS = ["laion", "pexels", "docci", "imagenet"];

const POLITICAL_KEYWORDS = [
  "election",
  "vote",
  "president",
  "prime minister",
  "senator",
  "congress",
  "parliament",
  "campaign",
  "protest",
  "government",
  "minister",
  "political",
  "ballot",
  "candidate",
  "democrat",
  "republican",
  "white house",
  "capitol",
];

function parseField(notes: string, key: string): string {
  const re = new RegExp(`${key}=([^;]+)`);
  const m = notes.match(re);
  return m?.[1]?.trim().toLowerCase() ?? "";
}

export function classifyCaptionRules(
  manifestNotes?: string,
  filename = "image.jpg"
): VisionAnalysisResult {
  const notes = manifestNotes ?? "";
  const caption = extractCaptionFromNotes(notes, filename);
  const combined = `${notes} ${caption} ${filename}`.toLowerCase();

  const model = parseField(notes, "model");
  const type = parseField(notes, "type");

  const syntheticByModel = SYNTHETIC_MODEL_HINTS.some((h) => model.includes(h));
  const syntheticByType = ["base", "finetune", "lora", "video"].includes(type);
  const realByModel = REAL_SOURCE_HINTS.some((h) => model.includes(h));

  const politicalHits = POLITICAL_KEYWORDS.filter((k) => combined.includes(k));
  const politicalContext = politicalHits.length > 0;

  let appearsAIGenerated = syntheticByModel || syntheticByType;
  if (realByModel && !syntheticByType) {
    appearsAIGenerated = false;
  }

  let syntheticMediaConfidence = appearsAIGenerated ? 0.75 : 0.2;
  if (syntheticByModel) syntheticMediaConfidence = 0.9;
  if (realByModel) syntheticMediaConfidence = 0.15;

  const politicalContextConfidence = Math.min(1, politicalHits.length * 0.25);

  let misinformationRisk: VisionAnalysisResult["misinformationRisk"] = "LOW";
  if (appearsAIGenerated && politicalContext) {
    misinformationRisk = "HIGH";
  } else if (appearsAIGenerated) {
    misinformationRisk = "MEDIUM";
  } else if (politicalContext) {
    misinformationRisk = "LOW";
  }

  const possibleKnownManipulation =
    appearsAIGenerated &&
    politicalContext &&
    (combined.includes("breaking") ||
      combined.includes("arrest") ||
      combined.includes("scandal") ||
      combined.includes("endorse"));

  return {
    visibleText: caption,
    publicFigures: [],
    publicFigureConfidence: 0,
    appearsAIGenerated,
    syntheticMediaConfidence,
    politicalContext,
    politicalContextConfidence,
    possibleKnownManipulation,
    misinformationRisk,
    reasoning: `Metadata classifier: model=${model || "unknown"}, type=${type || "unknown"}, political=${politicalHits.join(",") || "none"}`,
  };
}
