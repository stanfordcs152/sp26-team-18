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
}

// Moderator-specific types
export type ModerationAction = "approve" | "remove" | "escalate" | "pending"

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
