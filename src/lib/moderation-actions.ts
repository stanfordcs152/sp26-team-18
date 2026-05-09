import { supabase } from "@/lib/supabase"
import type {
  PostStatus,
  ReportReason,
  ReportResolution,
} from "@/lib/types"

export interface SubmitReportInput {
  postId: string
  reporterUsername: string
  reason: ReportReason
  details?: string
}

export async function submitReport(
  input: SubmitReportInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." }
  }

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
  moderatorUsername: string
  moderatorNote: string
}

/**
 * Resolves a report and updates the corresponding post status atomically
 * (best-effort — sequential updates since we don't have an RPC). On any
 * failure, the caller should refresh the UI to reconcile state.
 *
 * Mapping:
 *   no_action -> post.status stays / becomes "visible"
 *   labeled   -> post.status = "labeled"
 *   removed   -> post.status = "removed"
 */
export async function resolveReport(
  input: ResolveReportInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." }
  }

  const newPostStatus: PostStatus =
    input.resolution === "labeled"
      ? "labeled"
      : input.resolution === "removed"
        ? "removed"
        : "visible"

  // .select() forces postgrest to return the updated rows so we can detect
  // RLS-silent failures. Without this, a missing UPDATE policy on `posts`
  // returns no error but updates 0 rows — the moderator UI thinks the post
  // was removed while the feed keeps rendering it.
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
        "Post update affected 0 rows. Apply migration 0005_posts_moderation_policy.sql so the moderator client has UPDATE permission on `posts`.",
    }
  }

  const { error: reportErr } = await supabase
    .from("reports")
    .update({
      status: "resolved",
      resolution: input.resolution,
      resolved_by: input.moderatorUsername.trim() || "moderator",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", input.reportId)

  if (reportErr) {
    return { ok: false, error: `Report update failed: ${reportErr.message}` }
  }

  return { ok: true }
}
