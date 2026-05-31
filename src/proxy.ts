// Next.js renamed `middleware` to `proxy`. This file gates the `/moderation/*`
// routes. When Supabase is configured it requires a moderator session cookie;
// the real role check happens in the moderation layout (a Server Component) and
// the database enforces access via RLS. With no Supabase configured it falls
// through to open mock-data dev mode.
//
// Per the auth guide, this is an optimistic check only: cookie presence, no DB
// lookups, Edge-runtime-safe imports. It's a coarse gate, not the boundary.

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { MODERATOR_COOKIE } from "@/lib/moderator-cookie"

export const config = {
  matcher: ["/moderation/:path*"],
}

export function proxy(request: NextRequest) {
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // No Supabase backend to authenticate against — run in open dev mode on mock
  // data rather than locking the dashboard out entirely.
  if (!supabaseConfigured) {
    return NextResponse.next()
  }

  const token = request.cookies.get(MODERATOR_COOKIE)?.value
  if (token) {
    return NextResponse.next()
  }

  const url = new URL("/moderator-login", request.url)
  url.searchParams.set("redirect", request.nextUrl.pathname)
  return NextResponse.redirect(url)
}
