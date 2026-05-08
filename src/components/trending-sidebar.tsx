import { Search, ShieldAlert, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const trendingTopics = [
  { topic: "Election Updates", posts: "12.4K", category: "Politics" },
  { topic: "Climate Summit", posts: "8.2K", category: "Environment" },
  { topic: "Tech Conference", posts: "5.1K", category: "Technology" },
  { topic: "Sports Finals", posts: "15.7K", category: "Sports" },
]

const flaggedAlerts = [
  {
    title: "Viral video flagged",
    description: "A video claiming to show political speech has been flagged by AI detection",
    time: "2h ago",
  },
  {
    title: "Image manipulation detected",
    description: "Multiple reports of doctored images circulating",
    time: "4h ago",
  },
]

export function TrendingSidebar() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search"
          className="pl-10 rounded-full bg-accent/50 border-0 focus-visible:ring-1"
        />
      </div>

      {/* AI Detection Alerts */}
      <Card className="bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="size-5 text-amber-500" />
            Detection Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {flaggedAlerts.map((alert, i) => (
            <div
              key={i}
              className="pb-3 border-b border-border last:border-0 last:pb-0"
            >
              <p className="font-medium text-sm">{alert.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {alert.description}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Trending */}
      <Card className="bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-5" />
            Trending Now
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trendingTopics.map((trend, i) => (
            <div
              key={i}
              className="pb-3 border-b border-border last:border-0 last:pb-0 cursor-pointer hover:bg-accent/50 -mx-2 px-2 py-1 rounded-md transition-colors"
            >
              <p className="text-xs text-muted-foreground">{trend.category}</p>
              <p className="font-semibold text-sm">{trend.topic}</p>
              <p className="text-xs text-muted-foreground">{trend.posts} posts</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-xs text-muted-foreground space-x-2">
        <a href="#" className="hover:underline">Terms</a>
        <a href="#" className="hover:underline">Privacy</a>
        <a href="#" className="hover:underline">About</a>
        <span>© 2026 TruthGuard</span>
      </div>
    </div>
  )
}
