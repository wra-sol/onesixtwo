import type { GameBoxScore } from '@/lib/box-score'

type GameBoxScoreCardProps = {
  box: GameBoxScore
  awayLabel: string
  homeLabel: string
}

function BattingTable({ rows }: { rows: GameBoxScore['away']['batting'] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">No plate appearances.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[19rem] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-muted-foreground">
            <th scope="col" className="py-1 pl-2 pr-1 font-semibold">Batter</th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">AB</th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">H</th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">HR</th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">RBI</th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">BB</th>
            <th scope="col" className="py-1 pl-1 pr-2 text-right font-semibold">SO</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border/50 last:border-b-0">
              <td className="max-w-[8rem] truncate py-1 pl-2 pr-1 font-medium">{r.name}</td>
              <td className="px-1 py-1 text-right tabular-nums">{r.ab}</td>
              <td className="px-1 py-1 text-right tabular-nums">{r.h}</td>
              <td className="px-1 py-1 text-right tabular-nums">{r.hr}</td>
              <td className="px-1 py-1 text-right tabular-nums">{r.rbi}</td>
              <td className="px-1 py-1 text-right tabular-nums">{r.bb}</td>
              <td className="py-1 pl-1 pr-2 text-right tabular-nums">{r.so}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PitchingTable({ rows }: { rows: GameBoxScore['away']['pitching'] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">No pitchers used.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[23rem] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-muted-foreground">
            <th scope="col" className="py-1 pl-2 pr-1 font-semibold">Pitcher</th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">IP</th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">BF</th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">H</th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">R</th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">HR</th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">BB</th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">SO</th>
            <th scope="col" className="py-1 pl-1 pr-2 text-right font-semibold">P</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border/50 last:border-b-0">
              <td className="max-w-[7.5rem] truncate py-1 pl-2 pr-1 font-medium">{r.name}</td>
              <td className="px-1 py-1 text-right tabular-nums">{r.ip}</td>
              <td className="px-1 py-1 text-right tabular-nums">{r.bf}</td>
              <td className="px-1 py-1 text-right tabular-nums">{r.h}</td>
              <td className="px-1 py-1 text-right tabular-nums">{r.r}</td>
              <td className="px-1 py-1 text-right tabular-nums">{r.hr}</td>
              <td className="px-1 py-1 text-right tabular-nums">{r.bb}</td>
              <td className="px-1 py-1 text-right tabular-nums">{r.so}</td>
              <td className="py-1 pl-1 pr-2 text-right tabular-nums">{r.pitches}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TeamSection({
  label,
  side,
}: {
  label: string
  side: GameBoxScore['away']
}) {
  return (
    <section className="space-y-2" aria-label={`${label} box score`}>
      <h4 className="text-xs font-bold tracking-wide text-primary uppercase">{label}</h4>
      <BattingTable rows={side.batting} />
      <PitchingTable rows={side.pitching} />
    </section>
  )
}

export default function GameBoxScoreCard({
  box,
  awayLabel,
  homeLabel,
}: GameBoxScoreCardProps) {
  return (
    <div className="space-y-4 text-left">
      <TeamSection label={awayLabel} side={box.away} />
      <TeamSection label={homeLabel} side={box.home} />
      <p className="text-[0.65rem] text-muted-foreground">
        Derived from simulated plate appearances. Team runs, hits, and errors are
        on the game line above.
      </p>
    </div>
  )
}
