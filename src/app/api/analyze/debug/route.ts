import { NextRequest, NextResponse } from "next/server"
import { analyzeImageBuffer } from "@/lib/analyze-image"

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const formData = await req.formData()
  const file = formData.get("image") as File | null

  if (!file) {
    return NextResponse.json({ error: "No image uploaded" }, { status: 400 })
  }

  const result = await analyzeImageBuffer(Buffer.from(await file.arrayBuffer()))

  return NextResponse.json({
    analysis: result.analysis,
    shouldFlag: result.shouldFlag,
    feedLabel: result.feedLabel,
  })
}
