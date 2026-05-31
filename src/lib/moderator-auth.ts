// Server-side helpers for the Supabase-backed moderator session.
//
// Login (src/app/api/moderator/login) authenticates against Supabase Auth and
// stores the user's access token in MODERATOR_COOKIE. These helpers turn that
// cookie back into a Supabase client that acts as the signed-in moderator, so
// row-level security (migration 0006) applies to every read/write.

import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { MODERATOR_COOKIE } from "@/lib/moderator-cookie"

export { MODERATOR_COOKIE }

export type ModeratorRole = "admin" | "moderator" | "user"

export interface ModeratorProfile {
  id: string
  username: string
  email: string | null
  role: ModeratorRole
}

// Supabase URL + anon key, or null when Supabase isn't configured (the app then
// falls back to mock data / open dev mode, per the project constraints).
export function getSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return url && anonKey ? { url, anonKey } : null
}

// A Supabase client that makes PostgREST requests as the user identified by
// `token`, so RLS sees their auth.uid(). Return type is inferred from
// createClient so query-result narrowing matches a plain createClient() call.
export function createAuthedClient(token: string) {
  const env = getSupabaseEnv()
  if (!env) return null
  return createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// An authenticated Supabase client built from the session cookie, or null when
// there's no session / Supabase isn't configured.
export async function getModeratorClient() {
  const store = await cookies()
  const token = store.get(MODERATOR_COOKIE)?.value
  if (!token) return null
  return createAuthedClient(token)
}

// Resolves the signed-in moderator's profile from the session cookie, or null
// when there's no valid session. The read goes through RLS ("select own"), so a
// missing, expired, or forged token yields null.
export async function getModeratorProfile(): Promise<ModeratorProfile | null> {
  const client = await getModeratorClient()
  if (!client) return null

  const { data, error } = await client
    .from("profiles")
    .select("id, username, email, role")
    .single()

  if (error || !data) return null
  return data as ModeratorProfile
}

export function isModeratorRole(
  role: ModeratorRole | null | undefined
): boolean {
  return role === "moderator" || role === "admin"
}
