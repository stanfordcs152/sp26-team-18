import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { MODERATOR_COOKIE, getSupabaseEnv } from "@/lib/moderator-auth"

// General user sign-in: authenticates against Supabase Auth and stores the
// access token in the shared session cookie. Unlike /api/moderator/login this
// does NOT require a moderator role — any account can sign in to the platform.
export async function POST(request: Request) {
  const env = getSupabaseEnv()
  if (!env) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 500 }
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null
  const email = body?.email?.trim()
  const password = body?.password

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    )
  }

  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error || !data.session) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    )
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: MODERATOR_COOKIE,
    value: data.session.access_token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: data.session.expires_in,
  })
  return response
}
