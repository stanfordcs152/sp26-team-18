export type AIDetectionStatus = "authentic" | "under_review" | "likely_ai" | "confirmed_ai"

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
}

// Moderator-specific types
export type ModerationAction = "approve" | "remove" | "escalate" | "pending"

// Phase 4: Reports + post moderation status
export type PostStatus = "visible" | "labeled" | "removed"

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
  reviewedToday: number
  removedToday: number
  escalated: number
  avgReviewTime: string
}
