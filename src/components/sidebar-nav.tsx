"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Search,
  Bell,
  Mail,
  Bookmark,
  Shield,
  PlusSquare,
  User,
  Settings,
  PenSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ModeSwitch } from "@/components/mode-switch"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/upload", label: "Upload", icon: PlusSquare },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex h-full flex-col gap-1 p-2">
      {/* Logo */}
      <Link
        href="/"
        className="mb-2 flex items-center gap-2 rounded-full px-3 py-3 text-foreground transition-colors hover:bg-muted/50"
      >
        <Shield className="size-8 text-primary" />
        <span className="text-xl font-bold hidden xl:inline">TruthGuard</span>
      </Link>

      <div className="mb-3 hidden xl:block">
        <ModeSwitch />
      </div>

      {/* Nav Items */}
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-4 rounded-full px-3 py-3 text-[17px] transition-colors",
              isActive
                ? "font-bold text-foreground"
                : "text-foreground/80 hover:bg-muted/60"
            )}
          >
            <Icon className="size-6" />
            <span className="hidden xl:inline">{item.label}</span>
          </Link>
        )
      })}

      {/* Create Post Button */}
      <Button asChild className="mt-4 hidden w-full rounded-full py-6 text-base font-bold xl:flex">
        <Link href="/upload">
        <PenSquare className="size-5 mr-2" />
        Create Post
        </Link>
      </Button>
      <Button asChild size="icon-lg" className="mt-4 rounded-full xl:hidden mx-auto">
        <Link href="/upload">
          <PenSquare className="size-5" />
        </Link>
      </Button>
    </nav>
  )
}
