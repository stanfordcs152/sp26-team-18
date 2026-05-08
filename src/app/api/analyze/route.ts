import { NextResponse } from "next/server";
import { runAnalysisPipeline } from "@/lib/analyzers/pipeline";

export async function POST() {
  try {
    const analysis = await runAnalysisPipeline();

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