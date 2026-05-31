import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  MODERATOR_COOKIE,
  getSupabaseEnv,
  isModeratorRole,
  type ModeratorRole,
} from "@/lib/moderator-auth"

// Authenticates a moderator against Supabase Auth and, if their profile role is
// moderator/admin, stores the access token in an httpOnly session cookie. The
// moderation UI and RLS both key off that token.
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

  // signInWithPassword set the session on this client, so the profiles read
  // runs as the new user and RLS ("select own") returns their row.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single()

  if (!profile || !isModeratorRole(profile.role as ModeratorRole)) {
    return NextResponse.json(
      { error: "This account is not authorized for moderation." },
      { status: 403 }
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
