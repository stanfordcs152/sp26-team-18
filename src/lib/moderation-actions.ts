"use server"

import { createClient } from "@supabase/supabase-js"
import {
  getModeratorClient,
  getSupabaseEnv,
  isModeratorRole,
} from "@/lib/moderator-auth"
import type { PostStatus, ReportReason, ReportResolution } from "@/lib/types"

export interface SubmitReportInput {
  postId: string
  reporterUsername: string
  reason: ReportReason
  details?: string
}

// Public: readers (anonymous) file a report. Uses a fresh anon client; RLS still
// allows anonymous INSERT on `reports` after migration 0006.
export async function submitReport(
  input: SubmitReportInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const env = getSupabaseEnv()
  if (!env) {
    return { ok: false, error: "Supabase is not configured." }
  }

  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error } = await supabase.from("reports").insert({
    post_id: input.postId,
    reporter_username: input.reporterUsername.trim() || "anonymous",
    reason: input.reason,
    details: input.details?.trim() || null,
  })

  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export interface ResolveReportInput {
  reportId: string
  postId: string
  resolution: ReportResolution
  moderatorNote: string
}

/**
 * Resolves a report and updates the corresponding post status. Runs as the
 * signed-in moderator (via the session cookie) so the tightened RLS on `posts`
 * / `reports` permits the writes; non-moderators are rejected here and by RLS.
 * The acting moderator is taken from their profile, not from client input.
 *
 * Mapping:
 *   no_action -> post.status stays / becomes "visible"
 *   labeled   -> post.status = "labeled"
 *   removed   -> post.status = "removed"
 */
export async function resolveReport(
  input: ResolveReportInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await getModeratorClient()
  if (!supabase) {
    return {
      ok: false,
      error: "Supabase is not configured or you are not signed in.",
    }
  }

  // Treat this like a public endpoint: verify role server-side (RLS also
  // enforces) and derive the moderator identity from their profile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role")
    .single()
  if (!profile || !isModeratorRole(profile.role)) {
    return { ok: false, error: "Not authorized." }
  }
  const moderatorName: string = profile.username

  const newPostStatus: PostStatus =
    input.resolution === "labeled"
      ? "labeled"
      : input.resolution === "removed"
        ? "removed"
        : "visible"

  // .select() forces postgrest to return the updated rows so we can detect
  // RLS-silent failures. Without this, a blocked UPDATE returns no error but
  // updates 0 rows — the moderator UI thinks the post was removed while the
  // feed keeps rendering it.
  const { data: updatedPosts, error: postErr } = await supabase
    .from("posts")
    .update({
      status: newPostStatus,
      moderator_note: input.moderatorNote.trim(),
    })
    .eq("id", input.postId)
    .select("id, status")

  if (postErr) {
    return { ok: false, error: `Post update failed: ${postErr.message}` }
  }

  if (!updatedPosts || updatedPosts.length === 0) {
    return {
      ok: false,
      error:
        "Post update affected 0 rows. Your account may lack moderator permission (RLS).",
    }
  }

  const { error: reportErr } = await supabase
    .from("reports")
    .update({
      status: "resolved",
      resolution: input.resolution,
      resolved_by: moderatorName,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", input.reportId)

  if (reportErr) {
    return { ok: false, error: `Report update failed: ${reportErr.message}` }
  }

  return { ok: true }
}
