import OpenAI from "openai";
import { detectCelebrities } from "./celebrity";

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
  syntheticMediaConfidence: number;
  politicalContext: boolean;
  politicalContextConfidence: number;
  possibleKnownManipulation: boolean;
  misinformationRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasoning: string;
};

export async function extractImageText(
  imageBuffer: Buffer
): Promise<VisionAnalysisResult> {
  try {
    const base64Image = imageBuffer.toString("base64");

    const celebrityMatches = await detectCelebrities(imageBuffer);

    console.log("AWS CELEBRITY MATCHES:", celebrityMatches);

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

Return STRICT JSON with this schema:
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

    const parsed = JSON.parse(content) as VisionAnalysisResult;

    return parsed;
  } catch (error) {
    console.error("OpenAI Vision analysis failed:", error);

    throw error;
  }
}