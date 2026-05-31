import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { runAnalysisPipeline } from "@/lib/analyzers/pipeline";
import { supabase } from "@/lib/supabase";

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

    // SHA-256 of the raw image bytes, used to dedupe identical uploads.
    const imageHash = createHash("sha256").update(imageBuffer).digest("hex");

    // Reuse a previously stored analysis for a byte-identical image instead of
    // re-running the OpenAI/AWS pipeline.
    if (supabase) {
      const { data: cached } = await supabase
        .from("posts")
        .select("analysis")
        .eq("image_hash", imageHash)
        .not("analysis", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached?.analysis) {
        return NextResponse.json({
          success: true,
          analysis: cached.analysis,
          imageHash,
          cached: true,
        });
      }
    }

    const analysis = await runAnalysisPipeline(imageBuffer);

    return NextResponse.json({
      success: true,
      analysis,
      imageHash,
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
