import { describe, expect, it } from "vitest";
import { classifyCaptionRules } from "./caption-rules";
import { visionShouldFlag } from "./vision-result";

describe("caption-rules classifier", () => {
  it("flags synthetic political content from OpenFake-style fake metadata", () => {
    const result = classifyCaptionRules(
      'model=sdxl; type=base; prompt="President at election rally protest"',
      "fake.jpg"
    );
    expect(result.appearsAIGenerated).toBe(true);
    expect(result.politicalContext).toBe(true);
    expect(visionShouldFlag(result)).toBe(true);
  });

  it("does not flag real laion political photos", () => {
    const result = classifyCaptionRules(
      'model=laion; type=image; prompt="Crowd at city park on a sunny day"',
      "real.jpg"
    );
    expect(result.appearsAIGenerated).toBe(false);
    expect(visionShouldFlag(result)).toBe(false);
  });
});
