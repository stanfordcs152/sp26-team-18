// Tiny HMAC-signed session cookie for the shared-password moderator gate.
//
// Token format: `<expiryMs>.<hexHmac>` where the HMAC is over the literal
// string of `expiryMs` using the server-side secret. There's no payload — the
// secret is shared by all moderators by design (we picked the simplest gate
// that still resists trivial cookie forgery). Real per-moderator auth would
// move to Supabase Auth or NextAuth, but that's intentionally out of scope.
//
// Uses Web Crypto so the module runs unchanged in both Node route handlers
// and the Proxy runtime.

export const MODERATOR_COOKIE = "mod_session"
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

const encoder = new TextEncoder()

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  )
}

function bytesToHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let out = ""
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, "0")
  }
  return out
}

function hexToBytes(hex: string): ArrayBuffer {
  if (hex.length % 2 !== 0) return new ArrayBuffer(0)
  const buf = new ArrayBuffer(hex.length / 2)
  const view = new Uint8Array(buf)
  for (let i = 0; i < view.length; i++) {
    view[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return buf
}

export async function signSession(
  secret: string,
  expiryMs: number
): Promise<string> {
  const key = await importKey(secret)
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(String(expiryMs))
  )
  return `${expiryMs}.${bytesToHex(sig)}`
}

export interface VerifyResult {
  valid: boolean
  expired: boolean
}

export async function verifySession(
  secret: string,
  token: string | undefined | null,
  now: number = Date.now()
): Promise<VerifyResult> {
  if (!token) return { valid: false, expired: false }
  const dot = token.indexOf(".")
  if (dot <= 0) return { valid: false, expired: false }
  const expiryRaw = token.slice(0, dot)
  const sigHex = token.slice(dot + 1)
  const expiryMs = Number(expiryRaw)
  if (!Number.isFinite(expiryMs)) return { valid: false, expired: false }

  const key = await importKey(secret)
  const sigBytes = hexToBytes(sigHex)
  if (sigBytes.byteLength === 0) return { valid: false, expired: false }
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    encoder.encode(expiryRaw)
  )
  if (!ok) return { valid: false, expired: false }
  if (expiryMs <= now) return { valid: false, expired: true }
  return { valid: true, expired: false }
}
