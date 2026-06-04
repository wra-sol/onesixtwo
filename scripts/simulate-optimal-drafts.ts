/**
 * Monte Carlo draft simulations with multiple pick strategies.
 *
 * Run:
 *   npm run simulate:optimal                    # compare all strategies (100 runs each)
 *   STRATEGY=overall npm run simulate:optimal   # single strategy
 *   RUNS=500 STRATEGY=team-score npm run simulate:optimal
 */
import {
  applySpin,
  assignPlayer,
  calculateSeasonResult,
  calculateTeamScore,
  createInitialGameState,
  getEligiblePositionsForPlayer,
  isLineupComplete,
  selectPlayer,
  startGame,
} from '../src/lib/game.ts'
import { calculateRunPrevention } from '../src/lib/run-prevention.ts'
import type { GameState, HitterStats, Lineup, LineupPosition, Player, RandomSource } from '../src/lib/types.ts'
import { LINEUP_POSITIONS } from '../src/lib/types.ts'

const RUNS = Number.parseInt(process.env.RUNS ?? '100', 10)
const STRATEGY_ARG = process.env.STRATEGY ?? 'compare'

export type PickStrategy = 'overall' | 'team-score' | 'run-prevention'

const STRATEGIES: PickStrategy[] = ['overall', 'team-score', 'run-prevention']

const FILL_ORDER: LineupPosition[] = [
  'SP',
  'C',
  'SS',
  'CF',
  'RF',
  'LF',
  '2B',
  '3B',
  '1B',
]

type DraftResult = {
  state: GameState
  wins: number
  teamScore: number
  tier: string
  runPrevention: number
}

type PickChoice = { player: Player; position: LineupPosition }

