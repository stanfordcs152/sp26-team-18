"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, PlusSquare, ToggleRight } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/upload", label: "Upload", icon: PlusSquare },
  { href: "/moderation", label: "Mode", icon: ToggleRight },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-20 flex-col items-center gap-1 rounded-md px-2 py-1 text-xs",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
