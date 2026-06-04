import type { RosterScorecard } from '../lib/types'

type ResultStatTablesProps = {
  scorecard: RosterScorecard
}

function StatTable({
  title,
  headers,
  rows,
}: {
  title: string
  headers: string[]
  rows: {
    rk: number
    pos: string
    player: string
    teamEra: string
    cols: string[]
    twoWay?: boolean
  }[]
}) {
  if (rows.length === 0) return null

  return (
    <section className="overflow-x-auto" aria-labelledby={`${title}-heading`}>
      <h3
        id={`${title}-heading`}
        className="font-display mb-2 text-sm font-semibold uppercase tracking-wide text-primary"
      >
        {title}
      </h3>
      <table className="w-full min-w-[28rem] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map((h) => (
              <th
                key={h}
                className="px-2 py-1.5 font-semibold text-muted-foreground first:pl-0 last:pr-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.pos}-${row.player}`} className="border-b border-border/60">
              <td className="py-1.5 pr-2 tabular-nums text-muted-foreground">
                {row.rk}
              </td>
              <td className="py-1.5 pr-2 font-bold text-primary">{row.pos}</td>
              <td className="max-w-[8rem] truncate py-1.5 pr-2 font-medium">
                {row.player}
                {row.twoWay && (
                  <span className="ml-1 text-[0.6rem] font-bold text-primary">
                    2W
                  </span>
                )}
              </td>
              <td className="max-w-[6rem] truncate py-1.5 pr-2 text-[0.65rem] text-muted-foreground">
                {row.teamEra}
              </td>
              {row.cols.map((col, i) => (
                <td
                  key={i}
                  className="py-1.5 pr-2 text-right tabular-nums last:pr-0"
                >
                  {col}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/** OPS = OBP + SLG, formatted as a leading-dot three-decimal string. */
function formatOps(obp: string, slg: string): string {
  const obpNum = Number.parseFloat(obp)
  const slgNum = Number.parseFloat(slg)
  if (Number.isNaN(obpNum) || Number.isNaN(slgNum)) return '—'
  return (obpNum + slgNum).toFixed(3).replace(/^0/, '')
}

function parseBattingCols(slashLine: string, countingLine: string): string[] {
  const slashParts = slashLine.split(/\s*\/\s*/)
  if (slashParts.length >= 3) {
    const hrMatch = countingLine.match(/([\d,]+)\s*HR/)
    const rbiMatch = countingLine.match(/([\d,]+)\s*RBI/)
    const sbMatch = countingLine.match(/([\d,]+)\s*SB/)
    const avg = slashParts[0] ?? '—'
    const obp = slashParts[1] ?? '—'
    const slg = slashParts[2] ?? '—'
    return [
      avg,
      obp,
      slg,
      formatOps(obp, slg),
      hrMatch?.[1] ?? '—',
      rbiMatch?.[1] ?? '—',
      sbMatch?.[1] ?? '—',
    ]
  }
  const avgMatch = slashLine.match(/([\d.]+)\s*AVG/)
  const opsMatch = slashLine.match(/([\d.]+)\s*OPS/)
  const hrMatch = countingLine.match(/([\d,]+)\s*HR/)
  const rbiMatch = countingLine.match(/([\d,]+)\s*RBI/)
  const sbMatch = countingLine.match(/([\d,]+)\s*SB/)
  return [
    avgMatch?.[1] ?? '—',
    '—',
    '—',
    opsMatch?.[1] ?? '—',
    hrMatch?.[1] ?? '—',
    rbiMatch?.[1] ?? '—',
    sbMatch?.[1] ?? '—',
  ]
}

function parsePitchingCols(slashLine: string, countingLine: string): string[] {
  const eraMatch = slashLine.match(/([\d.]+)\s*ERA/)
  const whipMatch = slashLine.match(/([\d.]+)\s*WHIP/)
  const kMatch = countingLine.match(/([\d,]+)\s*K/)
  const wMatch = countingLine.match(/([\d,]+)\s*W/)
  return [
    eraMatch?.[1] ?? '—',
    whipMatch?.[1] ?? '—',
    kMatch?.[1] ?? '—',
    wMatch?.[1] ?? '—',
  ]
}

export default function ResultStatTables({ scorecard }: ResultStatTablesProps) {
  const battingRows = scorecard.battingRows.map((row, i) => ({
    rk: i + 1,
    pos: row.position,
    player: row.playerName,
    teamEra: `${row.teamName} · ${row.era}`,
    cols: parseBattingCols(row.slashLine, row.countingLine),
    twoWay: row.twoWay,
  }))

  const pitchingRows = scorecard.pitchingRows.map((row, i) => ({
    rk: i + 1,
    pos: row.position,
    player: row.playerName,
    teamEra: `${row.teamName} · ${row.era}`,
    cols: parsePitchingCols(row.slashLine, row.countingLine),
    twoWay: row.twoWay,
  }))

  return (
    <div className="space-y-5 text-left">
      <StatTable
        title="Batting"
        headers={['Rk', 'Pos', 'Player', 'Tm', 'AVG', 'OBP', 'SLG', 'OPS', 'HR', 'RBI', 'SB']}
        rows={battingRows}
      />
      <StatTable
        title="Pitching"
        headers={['Rk', 'Pos', 'Player', 'Tm', 'ERA', 'WHIP', 'SO', 'W']}
        rows={pitchingRows}
      />
      <p className="text-center text-[0.65rem] text-muted-foreground">
        {scorecard.rows[0]?.statNote ?? 'Simulated season totals'}
      </p>
    </div>
  )
}
