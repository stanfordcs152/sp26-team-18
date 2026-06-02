"use client"

import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AIDetectionStatus } from "@/lib/types"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AIDetectionBadgeProps {
  status: AIDetectionStatus
  confidence: number
  flags?: string[]
  className?: string
}

const statusConfig: Record<
  AIDetectionStatus,
  {
    label: string
    description: string
    icon: typeof Shield
    className: string
  }
> = {
  authentic: {
    label: "Authentic",
    description: "Content verified as authentic",
    icon: ShieldCheck,
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  unverified: {
    label: "Unverified",
    description: "Authenticity has not been verified",
    icon: ShieldQuestion,
    className: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  },
  under_review: {
    label: "Under Review",
    description: "Content is being analyzed",
    icon: ShieldQuestion,
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  likely_ai: {
    label: "Likely AI",
    description: "Content shows signs of AI generation",
    icon: ShieldAlert,
    className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  },
  confirmed_ai: {
    label: "Confirmed AI",
    description: "Content confirmed as AI-generated",
    icon: ShieldAlert,
    className: "bg-red-500/10 text-red-600 border-red-500/20",
  },
}

export function AIDetectionBadge({
  status,
  confidence,
  flags = [],
  className,
}: AIDetectionBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium cursor-help",
              config.className,
              className
            )}
          >
            <Icon className="size-3.5" />
            <span>{config.label}</span>
            <span className="text-[10px] opacity-70">{confidence}%</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">{config.description}</p>
            <p className="text-xs text-muted-foreground">
              Confidence: {confidence}%
            </p>
            {flags.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Detection flags:</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {flags.map((flag, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <span className="size-1 rounded-full bg-current" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
