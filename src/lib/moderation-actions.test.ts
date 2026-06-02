import { describe, expect, it } from "vitest"
import { buildPostModerationUpdate } from "./moderation-action-payload"

describe("buildPostModerationUpdate", () => {
  const now = "2026-06-02T12:00:00.000Z"

  it("builds the approve payload", () => {
    expect(buildPostModerationUpdate("approved", now, "ok", "demo-moderator")).toMatchObject({
      status: "visible",
      moderation_status: "approved",
      is_flagged: false,
      reviewed_at: now,
      reviewed_by: "demo-moderator",
      approved_at: now,
      removed_at: null,
      escalated_at: null,
    })
  })

  it("builds the remove payload", () => {
    expect(buildPostModerationUpdate("removed", now, "remove", "demo-moderator")).toMatchObject({
      status: "removed",
      moderation_status: "removed",
      is_flagged: false,
      reviewed_at: now,
      removed_at: now,
      approved_at: null,
      escalated_at: null,
    })
  })

  it("builds the escalate payload", () => {
    expect(
      buildPostModerationUpdate("escalated", now, "escalate", "demo-moderator")
    ).toMatchObject({
      status: "labeled",
      moderation_status: "escalated",
      is_flagged: true,
      reviewed_at: now,
      removed_at: null,
      approved_at: null,
      escalated_at: now,
    })
  })
})
