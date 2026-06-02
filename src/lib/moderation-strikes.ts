// Three-strikes signal (advisory, moderator-facing).
//
// Counts how many of an author's posts have already been removed platform-wide
// and flags authors at/over the threshold as "repeat offenders". This only
// surfaces a warning in the moderator console — it never blocks uploads.

import type { PostStatus } from "@/lib/types"

// An author reaches "repeat offender" status once moderators have removed at
// least this many of their posts.
export const STRIKE_LIMIT = 3

export function normalizeUsername(username: string | null | undefined): string {
  return username?.trim() || "unknown_user"
}

export function isRepeatOffender(removedCount: number | null | undefined): boolean {
  return (removedCount ?? 0) >= STRIKE_LIMIT
}

// Tallies removed posts per (normalized) author from a flat list of post rows.
export function countRemovedByAuthor(
  rows: { username: string | null; status: PostStatus | null }[]
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.status === "removed") {
      const author = normalizeUsername(row.username)
      counts.set(author, (counts.get(author) ?? 0) + 1)
    }
  }
  return counts
}
