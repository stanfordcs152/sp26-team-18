import OpenAI from "openai";
import { detectCelebrities } from "./celebrity";
import {
  getRecentModeratorExamples,
  formatModeratorExamples,
} from "./feedback";

// Lazily constructed so importing this module (e.g. during `next build` page
// data collection) doesn't throw when OPENAI_API_KEY is unset. The client is
// only needed at request time.
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export type VisionAnalysisResult = {
  visibleText: string;
  publicFigures: string[];
  publicFigureConfidence: number;
  appearsAIGenerated: boolean;
  aiConfidence?: number;
  syntheticMediaConfidence: number;
  politicalContext: boolean;
  politicalContextConfidence: number;
  possibleKnownManipulation: boolean;
  misinformationRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasoning: string;
};

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeVisionAnalysis(raw: unknown): VisionAnalysisResult {
  const record =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const aiConfidence = asNumber(
    record.syntheticMediaConfidence ?? record.aiConfidence ?? record.aiProbability
  );
  const misinformationRisk = asString(record.misinformationRisk, "LOW");

  return {
    visibleText: asString(record.visibleText),
    publicFigures: asStringArray(record.publicFigures),
    publicFigureConfidence: asNumber(record.publicFigureConfidence),
    appearsAIGenerated:
      asBoolean(record.appearsAIGenerated) || aiConfidence >= 0.6,
    aiConfidence,
    syntheticMediaConfidence: aiConfidence,
    politicalContext: asBoolean(record.politicalContext),
    politicalContextConfidence: asNumber(record.politicalContextConfidence),
    possibleKnownManipulation: asBoolean(record.possibleKnownManipulation),
    misinformationRisk:
      misinformationRisk === "MEDIUM" ||
      misinformationRisk === "HIGH" ||
      misinformationRisk === "CRITICAL"
        ? misinformationRisk
        : "LOW",
    reasoning: asString(record.reasoning),
  };
}

export async function extractImageText(
  imageBuffer: Buffer
): Promise<VisionAnalysisResult> {
  try {
    const base64Image = imageBuffer.toString("base64");

    const celebrityMatches = await detectCelebrities(imageBuffer);

    console.log("[analyze] OpenAI key configured:", Boolean(process.env.OPENAI_API_KEY));
    console.log("[analyze] classifier path:", "openai-vision-gpt-4.1");
    console.log("[analyze] AWS celebrity matches:", celebrityMatches);

    // Feedback loop: recent moderator decisions, rendered as text-only few-shot
    // calibration examples. Non-fatal and cached; empty string when unavailable.
    const feedbackSection = formatModeratorExamples(
      await getRecentModeratorExamples()
    );

    const response = await getClient().chat.completions.create({
      model: "gpt-4.1",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a high-precision multimodal political disinformation analysis system used by a Trust & Safety moderation team. Analyze images conservatively but thoroughly. Detect manipulated political media, likely public figures, synthetic-image artifacts, propaganda framing, election-related context, and misinformation risk. Return only valid JSON.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Potential celebrity/public-figure matches from an external face-recognition system:
${JSON.stringify(celebrityMatches)}

Use these candidate matches as additional evidence, but verify visually before concluding identities.

${feedbackSection ? `${feedbackSection}\n\n` : ""}Return STRICT JSON with this schema:
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

Rules:
- Do not invent identities, but do not over-abstain when the image strongly resembles a major public figure.
- The image may be a cropped, compressed, or meme-style manipulated depiction of a politician or public figure.
- If the image resembles a politician or public figure in a way that would matter for moderation, include the most likely identity in publicFigures and explain uncertainty in reasoning.
- Use publicFigureConfidence for confidence in the identity match only.
- Use syntheticMediaConfidence for confidence that the image is AI-generated or digitally manipulated only.
- Use politicalContextConfidence for confidence that the content is politically relevant only.
- possibleKnownManipulation should be true if the image appears to match a known genre of political deepfake, fake endorsement, fake scandal, fake intimacy, fake arrest, fake speech, or fake campaign material.
- visibleText should contain OCR-style extracted text.
- All confidence fields must be between 0 and 1.
- politicalContext should be true if political figures, political messaging, campaigns, governments, elections, protests, geopolitical narratives, or public-office-related reputational attacks are plausibly involved.
- misinformationRisk should reflect moderation risk, not just whether the image is AI-generated.
- reasoning should be detailed but concise.
- Return ONLY JSON.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "{}";

    console.log("[analyze] raw OpenAI classification JSON:", content);

    const parsed = JSON.parse(content) as unknown;
    const normalized = normalizeVisionAnalysis(parsed);

    console.log("[analyze] normalized vision analysis:", normalized);

    return normalized;
  } catch (error) {
    console.error("OpenAI Vision analysis failed:", error);

    throw error;
  }
}
