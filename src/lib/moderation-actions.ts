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

export interface ResolvePostModerationInput {
  postId: string
  resolution: ReportResolution
  moderatorNote: string
}

type ModerationActionResult =
  | { ok: true; persisted: boolean; warning?: string }
  | { ok: false; error: string }

async function getModerationWriteClient() {
  const moderatorClient = await getModeratorClient()
  if (moderatorClient) {
    return { client: moderatorClient, resolvedBy: "moderator" }
  }

  const env = getSupabaseEnv()
  if (!env) return null

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY

  return {
    client: createClient(env.url, serviceRoleKey ?? env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    resolvedBy: serviceRoleKey ? "demo_moderator" : "demo_moderator_unpersisted",
  }
}

function postStatusForResolution(resolution: ReportResolution): PostStatus {
  return resolution === "labeled"
    ? "labeled"
    : resolution === "removed"
      ? "removed"
      : "visible"
}

async function updatePostModerationStatus(
  input: ResolvePostModerationInput
): Promise<ModerationActionResult> {
  const writeClient = await getModerationWriteClient()
  if (!writeClient) {
    return { ok: false, error: "Supabase is not configured." }
  }

  const newPostStatus = postStatusForResolution(input.resolution)

  // TODO: replace moderator_note-as-reviewed-marker with a dedicated
  // reviewed_at / reviewed_by column if the schema adds one. That would let an
  // approved high-risk post stay visible without re-entering the review queue.
  const { data: updatedPosts, error: postErr } = await writeClient.client
    .from("posts")
    .update({
      status: newPostStatus,
      moderator_note: input.moderatorNote.trim(),
      is_flagged: false,
    })
    .eq("id", input.postId)
    .select("id, status")

  if (postErr || !updatedPosts || updatedPosts.length === 0) {
    return {
      ok: true,
      persisted: false,
      warning:
        "Decision recorded for this session only. Supabase RLS blocked anonymous moderation writes; add SUPABASE_SERVICE_ROLE_KEY or sign in as a moderator to persist decisions.",
    }
  }

  const { error: reportErr } = await writeClient.client
    .from("reports")
    .update({
      status: "resolved",
      resolution: input.resolution,
      resolved_by: writeClient.resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq("post_id", input.postId)
    .eq("status", "open")

  return {
    ok: true,
    persisted: true,
    warning: reportErr
      ? "Post decision saved. Matching reports could not be resolved, likely because report RLS is restricted."
      : undefined,
  }
}

export async function resolvePostModeration(
  input: ResolvePostModerationInput
): Promise<ModerationActionResult> {
  return updatePostModerationStatus(input)
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
