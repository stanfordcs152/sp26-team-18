// Name of the cookie holding the signed-in moderator's Supabase access token.
// Kept in its own dependency-free module so the Edge proxy can import it
// without pulling in Node-only code (next/headers, supabase-js).
export const MODERATOR_COOKIE = "mod_session"
