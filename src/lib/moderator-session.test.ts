import { describe, expect, it } from "vitest"
import {
  signSession,
  verifySession,
  SESSION_TTL_MS,
} from "./moderator-session"

const SECRET = "test-secret-do-not-use-in-prod"

describe("moderator session", () => {
  it("verifies a freshly-signed token", async () => {
    const expiry = Date.now() + SESSION_TTL_MS
    const token = await signSession(SECRET, expiry)
    const result = await verifySession(SECRET, token)
    expect(result).toEqual({ valid: true, expired: false })
  })

  it("rejects an expired token", async () => {
    const past = Date.now() - 1000
    const token = await signSession(SECRET, past)
    const result = await verifySession(SECRET, token)
    expect(result.valid).toBe(false)
    expect(result.expired).toBe(true)
  })

  it("rejects a token signed with a different secret", async () => {
    const expiry = Date.now() + SESSION_TTL_MS
    const token = await signSession("other-secret", expiry)
    const result = await verifySession(SECRET, token)
    expect(result.valid).toBe(false)
    expect(result.expired).toBe(false)
  })

  it("rejects a tampered expiry", async () => {
    const expiry = Date.now() + SESSION_TTL_MS
    const token = await signSession(SECRET, expiry)
    const dot = token.indexOf(".")
    const tampered = `${expiry + 60_000}.${token.slice(dot + 1)}`
    const result = await verifySession(SECRET, tampered)
    expect(result.valid).toBe(false)
  })

  it("rejects malformed tokens", async () => {
    const cases = [undefined, null, "", "abc", "abc.def", ".abc", "123."]
    for (const c of cases) {
      const result = await verifySession(SECRET, c)
      expect(result.valid).toBe(false)
    }
  })
})
