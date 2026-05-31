// Account-age-based upload throttling.
//
// New accounts (younger than ACCOUNT_AGE_WINDOW_DAYS) may upload at most
// MAX_UPLOADS_PER_DAY times in a rolling 24h window; older accounts are
// unlimited. This keeps freshly-created accounts from flooding the moderator
// queue.
//
// DB access goes through the shared `supabase` client (src/lib/supabase.ts).
// Uploads are anonymous (there's no signed-in upload flow), so the request
// can't read the uploader's own profile under the "select own" RLS from
// migration 0006. Account age is therefore read via the account_created_at()
// SECURITY DEFINER function (migration 0007), which exposes only an account's
// creation time by username — not its email/role. When Supabase isn't
// configured the limiter is a no-op, matching the app's mock-data fallback.

import { supabase } from "@/lib/supabase"

// --- Tunables ------------------------------------------------------------
// Accounts younger than this many days are throttled; older accounts upload
// freely.
export const ACCOUNT_AGE_WINDOW_DAYS = 7
// Max uploads a throttled (new) account may make per rolling 24h window.
export const MAX_UPLOADS_PER_DAY = 5
// -------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000

export interface RateLimitResult {
  limited: boolean
  // Uploads already made in the current window (only set when the account is
  // throttled and the count was read successfully).
  count?: number
}

// Returns whether the given account has exceeded its upload allowance. Fails
// open (limited: false) whenever the account's age can't be determined or a
// query errors, so infrastructure hiccups never block legitimate uploads.
export async function checkUploadRateLimit(
  username: string
): Promise<RateLimitResult> {
  // No Supabase (mock/dev mode) → nothing to throttle against.
  if (!supabase) return { limited: false }

  const name = username.trim()
  if (!name) return { limited: false }

  // Account age. An unknown account (no matching profile) can't be aged, so
  // it isn't throttled.
  const { data: createdAt, error: ageError } = await supabase.rpc(
    "account_created_at",
    { p_username: name }
  )
  if (ageError || !createdAt) return { limited: false }

  const ageMs = Date.now() - new Date(createdAt as string).getTime()
  if (ageMs >= ACCOUNT_AGE_WINDOW_DAYS * DAY_MS) return { limited: false }

  // New account: count its uploads in the last 24h. `posts` is publicly
  // readable (migration 0005), so this works with the anon client.
  const since = new Date(Date.now() - DAY_MS).toISOString()
  const { count, error: countError } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("username", name)
    .gte("created_at", since)

  if (countError || count === null) return { limited: false }

  return { limited: count >= MAX_UPLOADS_PER_DAY, count }
}
