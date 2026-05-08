import { SidebarNav } from "@/components/sidebar-nav"
import { Feed } from "@/components/feed"
import { TrendingSidebar } from "@/components/trending-sidebar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl">
        {/* Left Sidebar - Navigation */}
        <aside className="sticky top-0 hidden h-screen w-[72px] shrink-0 border-r border-border md:block xl:w-[275px]">
          <SidebarNav />
        </aside>

        {/* Main Feed */}
        <main className="max-w-[600px] flex-1 border-r border-border pb-20 md:pb-0">
          {/* Header */}
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
            <h1 className="px-4 py-3 text-xl font-bold">Home</h1>
          </header>

          {/* Feed Content */}
          <Feed />
        </main>

        {/* Right Sidebar - Trending & Alerts */}
        <aside className="sticky top-0 hidden h-screen w-[350px] shrink-0 xl:block">
          <TrendingSidebar />
        </aside>
      </div>
      <MobileBottomNav />
    </div>
  )
}
