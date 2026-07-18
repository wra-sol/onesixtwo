import { buildLegendsSnapshot, filterLegendsByTeam } from '../src/lib/classic-live-adapter.ts'
import { paProbabilities } from '../shared/live/pa-sim.ts'
import { PLAYERS } from '../src/data/index.ts'
import type { LivePlayer } from '../shared/live/live-types.ts'
import type { Player } from '../src/lib/types.ts'

const FLAGSHIP_FRANCHISES = ['yankees', 'red-sox', 'dodgers'] as const
const ROSTER_SIZE = 25

function gradeLine(p: LivePlayer, cp: Player): string {
  const g = p.grades
  const parts: string[] = []
  if (g.contact !== undefined) parts.push(`contact=${g.contact}`)
  if (g.power !== undefined) parts.push(`power=${g.power}`)
  if (g.speed !== undefined) parts.push(`speed=${g.speed}`)
  if (g.stuff !== undefined) parts.push(`stuff=${g.stuff}`)
  if (g.command !== undefined) parts.push(`command=${g.command}`)
  if (g.stamina !== undefined) parts.push(`stamina=${g.stamina}`)
  if (g.defense !== undefined) parts.push(`defense=${g.defense}`)
  parts.push(`overall=${g.overall}`)
  return `${p.name} [${cp.era} ${p.teamAbbrev}] role=${p.role} pos=[${p.positions.join(',')}] roles=[${p.pitcherRoles?.join(',') ?? '-'}]\n    ${parts.join('  ')}`
}

function probsLine(label: string, probs: Record<string, number>): string {
  const sum = Object.values(probs).reduce((s, v) => s + v, 0)
  const hasNan = Object.values(probs).some((v) => Number.isNaN(v))
  const outOfBand = Object.values(probs).some((v) => v < 0 || v > 1)
  const fmt = Object.entries(probs)
    .map(([k, v]) => `${k}=${v.toFixed(4)}`)
    .join('  ')
  return `${label}: ${fmt}\n    sum=${sum.toFixed(6)}  NaN=${hasNan}  outOfBand=${outOfBand}`
}

function validateProbs(probs: Record<string, number>): boolean {
  const sum = Object.values(probs).reduce((s, v) => s + v, 0)
  const hasNan = Object.values(probs).some((v) => Number.isNaN(v))
  const outOfBand = Object.values(probs).some((v) => v < 0 || v > 1)
  return !hasNan && !outOfBand && Math.abs(sum - 1) < 1e-9
}

function main(): void {
  const failures: string[] = []
  const snapshot = buildLegendsSnapshot()
  console.log(`\n=== Sim 162 W0b — Legends adapter spike ===\n`)
  console.log(`Legends snapshot size: ${snapshot.length}\n`)

  const live = (cp: Player): LivePlayer => snapshot.find((x) => x.id === cp.id)!

  const hitters = PLAYERS.filter((p) => p.role === 'hitter')
  const pitchers = PLAYERS.filter((p) => p.role === 'pitcher')

  const earlyContact = hitters
    .filter((p) => p.era === '1930s' && p.ratings.power <= 60)
    .sort((a, b) => b.ratings.contact - a.ratings.contact)[0]!
  const modernPower = hitters
    .filter((p) => (p.era === '2000s' || p.era === '2010s') && p.ratings.power >= 90)
    .sort((a, b) => b.ratings.power - a.ratings.power)[0]!
  const elitePitcher = [...pitchers].sort((a, b) => b.ratings.overall - a.ratings.overall)[0]!
  const weakPitcher = [...pitchers].sort((a, b) => a.ratings.overall - b.ratings.overall)[0]!
  const eliteCloser = [...pitchers].sort((a, b) => b.ratings.saves - a.ratings.saves)[0]!

  const samples: Player[] = [earlyContact, modernPower, elitePitcher, weakPitcher, eliteCloser]

  console.log('--- Sample players across eras (mapped grades) ---')
  for (const cp of samples) {
    console.log(gradeLine(live(cp), cp))
  }

  console.log('\n--- PA probability matchups (batter vs pitcher, catcher defense=50) ---')
  const matchups: Array<{ label: string; batter: Player; pitcher: Player }> = [
    { label: 'Early contact hitter vs elite SP', batter: earlyContact, pitcher: elitePitcher },
    { label: 'Modern power hitter vs elite SP', batter: modernPower, pitcher: elitePitcher },
    { label: 'Modern power hitter vs weak SP', batter: modernPower, pitcher: weakPitcher },
    { label: 'Modern power hitter vs elite CL', batter: modernPower, pitcher: eliteCloser },
  ]
  for (const m of matchups) {
    const probs = paProbabilities(live(m.batter), live(m.pitcher), 50)
    console.log(probsLine(m.label, probs))
    if (!validateProbs(probs)) failures.push(`PA probs invalid: ${m.label}`)
  }

  console.log('\n--- Cross-era PA sweep (batters × pitchers, all eras) ---')
  const eraBatters = PLAYERS.reduce<Player[]>((acc, p) => {
    if (p.role !== 'hitter') return acc
    if (acc.find((x) => x.era === p.era)) return acc
    return [...acc, p]
  }, [])
  const eraPitchers = PLAYERS.reduce<Player[]>((acc, p) => {
    if (p.role !== 'pitcher') return acc
    if (acc.find((x) => x.era === p.era)) return acc
    return [...acc, [...pitchers].sort((a, b) => b.ratings.overall - a.ratings.overall).find((q) => q.era === p.era)!]
  }, [])
  let sweepPairs = 0
  let sweepBad = 0
  for (const batter of eraBatters) {
    for (const pitcher of eraPitchers) {
      const probs = paProbabilities(live(batter), live(pitcher), 50)
      sweepPairs += 1
      if (!validateProbs(probs)) sweepBad += 1
    }
  }
  console.log(`Swept ${sweepPairs} batter×pitcher pairs across ${eraBatters.length} eras; invalid=${sweepBad}`)
  if (sweepBad > 0) failures.push(`${sweepBad} cross-era PA pairs produced invalid probabilities`)

  console.log('\n--- Franchise legend counts (25-man feasibility) ---')
  for (const teamId of FLAGSHIP_FRANCHISES) {
    const roster = filterLegendsByTeam(snapshot, teamId)
    const enough = roster.length >= ROSTER_SIZE
    console.log(`${teamId}: ${roster.length} legends  →  ${enough ? 'OK (≥25)' : `GAP (need ${ROSTER_SIZE - roster.length} more)`}`)
    if (!enough) failures.push(`${teamId} has only ${roster.length} legends (<${ROSTER_SIZE})`)
  }

  console.log('\n--- All grades in-band sweep (full snapshot) ---')
  let outOfBandGrades = 0
  for (const p of snapshot) {
    for (const v of Object.values(p.grades)) {
      if (typeof v !== 'number' || v < 20 || v > 80 || Number.isNaN(v)) outOfBandGrades += 1
    }
  }
  console.log(`Grades out of [20,80] / NaN across ${snapshot.length} players: ${outOfBandGrades}`)
  if (outOfBandGrades > 0) failures.push(`${outOfBandGrades} grades out of band`)

  console.log(`\n=== ${failures.length === 0 ? 'PASS' : 'FAIL'} ===`)
  if (failures.length > 0) {
    for (const f of failures) console.log(`  - ${f}`)
    process.exit(1)
  }
}

main()
