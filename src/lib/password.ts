export const PASSWORD_MIN_LENGTH = 8

// Returns an error message when the password is too weak, or null when it
// passes. Rules: minimum length, at least one number, and at least one special
// character. Shared by the sign-up form and the sign-up API so the client and
// server enforce the same policy.
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number."
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one special character."
  }
  return null
}
