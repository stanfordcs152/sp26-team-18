import { NextRequest, NextResponse } from "next/server";
import { runAnalysisPipeline } from "@/lib/analyzers/pipeline";

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