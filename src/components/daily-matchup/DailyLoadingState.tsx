export default function DailyLoadingState() {
  return (
    <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2" aria-busy="true">
      <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted/70" />
        <div className="mt-2 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-muted/40" />
          ))}
        </div>
      </div>
      <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-14 w-full animate-pulse rounded bg-muted/40" />
          ))}
        </div>
      </div>
      <p className="sr-only">Loading Daily Matchup…</p>
    </div>
  )
}
