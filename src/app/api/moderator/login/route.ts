import { NextResponse } from "next/server"
import {
  MODERATOR_COOKIE,
  SESSION_TTL_MS,
  signSession,
} from "@/lib/moderator-session"

// Constant-time string compare so a wrong password doesn't leak length / prefix
// info via timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export async function POST(request: Request) {
  const password = process.env.MODERATOR_PASSWORD
  const secret = process.env.MODERATOR_SESSION_SECRET

  if (!password || !secret) {
    return NextResponse.json(
      {
        error:
          "Moderator gate not configured. Set MODERATOR_PASSWORD and MODERATOR_SESSION_SECRET.",
      },
      { status: 500 }
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { password?: string }
    | null
  const submitted = body?.password ?? ""

  if (!timingSafeEqual(submitted, password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 })
  }

  const expiry = Date.now() + SESSION_TTL_MS
  const token = await signSession(secret, expiry)

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: MODERATOR_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })
  return response
}