function mulberry32(seed: number): RandomSource {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickablePlayers(players: Player[], lineup: Lineup): Player[] {
  return players.filter((p) => getEligiblePositionsForPlayer(p, lineup).length > 0)
}

function pickAssignPosition(player: Player, lineup: Lineup): LineupPosition {
  const eligible = getEligiblePositionsForPlayer(player, lineup)
  for (const pos of FILL_ORDER) {
    if (eligible.includes(pos)) return pos
  }
  return eligible[0]!
}

/** Mirrors calculateTeamScore bonus logic on a partial or full lineup. */
function partialTeamScore(lineup: Lineup): number {
  const players = LINEUP_POSITIONS.map((pos) => lineup[pos]).filter(Boolean) as Player[]
  if (players.length === 0) return 0

  const average =
    players.reduce((sum, p) => sum + p.ratings.overall, 0) / players.length

  let bonus = 0
  if (players.some((p) => p.ratings.overall >= 95)) {
    bonus += 3
  }

  const hitters = players.filter((p) => p.role === 'hitter')
  if (hitters.length > 0) {
    const avgContact =
      hitters.reduce((s, p) => s + p.ratings.contact, 0) / hitters.length
    const avgPower =
      hitters.reduce((s, p) => s + p.ratings.power, 0) / hitters.length
    const avgSpeed =
      hitters.reduce((s, p) => s + p.ratings.speed, 0) / hitters.length
    if (avgContact >= 70 && avgPower >= 70 && avgSpeed >= 70) {
      bonus += 2
    }
  }

  return Math.min(100, Math.round(average + bonus))
}

function hitterErrorsPer162(player: Player): number {
  const stats = player.stats as HitterStats
  const errors = stats.errors ?? 12
  const games = stats.fieldingGames ?? stats.g ?? 162
  return (errors / Math.max(games, 1)) * 162
}

function partialRunPrevention(lineup: Lineup): number {
  const players = LINEUP_POSITIONS.map((pos) => lineup[pos]).filter(Boolean) as Player[]
  if (players.length === 0) return 0
  return calculateRunPrevention(players).value
}

function pickChoiceOverall(players: Player[], state: GameState): PickChoice | null {
  const pickable = pickablePlayers(players, state.lineup)
  if (pickable.length === 0) return null
  const player = [...pickable].sort((a, b) => b.ratings.overall - a.ratings.overall)[0]!
  return { player, position: pickAssignPosition(player, state.lineup) }
}

function pickChoiceTeamScore(players: Player[], state: GameState): PickChoice | null {
  const pickable = pickablePlayers(players, state.lineup)
  if (pickable.length === 0) return null

  let best: PickChoice | null = null
  let bestScore = -1

  for (const player of pickable) {
    for (const position of getEligiblePositionsForPlayer(player, state.lineup)) {
      const trial = { ...state.lineup, [position]: player }
      const score = partialTeamScore(trial)
      if (score > bestScore || (score === bestScore && player.ratings.overall > (best?.player.ratings.overall ?? -1))) {
        bestScore = score
        best = { player, position }
      }
    }
  }

  return best
}

function pickChoiceRunPrevention(players: Player[], state: GameState): PickChoice | null {
  const pickable = pickablePlayers(players, state.lineup)
  if (pickable.length === 0) return null

  const pitcherSlotOpen = state.lineup.SP === null

  let best: PickChoice | null = null
  let bestScore = -1

  for (const player of pickable) {
    for (const position of getEligiblePositionsForPlayer(player, state.lineup)) {
      const trial = { ...state.lineup, [position]: player }
      let score: number

      if (pitcherSlotOpen && player.role === 'pitcher') {
        score = player.ratings.era * 100 + player.ratings.overall
      } else if (player.role === 'pitcher') {
        score = partialRunPrevention(trial) * 10 + player.ratings.era
      } else {
        const errorsPer162 = hitterErrorsPer162(player)
        const defenseScore = Math.max(0, 100 - errorsPer162 * 0.65)
        score =
          partialRunPrevention(trial) * 5 +
          defenseScore +
          player.ratings.overall * 0.15
      }

      if (score > bestScore) {
        bestScore = score
        best = { player, position }
      }
    }
  }

  return best
}

function pickChoice(
  strategy: PickStrategy,
  players: Player[],
  state: GameState,
): PickChoice | null {
  switch (strategy) {
    case 'overall':
      return pickChoiceOverall(players, state)
    case 'team-score':
      return pickChoiceTeamScore(players, state)
    case 'run-prevention':
      return pickChoiceRunPrevention(players, state)
  }
}

function simulateDraft(strategy: PickStrategy, seed: number): DraftResult {
  const random = mulberry32(seed)
  let state = startGame(createInitialGameState())
  let guard = 0

  while (!isLineupComplete(state.lineup)) {
    if (++guard > 200) {
      throw new Error(`Draft stuck after ${guard} steps (seed ${seed})`)
    }

    if (state.status === 'spinning') {
      state = applySpin(state, random)
      if (state.status === 'stuck') {
        throw new Error(`No eligible buckets (seed ${seed}, round ${state.round})`)
      }
      continue
    }

    if (state.status === 'picking') {
      const choice = pickChoice(strategy, state.availablePlayers, state)
      if (!choice) {
        state = { ...state, status: 'spinning', spinIntent: 'round', currentBucket: null }
        continue
      }
      state = selectPlayer(state, choice.player.id)
      state = assignPlayer(state, choice.position)
    }
  }

  const result = calculateSeasonResult(state.lineup)!
  const rp = calculateRunPrevention(
    LINEUP_POSITIONS.map((pos) => state.lineup[pos]!).filter(Boolean),
  )

  return {
    state,
    wins: result.wins,
    teamScore: calculateTeamScore(state.lineup)!,
    tier: result.tier.label,
    runPrevention: rp.value,
  }
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const k = ((sorted.length - 1) * p) / 100
  const f = Math.floor(k)
  const c = Math.ceil(k)
  if (f === c) return sorted[f]!
  return sorted[f]! * (c - k) + sorted[c]! * (k - f)
}

function runBatch(strategy: PickStrategy): { results: DraftResult[]; failures: string[] } {
  const results: DraftResult[] = []
  const failures: string[] = []

  for (let seed = 1; seed <= RUNS; seed++) {
    try {
      results.push(simulateDraft(strategy, seed))
    } catch (err) {
      failures.push(`seed ${seed}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { results, failures }
}

function printStrategyReport(strategy: PickStrategy, results: DraftResult[]) {
  const wins = results.map((r) => r.wins)
  const teamScores = results.map((r) => r.teamScore)
  const runPrev = results.map((r) => r.runPrevention)
  const perfect = results.filter((r) => r.wins === 162)
  const best = [...results].sort((a, b) => b.wins - a.wins || b.teamScore - a.teamScore)[0]

  console.log(`\n--- ${strategy} ---`)
  console.log(`Perfect (162-0): ${perfect.length}  |  Dynasty (120+): ${results.filter((r) => r.wins >= 120).length}`)
  console.log(
    `Wins  min=${Math.min(...wins)} med=${Math.round(percentile(wins, 50))} max=${Math.max(...wins)} mean=${(wins.reduce((s, w) => s + w, 0) / wins.length).toFixed(1)}`,
  )
  console.log(
    `Team  min=${Math.min(...teamScores)} med=${Math.round(percentile(teamScores, 50))} max=${Math.max(...teamScores)}`,
  )
  console.log(
    `RP    min=${Math.min(...runPrev)} med=${Math.round(percentile(runPrev, 50))} max=${Math.max(...runPrev)}`,
  )

  if (best) {
    const seed = results.indexOf(best) + 1
    const pitcher = best.state.lineup.SP!
    console.log(
      `Best: seed ${seed} → ${best.wins}-162 (team ${best.teamScore}, RP ${best.runPrevention}) P=${pitcher.name} (ERA ${pitcher.ratings.era})`,
    )
  }

  if (perfect.length > 0) {
    for (const run of perfect) {
      const seed = results.indexOf(run) + 1
      console.log(`  ★ Perfect seed ${seed}: team ${run.teamScore}, RP ${run.runPrevention}`)
    }
  }
}

function printComparisonTable(all: Record<PickStrategy, DraftResult[]>) {
  console.log('\n=== Strategy comparison ===')
  console.log('Strategy          Perfect  Dynasty  Med wins  Max wins  Med team  Med RP')
  for (const strategy of STRATEGIES) {
    const results = all[strategy]!
    const wins = results.map((r) => r.wins)
    const teamScores = results.map((r) => r.teamScore)
    const runPrev = results.map((r) => r.runPrevention)
    console.log(
      `${strategy.padEnd(17)} ${String(results.filter((r) => r.wins === 162).length).padStart(7)}  ${String(results.filter((r) => r.wins >= 120).length).padStart(7)}  ${String(Math.round(percentile(wins, 50))).padStart(8)}  ${String(Math.max(...wins)).padStart(8)}  ${String(Math.round(percentile(teamScores, 50))).padStart(8)}  ${String(Math.round(percentile(runPrev, 50))).padStart(6)}`,
    )
  }
}

function main() {
  const strategies =
    STRATEGY_ARG === 'compare' ? STRATEGIES : [STRATEGY_ARG as PickStrategy]

  if (!strategies.every((s) => STRATEGIES.includes(s))) {
    console.error(`Unknown STRATEGY="${STRATEGY_ARG}". Use: overall, team-score, run-prevention, compare`)
    process.exit(1)
  }

  console.log(`Optimal-draft Monte Carlo — ${RUNS} runs per strategy`)

  const allResults: Partial<Record<PickStrategy, DraftResult[]>> = {}
  const allFailures: string[] = []

  for (const strategy of strategies) {
    const { results, failures } = runBatch(strategy)
    allResults[strategy] = results
    allFailures.push(...failures.map((f) => `[${strategy}] ${f}`))
    printStrategyReport(strategy, results)
  }

  if (strategies.length > 1) {
    printComparisonTable(allResults as Record<PickStrategy, DraftResult[]>)
  }

  if (allFailures.length > 0) {
    console.log('\nFailures:')
    for (const f of allFailures) console.log(`  ${f}`)
    process.exit(1)
  }
}

main()
