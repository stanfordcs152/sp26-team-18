import { NextRequest, NextResponse } from "next/server";
import { runAnalysisPipeline } from "@/lib/analyzers/pipeline";
import { checkUploadRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "No image uploaded",
        },
        { status: 400 }
      );
    }

    // Throttle new accounts before doing any analysis work, so they can't
    // flood the moderator queue. The username comes from the upload form; an
    // unknown or sufficiently old account isn't limited.
    const username = (formData.get("username") as string | null)?.trim() ?? "";
    if (username) {
      const rate = await checkUploadRateLimit(username);
      if (rate.limited) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Upload limit reached. New accounts can only upload a limited number of times per day. Please try again later.",
          },
          { status: 429 }
        );
      }
    }

    const arrayBuffer = await file.arrayBuffer();

    const imageBuffer = Buffer.from(arrayBuffer);

    const analysis = await runAnalysisPipeline(imageBuffer);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Analysis pipeline failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Analysis failed",
      },
      { status: 500 }
    );
  }
}