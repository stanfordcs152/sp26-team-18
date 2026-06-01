import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { MODERATOR_COOKIE, getSupabaseEnv } from "@/lib/moderator-auth"

// General user sign-up: creates a Supabase Auth account. The handle_new_user
// trigger (migration 0006) provisions a matching 'user' profile, using the
// supplied username (or the email local-part as a fallback). If the project has
// email confirmation enabled, no session is returned and the user must confirm
// before signing in; otherwise we set the session cookie immediately.
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
    | { email?: string; password?: string; username?: string }
    | null
  const email = body?.email?.trim()
  const password = body?.password
  const username = body?.username?.trim()

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    )
  }

  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: username ? { data: { username } } : undefined,
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Email confirmation enabled: account created but not yet usable.
  if (!data.session) {
    return NextResponse.json({ ok: true, needsConfirmation: true })
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
