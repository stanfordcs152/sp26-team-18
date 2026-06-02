"use server"

import { createClient } from "@supabase/supabase-js"
import {
  getModeratorClient,
  getSupabaseEnv,
  isModeratorRole,
} from "@/lib/moderator-auth"
import { buildPostModerationUpdate } from "@/lib/moderation-action-payload"
import type {
  ModerationActionRecord,
  ModerationDecision,
  ModerationStatus,
  PostStatus,
  ReportReason,
  ReportResolution,
  RiskLevel,
} from "@/lib/types"

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
  action?: ModerationDecision
  resolution?: ReportResolution
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

function actionForInput(input: ResolvePostModerationInput): ModerationDecision {
  if (input.action) return input.action
  return input.resolution === "removed"
    ? "removed"
    : input.resolution === "labeled"
      ? "escalated"
      : "approved"
}

function moderationStatusForAction(action: ModerationDecision): ModerationStatus {
  return action
}

function reportResolutionForAction(action: ModerationDecision): ReportResolution {
  return action === "removed" ? "removed" : action === "escalated" ? "labeled" : "no_action"
}

function postStatusForAction(action: ModerationDecision): PostStatus {
  return action === "escalated"
    ? "labeled"
    : action === "removed"
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

  const action = actionForInput(input)
  const now = new Date().toISOString()
  const newPostStatus = postStatusForAction(action)
  const newModerationStatus = moderationStatusForAction(action)
  const newReportResolution = reportResolutionForAction(action)
  const note = input.moderatorNote.trim()

  const { data: currentPost } = await writeClient.client
    .from("posts")
    .select("id, username, caption, moderation_status, risk_level, risk_score")
    .eq("id", input.postId)
    .maybeSingle()

  const { data: updatedPosts, error: postErr } = await writeClient.client
    .from("posts")
    .update(buildPostModerationUpdate(action, now, note, writeClient.resolvedBy))
    .eq("id", input.postId)
    .select("id, status, moderation_status")

  if (postErr || !updatedPosts || updatedPosts.length === 0) {
    const legacy = await writeClient.client
      .from("posts")
      .update({
        status: newPostStatus,
        moderator_note: note,
        is_flagged: action === "escalated",
      })
      .eq("id", input.postId)
      .select("id, status")

    if (legacy.error || !legacy.data || legacy.data.length === 0) {
      return {
        ok: false,
        error:
          postErr?.message ??
          legacy.error?.message ??
          "Post update affected 0 rows. Check moderation RLS policies.",
      }
    }

    return {
      ok: true,
      persisted: true,
      warning:
        "Decision saved using legacy post status fields. Apply migration 0009 to enable moderation_actions history.",
    }
  }

  const postRow = currentPost as
    | {
        username?: string | null
        caption?: string | null
        moderation_status?: string | null
        risk_level?: RiskLevel | null
        risk_score?: number | null
      }
    | null

  const { error: actionErr } = await writeClient.client
    .from("moderation_actions")
    .insert({
      post_id: input.postId,
      username: postRow?.username?.trim() || "unknown_user",
      action,
      moderator: writeClient.resolvedBy,
      note: note || null,
      post_caption: postRow?.caption ?? null,
      previous_status: postRow?.moderation_status ?? null,
      new_status: newModerationStatus,
      risk_level: postRow?.risk_level ?? null,
      risk_score: postRow?.risk_score ?? null,
    })

  const { error: reportErr } = await writeClient.client
    .from("reports")
    .update({
      status: "resolved",
      resolution: newReportResolution,
      resolved_by: writeClient.resolvedBy,
      resolved_at: now,
    })
    .eq("post_id", input.postId)
    .eq("status", "open")

  return {
    ok: true,
    persisted: true,
    warning: actionErr
      ? "Post decision saved, but moderation_actions history could not be written. Apply migration 0009."
      : reportErr
        ? "Post decision saved. Matching reports could not be resolved, likely because report RLS is restricted."
        : undefined,
  }
}

export async function resolvePostModeration(
  input: ResolvePostModerationInput
): Promise<ModerationActionResult> {
  return updatePostModerationStatus(input)
}

export async function exportRecentModerationExamples(limit = 50): Promise<
  | { ok: true; examples: ModerationActionRecord[] }
  | { ok: false; error: string }
> {
  const writeClient = await getModerationWriteClient()
  if (!writeClient) {
    return { ok: false, error: "Supabase is not configured." }
  }

  const { data, error } = await writeClient.client
    .from("moderation_actions")
    .select("id, post_id, username, action, moderator, note, post_caption, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    return { ok: false, error: error.message }
  }

  return {
    ok: true,
    examples: (data ?? []).map((row) => ({
      id: String(row.id),
      postId: String(row.post_id),
      username: String(row.username),
      action: row.action as ModerationDecision,
      moderator: String(row.moderator),
      note: typeof row.note === "string" ? row.note : null,
      postCaption: typeof row.post_caption === "string" ? row.post_caption : null,
      createdAt: String(row.created_at),
    })),
  }
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
