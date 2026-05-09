"use client"

import { BadgeCheck, FileQuestion, ShieldAlert, ShieldOff } from "lucide-react"
import { cn } from "@/lib/utils"
import type { C2paStatus } from "@/lib/types"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface C2paBadgeProps {
  status: C2paStatus
  className?: string
}

const config: Record<
  C2paStatus,
  {
    label: string
    description: string
    icon: typeof BadgeCheck
    className: string
  }
> = {
  verified: {
    label: "CR Verified",
    description:
      "Image carries a valid Content Credentials (C2PA) manifest signed by its origin.",
    icon: BadgeCheck,
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  missing: {
    label: "No CR",
    description:
      "Image has no Content Credentials manifest. Provenance can't be verified.",
    icon: ShieldOff,
    className: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  },
  invalid: {
    label: "CR Invalid",
    description:
      "A Content Credentials manifest was found but failed validation.",
    icon: ShieldAlert,
    className: "bg-red-500/10 text-red-600 border-red-500/20",
  },
  no_image: {
    label: "Unknown",
    description: "Format not recognized — Content Credentials check skipped.",
    icon: FileQuestion,
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  },
}

export function C2paBadge({ status, className }: C2paBadgeProps) {
  const c = config[status]
  const Icon = c.icon

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium cursor-help",
              c.className,
              className
            )}
          >
            <Icon className="size-3.5" />
            <span>{c.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium">{c.label}</p>
          <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
