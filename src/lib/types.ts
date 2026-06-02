export type AIDetectionStatus = "authentic" | "under_review" | "likely_ai" | "confirmed_ai" | "unverified"

export type MediaType = "image" | "video"

export interface User {
  id: string
  username: string
  displayName: string
  avatarUrl: string
  verified: boolean
}

export interface AIDetectionResult {
  status: AIDetectionStatus
  confidence: number // 0-100
  flags: string[]
  analyzedAt: string
}

export interface Media {
  id: string
  type: MediaType
  url: string
  thumbnailUrl?: string
  altText?: string
  aiDetection: AIDetectionResult
}

// Phase 3: C2PA Content Credentials check status
export type C2paStatus = "verified" | "missing" | "invalid" | "no_image"

// Phase 5: AI image-classifier output (mirrors runAnalysisPipeline return type
// in src/lib/analyzers/pipeline.ts). Stored on posts.analysis as jsonb.
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export interface PostAnalysis {
  provenance: {
    verified: boolean
    present: boolean
  }
  vision: {
    visibleText: string
    publicFigures: string[]
    publicFigureConfidence: number
    appearsAIGenerated: boolean
    aiConfidence?: number
    syntheticMediaConfidence: number
    politicalContext: boolean
    politicalContextConfidence: number
    possibleKnownManipulation: boolean
    misinformationRisk: RiskLevel
    reasoning: string
  }
  ocr: {
    text: string
    hasText: boolean
    matchedKeywords: string[]
  }
  ai: {
    aiProbability: number
    model: string
    flagged: boolean
    indicators: string[]
  }
  politicians: {
    detected: string[]
    confidence: number
  }
  manipulationSignals: {
    possibleKnownManipulation: boolean
    politicalContext: boolean
    politicalContextConfidence: number
  }
  risk: {
    score: number
    level: RiskLevel
    reasons: string[]
  }
}

export interface Post {
  id: string
  author: User
  content: string
  media: Media[]
  createdAt: string
  likes: number
  comments: number
  shares: number
  isLiked: boolean
  isBookmarked: boolean
  // Phase 4: moderation state. Optional so existing mock data still type-checks.
  status?: "visible" | "labeled" | "removed"
  moderatorNote?: string | null
  // Phase 3 (retroactive): C2PA + political flag.
  c2paStatus?: C2paStatus
  isPolitical?: boolean
  // Phase 8: uploader's own "AI-generated vs authentic" declaration. Null on
  // legacy posts uploaded before migration 0010.
  selfDeclaredAi?: boolean | null
}

// Moderator-specific types
export type ModerationAction = "approve" | "remove" | "escalate" | "pending"

// Phase 4: Reports + post moderation status
export type PostStatus = "visible" | "labeled" | "removed"
export type ModerationStatus = "pending_review" | "approved" | "removed" | "escalated"
export type ModerationDecision = "approved" | "removed" | "escalated"

export type ReportReason = "ai_generated_political" | "other"
export type ReportStatus = "open" | "resolved"
export type ReportResolution = "no_action" | "labeled" | "removed"

export interface Report {
  id: string
  postId: string
  reporterUsername: string
  reason: ReportReason
  details: string | null
  status: ReportStatus
  resolution: ReportResolution | null
  resolvedBy: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface ReportWithPost extends Report {
  post: Post
  postStatus: PostStatus
}

export interface ModerationQueueItem {
  id: string
  post: Post
  flaggedAt: string
  priority: "low" | "medium" | "high" | "critical"
  reportCount: number
  reportReasons: string[]
  assignedTo?: string
  status: ModerationAction
  notes?: string
}

export interface ModerationStats {
  pending: number
  highRisk?: number | null
  critical?: number | null
  reviewedToday: number
  removedToday: number
  escalated: number
  avgReviewTime: string
  flagsToday?: number | null
  flagsThisWeek?: number | null
  approvalsToday?: number | null
  escalationsToday?: number | null
}

export interface ModerationActionRecord {
  id: string
  postId: string
  username: string
  action: ModerationDecision
  moderator: string
  note: string | null
  postCaption: string | null
  createdAt: string
}

export interface UserModerationHistory {
  username: string
  totalFlagged: number
  totalRemoved: number
  totalApproved: number
  totalEscalated: number
  mostRecentAction: ModerationActionRecord | null
  recentActions: ModerationActionRecord[]
}

// Phase 6: a single post in the live moderation queue, grouping every open
// report against it. Built server-side in moderation-queue-data.ts and rendered
// by ModerationCardLive.
export interface LiveQueueItem {
  groupKey: string // post id
  post: Post
  postStatus: PostStatus
  reports: {
    id: string
    reason: ReportReason
    details: string | null
    reporterUsername: string
    createdAt: string
  }[]
  newestReportAt: string
  oldestReportAt: string
  // Phase 5: AI image-classifier result, persisted on `posts.analysis`.
  // Null on legacy posts uploaded before migration 0004.
  analysis: PostAnalysis | null
  riskScore: number | null
  riskLevel: RiskLevel | null
  isFlagged: boolean
  // Phase 8: the uploader's own AI/authentic self-label (migration 0010).
  selfDeclaredAi?: boolean | null
  // Three-strikes signal: how many of this author's posts a moderator has
  // removed across the whole platform. Populated server-side for the live
  // queue; advisory only (does not block uploads).
  authorRemovedCount?: number
  confidenceScore: number | null
  moderationStatus: ModerationStatus | null
  reviewedAt: string | null
  reviewedBy: string | null
  removedAt: string | null
  approvedAt?: string | null
  escalatedAt?: string | null
  userHistory?: UserModerationHistory | null
}

// Top-level counters shown on the moderation dashboard tiles.
export interface DashboardCounters {
  pending: number
  highRisk: number
  approvedToday: number
  escalated: number
  critical?: number
  flagsToday?: number | null
  flagsThisWeek?: number | null
  removalsToday?: number | null
  escalationsToday?: number | null
}

// Everything the dashboard needs from one server-side queue load.
export interface ModerationQueueData {
  items: LiveQueueItem[]
  allItems?: LiveQueueItem[]
  stats: ModerationStats
  counters: DashboardCounters
}
