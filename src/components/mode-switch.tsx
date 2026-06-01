"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Shield, Users } from "lucide-react"
import { cn } from "@/lib/utils"

interface ModeSwitchProps {
  compact?: boolean
}

export function ModeSwitch({ compact = false }: ModeSwitchProps) {
  const pathname = usePathname()
  const inModeratorMode = pathname.startsWith("/moderation")

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-muted/30 p-1 shadow-sm",
        compact ? "grid grid-cols-2" : "space-y-1"
      )}
      aria-label="Switch product mode"
    >
      <ModeLink
        href="/"
        active={!inModeratorMode}
        icon={Users}
        label="User Mode"
        description="Platform feed"
        compact={compact}
      />
      <ModeLink
        href="/moderation"
        active={inModeratorMode}
        icon={Shield}
        label="Moderator Mode"
        description="T&S console"
        compact={compact}
      />
    </div>
  )
}

function ModeLink({
  href,
  active,
  icon: Icon,
  label,
  description,
  compact,
}: {
  href: string
  active: boolean
  icon: typeof Shield
  label: string
  description: string
  compact: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        compact && "justify-center"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className={cn("min-w-0", compact && "text-center")}>
        <span className="block font-medium leading-tight">{label}</span>
        {!compact ? (
          <span className="block text-xs leading-tight opacity-75">
            {description}
          </span>
        ) : null}
      </span>
    </Link>
  )
}
