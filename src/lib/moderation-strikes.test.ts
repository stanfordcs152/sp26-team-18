import { describe, expect, it } from "vitest"
import {
  STRIKE_LIMIT,
  countRemovedByAuthor,
  isRepeatOffender,
  normalizeUsername,
} from "./moderation-strikes"

describe("normalizeUsername", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeUsername("  alice ")).toBe("alice")
  })

  it("falls back to unknown_user for blank / nullish input", () => {
    expect(normalizeUsername("   ")).toBe("unknown_user")
    expect(normalizeUsername("")).toBe("unknown_user")
    expect(normalizeUsername(null)).toBe("unknown_user")
    expect(normalizeUsername(undefined)).toBe("unknown_user")
  })
})

describe("isRepeatOffender", () => {
  it("is false below the strike limit", () => {
    expect(isRepeatOffender(0)).toBe(false)
    expect(isRepeatOffender(STRIKE_LIMIT - 1)).toBe(false)
  })

  it("is true at or above the strike limit", () => {
    expect(isRepeatOffender(STRIKE_LIMIT)).toBe(true)
    expect(isRepeatOffender(STRIKE_LIMIT + 5)).toBe(true)
  })

  it("treats null / undefined as zero strikes", () => {
    expect(isRepeatOffender(null)).toBe(false)
    expect(isRepeatOffender(undefined)).toBe(false)
  })
})

describe("countRemovedByAuthor", () => {
  it("counts only removed posts, grouped by normalized author", () => {
    const counts = countRemovedByAuthor([
      { username: "alice", status: "removed" },
      { username: " alice ", status: "removed" },
      { username: "alice", status: "visible" },
      { username: "bob", status: "removed" },
      { username: "bob", status: "labeled" },
    ])

    expect(counts.get("alice")).toBe(2)
    expect(counts.get("bob")).toBe(1)
  })

  it("omits authors with no removed posts", () => {
    const counts = countRemovedByAuthor([
      { username: "carol", status: "visible" },
      { username: "carol", status: "labeled" },
    ])

    expect(counts.has("carol")).toBe(false)
    expect(counts.size).toBe(0)
  })

  it("buckets blank usernames under unknown_user", () => {
    const counts = countRemovedByAuthor([
      { username: null, status: "removed" },
      { username: "  ", status: "removed" },
    ])

    expect(counts.get("unknown_user")).toBe(2)
  })

  it("returns an empty map for no rows", () => {
    expect(countRemovedByAuthor([]).size).toBe(0)
  })
})
