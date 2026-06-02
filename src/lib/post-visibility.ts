// Friends-only quarantine window for high-risk posts.
//
// When a post is flagged high-risk (synthetic-media signals at/above the AI
// flag threshold), we limit its reach right after it's posted: only the author
// and the author's friends (mutual follows) can see it. Once the window
// elapses, the post becomes visible in the feed like any other post. This
// slows the early spread of potential deepfakes while they're freshest.
//
// ┌──────────────────────────────────────────────────────────────────────┐
// │ TUNING: change how long high-risk posts stay friends-only by editing  │
// │ HIGH_RISK_FRIENDS_ONLY_WINDOW_MS below (currently 24 hours).          │
// └──────────────────────────────────────────────────────────────────────┘
export const HIGH_RISK_FRIENDS_ONLY_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

// True when a high-risk post should be hidden from this viewer because it's
// still inside the friends-only window. The author and the author's friends
// are never blocked; non-high-risk posts are never blocked.
export function isHighRiskLockedForViewer(args: {
  isHighRisk: boolean
  createdAt: string
  isAuthor: boolean
  isFriendOfAuthor: boolean
  now?: number
}): boolean {
  const { isHighRisk, createdAt, isAuthor, isFriendOfAuthor } = args
  if (!isHighRisk) return false
  if (isAuthor || isFriendOfAuthor) return false
  const ageMs = (args.now ?? Date.now()) - new Date(createdAt).getTime()
  return ageMs < HIGH_RISK_FRIENDS_ONLY_WINDOW_MS
}
