import {
  Activity,
  CheckCircle2,
  Clock3,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  XCircle,
} from "lucide-react"
import { Input } from "@/components/ui/input"

const platformStats = [
  {
    label: "Posts Analyzed Today",
    value: "1,284",
    icon: Activity,
    className: "text-sky-500",
  },
  {
    label: "Flagged Content",
    value: "42",
    icon: ShieldAlert,
    className: "text-amber-500",
  },
  {
    label: "Under Review",
    value: "18",
    icon: Clock3,
    className: "text-violet-400",
  },
  {
    label: "Removed Today",
    value: "7",
    icon: XCircle,
    className: "text-red-500",
  },
]

const detectionActivity = [
  {
    title: "Political image cluster flagged",
    detail: "Multiple reports mention an election-related synthetic image.",
    time: "12m",
    icon: ShieldAlert,
  },
  {
    title: "C2PA credentials verified",
    detail: "A high-reach upload carried valid provenance metadata.",
    time: "31m",
    icon: ShieldCheck,
  },
  {
    title: "Moderator label applied",
    detail: "One post now displays a public AI-risk context label.",
    time: "1h",
    icon: CheckCircle2,
  },
]

const actionSummary = [
  { label: "Approval rate", value: "86%" },
  { label: "Median review time", value: "4m" },
  { label: "Escalations", value: "3" },
]

export function TrendingSidebar() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search TruthGuard"
          className="rounded-full border-0 bg-muted/60 pl-10 focus-visible:ring-1"
        />
      </div>

      <section className="rounded-2xl border border-border/70 bg-card/70 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Platform Health</h2>
            <p className="text-xs text-muted-foreground">
              Live trust and safety signals
            </p>
          </div>
          <TrendingUp className="size-5 text-muted-foreground" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {platformStats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="rounded-xl bg-muted/35 p-3 transition-colors hover:bg-muted/55"
              >
                <div className="mb-2 flex items-center justify-between">
                  <Icon className={`size-4 ${stat.className}`} />
                  <span className="text-lg font-bold">{stat.value}</span>
                </div>
                <p className="text-xs leading-tight text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/70 p-4">
        <h2 className="text-xl font-semibold">Detection Activity</h2>
        <div className="mt-3 space-y-1">
          {detectionActivity.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                className="flex gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-muted/45"
              >
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {item.title}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {item.time}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/70 p-4">
        <h2 className="text-xl font-semibold">Moderator Actions</h2>
        <div className="mt-3 divide-y divide-border/70">
          {actionSummary.map((item) => (
            <div key={item.label} className="flex items-center justify-between py-3">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-sm font-semibold">{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="px-1 text-xs text-muted-foreground">
        TruthGuard analyzes media provenance, classifier risk, reports, and
        moderator outcomes before content reaches users.
      </div>
    </div>
  )
}
