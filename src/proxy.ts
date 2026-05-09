// Next.js 16 renamed `middleware` to `proxy`. This file gates the
// `/moderation/*` routes behind the shared-password session cookie.
//
// Only the UI is gated — the underlying server actions (`resolveReport`,
// inserts, etc.) are still callable via Supabase auth/RLS. That's the same
// posture the rest of the demo uses; per-moderator auth is an explicit
// follow-up.

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  MODERATOR_COOKIE,
  verifySession,
} from "@/lib/moderator-session"

export const config = {
  matcher: ["/moderation/:path*"],
}

export async function proxy(request: NextRequest) {
  const secret = process.env.MODERATOR_SESSION_SECRET
  if (!secret) {
    // Without a secret we can't verify cookies safely, so refuse access
    // rather than silently letting everyone in.
    const url = new URL("/moderator-login", request.url)
    url.searchParams.set("error", "unconfigured")
    url.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  const token = request.cookies.get(MODERATOR_COOKIE)?.value
  const { valid } = await verifySession(secret, token)
  if (valid) {
    return NextResponse.next()
  }

  const url = new URL("/moderator-login", request.url)
  url.searchParams.set("redirect", request.nextUrl.pathname)
  return NextResponse.redirect(url)
}
