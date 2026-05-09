import { NextRequest, NextResponse } from "next/server"
import { checkC2pa, type C2paCheckResult } from "@/lib/c2pa"

// c2pa-ts uses Node-only APIs (reflect-metadata, @peculiar/x509), so this
// route must run in the Node runtime, not the Edge runtime.
export const runtime = "nodejs"
// We always want a fresh result per request — never cache.
export const dynamic = "force-dynamic"

const MAX_BYTES = 25 * 1024 * 1024 // 25MB upload ceiling

async function runCheck(bytes: Uint8Array): Promise<C2paCheckResult> {
  if (bytes.byteLength === 0) {
    return { status: "no_image", metadata: { error: "Empty payload" } }
  }
  return checkC2pa(bytes)
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? ""
  let bytes: Uint8Array

  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { url?: string }
      if (!body.url) {
        return NextResponse.json(
          { error: "Missing `url` in request body" },
          { status: 400 }
        )
      }
      const upstream = await fetch(body.url)
      if (!upstream.ok) {
        return NextResponse.json(
          { error: `Failed to fetch image (${upstream.status})` },
          { status: 400 }
        )
      }
      const buf = await upstream.arrayBuffer()
      if (buf.byteLength > MAX_BYTES) {
        return NextResponse.json(
          { error: "Image too large" },
          { status: 413 }
        )
      }
      bytes = new Uint8Array(buf)
    } else {
      // Treat anything else as raw binary upload.
      const buf = await req.arrayBuffer()
      if (buf.byteLength > MAX_BYTES) {
        return NextResponse.json(
          { error: "Image too large" },
          { status: 413 }
        )
      }
      bytes = new Uint8Array(buf)
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 }
    )
  }

  const result = await runCheck(bytes)
  return NextResponse.json(result)
}
