import type { ModerationDecision, ModerationStatus, PostStatus } from "./types"

function moderationStatusForAction(action: ModerationDecision): ModerationStatus {
  return action
}

function postStatusForAction(action: ModerationDecision): PostStatus {
  return action === "escalated"
    ? "labeled"
    : action === "removed"
      ? "removed"
      : "visible"
}

export function buildPostModerationUpdate(
  action: ModerationDecision,
  now: string,
  note: string,
  reviewedBy: string
) {
  return {
    status: postStatusForAction(action),
    moderation_status: moderationStatusForAction(action),
    moderator_note: note,
    is_flagged: action === "escalated",
    reviewed_at: now,
    reviewed_by: reviewedBy,
    removed_at: action === "removed" ? now : null,
    approved_at: action === "approved" ? now : null,
    escalated_at: action === "escalated" ? now : null,
  }
}
