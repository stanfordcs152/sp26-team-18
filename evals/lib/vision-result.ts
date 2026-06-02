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

export function visionShouldFlag(vision: VisionAnalysisResult): boolean {
  if (vision.misinformationRisk === "HIGH" || vision.misinformationRisk === "CRITICAL") {
    return true;
  }
  return (
    vision.appearsAIGenerated &&
    vision.politicalContext &&
    vision.publicFigures.length > 0
  );
}

/** Pull OpenFake caption from manifest notes (prompt="..."). */
export function extractCaptionFromNotes(notes?: string, filename?: string): string {
  if (notes) {
    const match = notes.match(/prompt="([^"]*)"/);
    if (match?.[1]) return match[1];
  }
  return [notes ?? "", filename ?? ""].filter(Boolean).join(" ");
}
