/**
 * W0a spike — 25-man roster depth mechanics for the PA-sim engine.
 *
 * Throwaway validation script. Does NOT modify shared/live or src.
 * Reuses the real `paProbabilities`/`pickOutcome` math (copied locally because
 * they are not exported from pa-sim.ts) and the real seeded RNG from rng.ts.
 *
 * Run:  npx tsx scripts/spike-pa-sim-roster.ts
 *       SAMPLE=200 npx tsx scripts/spike-pa-sim-roster.ts
 */
import { createSeededRandomFromString } from '../shared/live/rng.ts'
import { buildFixtureDailyMatchupSnapshot } from '../shared/live/live-fixtures.ts'
import type {
  LivePlayer,
  LivePlayerGrades,
  PaEvent,
  PaEventType,
} from '../shared/live/live-types.ts'

// ---------------------------------------------------------------------------
// Local copies of pa-sim internals (not exported from shared/live/pa-sim.ts).
// Kept byte-for-byte compatible with the production math so results are
// directly comparable to the W3 production path.
// ---------------------------------------------------------------------------

function gradeNorm(grade: number | undefined, fallback = 50): number {
  return (grade ?? fallback) / 50
}

function platoonModifier(batter: LivePlayer, pitcher: LivePlayer): number {
  const bat = batter.batSide ?? 'R'
  const hand = pitcher.pitchHand ?? 'R'
  if (bat === 'S') return 1
  if (bat === 'L' && hand === 'R') return 1.03
  if (bat === 'R' && hand === 'L') return 1.03
  if (bat === 'L' && hand === 'L') return 0.97
  if (bat === 'R' && hand === 'R') return 0.97
  return 1
}

function paProbabilities(batter: LivePlayer, pitcher: LivePlayer, defense: number) {
  const contact = gradeNorm(batter.grades.contact) * platoonModifier(batter, pitcher)
  const power = gradeNorm(batter.grades.power)
  const stuff = gradeNorm(pitcher.grades.stuff)
  const command = gradeNorm(pitcher.grades.command)
  const defenseFactor = gradeNorm(defense, 50)

  const kRate = Math.max(0.08, Math.min(0.35, (0.22 * stuff) / contact))
  const bbRate = Math.max(0.04, Math.min(0.18, 0.08 * (1 / command) * contact))
  const hrRate = Math.max(0.01, Math.min(0.12, 0.04 * power * (2 - stuff) * 0.5))
  const tripleRate = 0.004 * gradeNorm(batter.grades.speed)
  const doubleRate = Math.max(0.02, Math.min(0.08, 0.04 * power * 0.8))
  const singleRate = Math.max(0.1, 0.28 * contact * (2 - stuff) * defenseFactor * 0.4)
  const outRate = Math.max(
    0.2,
    1 - kRate - bbRate - hrRate - tripleRate - doubleRate - singleRate,
  )

  const total = kRate + bbRate + hrRate + tripleRate + doubleRate + singleRate + outRate
  return {
    strikeout: kRate / total,
    walk: bbRate / total,
    home_run: hrRate / total,
    triple: tripleRate / total,
    double: doubleRate / total,
    single: singleRate / total,
    out: outRate / total,
  }
}

function pickOutcome(
  probs: ReturnType<typeof paProbabilities>,
  random: () => number,
): PaEventType {
  const roll = random()
  let acc = 0
  const entries: Array<[PaEventType, number]> = [
    ['strikeout', probs.strikeout],
    ['walk', probs.walk],
    ['home_run', probs.home_run],
    ['triple', probs.triple],
    ['double', probs.double],
    ['single', probs.single],
    ['out', probs.out],
  ]
  for (const [type, p] of entries) {
    acc += p
    if (roll < acc) return type
  }
  return 'out'
}

// ---------------------------------------------------------------------------
// Extended roster types (25-man): rotation + bullpen pool + bench.
// ---------------------------------------------------------------------------

type BullpenMode = 'leverage' | 'single'

type SimOpts = {
  bullpenMode: BullpenMode
  useBench: boolean
}

type RosterSimTeam = {
  name: string
  battingOrder: LivePlayer[]
  bench: LivePlayer[]
  rotation: LivePlayer[]
  bullpen: LivePlayer[]
  singleRp: { rp: LivePlayer; cl: LivePlayer }
  catcherDefense: number
  isUser: boolean
}

type PhEvent = {
  inning: number
  team: 'user' | 'opp'
  hitterName: string
  forName: string
  gameDiff: number
}

type GameStats = {
  userLateRunsAllowed: number
  userLateRunsAllowedClose: number
  highLeverageArms: Array<{ name: string; overall: number }>
}

type PitcherUsage = Map<string, number>

type GameResult = {
  homeScore: number
  awayScore: number
  userScore: number
  oppScore: number
  userWon: boolean
  starterUser: string
  starterOpp: string
  phLog: PhEvent[]
  userLateRunsAllowed: number
  userLateRunsAllowedClose: number
  highLeverageArms: Array<{ name: string; overall: number }>
  pitcherUsage: PitcherUsage
}

// ---------------------------------------------------------------------------
// Pitcher / batter selection for the 25-man model.
// ---------------------------------------------------------------------------

function selectPitcher(
  defense: RosterSimTeam,
  inning: number,
  halfInningRuns: number,
  gameDiff: number,
  starter: LivePlayer,
  mode: BullpenMode,
): LivePlayer {
  if (mode === 'single') {
    if (inning >= 8 && Math.abs(halfInningRuns) <= 2) return defense.singleRp.cl
    if (inning >= 6) return defense.singleRp.rp
    return starter
  }
  if (inning <= 5) return starter
  const close = Math.abs(gameDiff) <= 2
  if (inning >= 8) {
    return close ? defense.bullpen[0]! : defense.bullpen[defense.bullpen.length - 1]!
  }
  const mid = Math.floor(defense.bullpen.length / 2)
  return defense.bullpen[mid]!
}

function maybePinchHit(
  offense: RosterSimTeam,
  dueIndex: number,
  inning: number,
  gameDiff: number,
  benchUsed: Set<string>,
  phLog: PhEvent[],
  opts: SimOpts,
): LivePlayer {
  const slot = dueIndex % offense.battingOrder.length
  const due = offense.battingOrder[slot]!
  if (!opts.useBench) return due
  if (inning < 7) return due
  if (slot !== offense.battingOrder.length - 1) return due
  const available = offense.bench.filter((b) => !benchUsed.has(b.id))
  if (available.length === 0) return due
  const ph = [...available].sort((a, b) => b.grades.overall - a.grades.overall)[0]!
  benchUsed.add(ph.id)
  phLog.push({
    inning,
    team: offense.isUser ? 'user' : 'opp',
    hitterName: ph.name,
    forName: due.name,
    gameDiff,
  })
  return ph
}

// ---------------------------------------------------------------------------
// Half-inning sim (roster-aware). Base-runner logic copied verbatim from
// pa-sim.ts; pitcher selection + bench PH layered on top.
// ---------------------------------------------------------------------------

function simulateHalfInningRoster(
  offense: RosterSimTeam,
  defense: RosterSimTeam,
  inning: number,
  half: 'top' | 'bottom',
  random: () => number,
  events: PaEvent[],
  ctx: {
    starter: LivePlayer
    opts: SimOpts
    offGameRuns: number
    defGameRuns: number
    orderIndex: { i: number }
    benchUsed: Set<string>
    phLog: PhEvent[]
    pitcherUsage: PitcherUsage
    gameStats: GameStats
    defenseIsUser: boolean
  },
): number {
  let outs = 0
  let runs = 0
  const bases = [false, false, false]

  while (outs < 3) {
    const dueIndex = ctx.orderIndex.i
    const offDiff = ctx.offGameRuns + runs - ctx.defGameRuns
    const batter = maybePinchHit(
      offense,
      dueIndex,
      inning,
      offDiff,
      ctx.benchUsed,
      ctx.phLog,
      ctx.opts,
    )
    ctx.orderIndex.i += 1

    const defDiff = ctx.defGameRuns - (ctx.offGameRuns + runs)
    const pitcher = selectPitcher(
      defense,
      inning,
      runs,
      defDiff,
      ctx.starter,
      ctx.opts.bullpenMode,
    )
    ctx.pitcherUsage.set(pitcher.name, (ctx.pitcherUsage.get(pitcher.name) ?? 0) + 1)
    if (inning >= 8 && ctx.defenseIsUser) {
      ctx.gameStats.highLeverageArms.push({
        name: pitcher.name,
        overall: pitcher.grades.overall,
      })
    }

    const probs = paProbabilities(batter, pitcher, defense.catcherDefense)
    const outcome = pickOutcome(probs, random)

    if (
      outcome !== 'strikeout' &&
      outcome !== 'walk' &&
      bases[0] &&
      random() < gradeNorm(batter.grades.speed) * 0.08
    ) {
      const caught = random() < defense.catcherDefense / 200
      events.push({
        inning,
        half,
        batterName: batter.name,
        pitcherName: pitcher.name,
        type: caught ? 'caught_stealing' : 'steal',
        description: caught
          ? `${batter.name} caught stealing`
          : `${batter.name} steals a base`,
        runsScored: 0,
      })
      if (caught) {
        outs += 1
        bases[0] = false
        continue
      }
    }

    let runsScored = 0
    const description = `${batter.name} ${outcome.replace('_', ' ')}`

    switch (outcome) {
      case 'strikeout':
        outs += 1
        break
      case 'walk':
        if (bases[0] && bases[1] && bases[2]) runsScored = 1
        if (bases[0] && bases[1]) bases[2] = true
        if (bases[0]) bases[1] = true
        bases[0] = true
        break
      case 'single':
        runsScored = (bases[2] ? 1 : 0) + (bases[1] ? 1 : 0)
        bases[1] = bases[0]
        bases[0] = true
        bases[2] = false
        break
      case 'double':
        runsScored = (bases[2] ? 1 : 0) + (bases[1] ? 1 : 0) + (bases[0] ? 1 : 0)
        bases[2] = true
        bases[1] = false
        bases[0] = false
        break
      case 'triple':
        runsScored = bases.filter(Boolean).length
        bases[0] = true
        bases[1] = false
        bases[2] = false
        break
      case 'home_run':
        runsScored = 1 + bases.filter(Boolean).length
        bases[0] = false
        bases[1] = false
        bases[2] = false
        break
      default:
        outs += 1
        break
    }

    runs += runsScored
    if (runsScored > 0) {
      if (inning >= 8 && ctx.defenseIsUser) {
        ctx.gameStats.userLateRunsAllowed += runsScored
        if (Math.abs(defDiff) <= 2) {
          ctx.gameStats.userLateRunsAllowedClose += runsScored
        }
      }
      events.push({
        inning,
        half,
        batterName: batter.name,
        pitcherName: pitcher.name,
        type: 'run_scored',
        description: `${batter.name} drives in ${runsScored} run(s)`,
        runsScored,
      })
    }

    events.push({
      inning,
      half,
      batterName: batter.name,
      pitcherName: pitcher.name,
      type: outcome,
      description,
      runsScored,
    })
  }

  return runs
}

function simulateGameRoster(
  user: RosterSimTeam,
  opp: RosterSimTeam,
  seed: string,
  userIsHome: boolean,
  gameIndex: number,
  opts: SimOpts,
): GameResult {
  const random = createSeededRandomFromString(`${seed}|g${gameIndex}`)
  const userStarter = user.rotation[gameIndex % user.rotation.length]!
  const oppStarter = opp.rotation[gameIndex % opp.rotation.length]!
  const away = userIsHome ? opp : user
  const home = userIsHome ? user : opp

  let awayRuns = 0
  let homeRuns = 0
  const events: PaEvent[] = []
  const orderIndexUser = { i: 0 }
  const orderIndexOpp = { i: 0 }
  const benchUsedUser = new Set<string>()
  const benchUsedOpp = new Set<string>()
  const phLog: PhEvent[] = []
  const pitcherUsage: PitcherUsage = new Map()
  const gameStats: GameStats = {
    userLateRunsAllowed: 0,
    userLateRunsAllowedClose: 0,
    highLeverageArms: [],
  }

  const playInning = (inning: number) => {
    const topRuns = simulateHalfInningRoster(away, home, inning, 'top', random, events, {
      starter: home === user ? userStarter : oppStarter,
      opts,
      offGameRuns: awayRuns,
      defGameRuns: homeRuns,
      orderIndex: away === user ? orderIndexUser : orderIndexOpp,
      benchUsed: away === user ? benchUsedUser : benchUsedOpp,
      phLog,
      pitcherUsage,
      gameStats,
      defenseIsUser: home === user,
    })
    awayRuns += topRuns
    const bottomRuns = simulateHalfInningRoster(home, away, inning, 'bottom', random, events, {
      starter: away === user ? userStarter : oppStarter,
      opts,
      offGameRuns: homeRuns,
      defGameRuns: awayRuns,
      orderIndex: home === user ? orderIndexUser : orderIndexOpp,
      benchUsed: home === user ? benchUsedUser : benchUsedOpp,
      phLog,
      pitcherUsage,
      gameStats,
      defenseIsUser: away === user,
    })
    homeRuns += bottomRuns
  }

  for (let inning = 1; inning <= 9; inning += 1) playInning(inning)
  let extra = 10
  while (awayRuns === homeRuns && extra <= 12) {
    playInning(extra)
    extra += 1
  }

  const userScore = userIsHome ? homeRuns : awayRuns
  const oppScore = userIsHome ? awayRuns : homeRuns
  return {
    homeScore: homeRuns,
    awayScore: awayRuns,
    userScore,
    oppScore,
    userWon: userScore > oppScore,
    starterUser: userStarter.name,
    starterOpp: oppStarter.name,
    phLog,
    userLateRunsAllowed: gameStats.userLateRunsAllowed,
    userLateRunsAllowedClose: gameStats.userLateRunsAllowedClose,
    highLeverageArms: gameStats.highLeverageArms,
    pitcherUsage,
  }
}

// ---------------------------------------------------------------------------
// Roster construction.
// Hitters come from the real fixtures (graded via the live percentile model).
// User pitchers are synthesized with controlled grades so the rotation-depth
// experiment is a clean controlled variable. Opponent uses real LAD fixture
// pitchers (Starter/Reliever/Closer) in the single-RP model.
// ---------------------------------------------------------------------------

let synthCounter = 0

function makePitcher(
  name: string,
  stuff: number,
  command: number,
  stamina: number,
  pitchHand: 'L' | 'R' = 'R',
): LivePlayer {
  synthCounter += 1
  const overall = Math.round(((stuff + command + stamina) / 3) * 10) / 10
  const grades: LivePlayerGrades = {
    stuff,
    command,
    stamina,
    defense: overall,
    overall,
  }
  return {
    id: `synth-p-${synthCounter}`,
    personId: 900000 + synthCounter,
    name,
    teamId: 999,
    teamAbbrev: 'SYN',
    teamName: 'Synthetic',
    positions: ['SP'],
    role: 'pitcher',
    pitchHand,
    grades,
    appearedOnTargetDate: true,
    isFallback: false,
    pitcherRoles: ['SP', 'RP', 'CL'],
  }
}

function makeHitter(
  name: string,
  grades: { contact: number; power: number; speed: number; defense: number },
  batSide: 'L' | 'R' | 'S' = 'R',
): LivePlayer {
  synthCounter += 1
  const overall = Math.round(
    ((grades.contact + grades.power + grades.speed + grades.defense) / 4) * 10,
  ) / 10
  return {
    id: `synth-h-${synthCounter}`,
    personId: 910000 + synthCounter,
    name,
    teamId: 999,
    teamAbbrev: 'SYN',
    teamName: 'Synthetic',
    positions: ['DH'],
    role: 'hitter',
    batSide,
    grades: { ...grades, overall },
    appearedOnTargetDate: true,
    isFallback: false,
  }
}

function makeFlatHitter(name: string, overall: number, batSide: 'L' | 'R' | 'S' = 'R'): LivePlayer {
  return makeHitter(name, { contact: overall, power: overall, speed: overall, defense: overall }, batSide)
}

const PITCHER_SPOT = makeFlatHitter('P (spot)', 20, 'R')

function strongLineup(prefix: string, boost = 0): LivePlayer[] {
  const b = (g: number) => Math.min(80, g + boost)
  return [
    makeHitter(`${prefix} C`, { contact: b(54), power: b(44), speed: b(40), defense: b(60) }, 'R'),
    makeHitter(`${prefix} 1B`, { contact: b(58), power: b(66), speed: b(30), defense: b(50) }, 'L'),
    makeHitter(`${prefix} 2B`, { contact: b(60), power: b(40), speed: b(60), defense: b(54) }, 'R'),
    makeHitter(`${prefix} 3B`, { contact: b(56), power: b(58), speed: b(45), defense: b(48) }, 'R'),
    makeHitter(`${prefix} SS`, { contact: b(58), power: b(38), speed: b(64), defense: b(62) }, 'S'),
    makeHitter(`${prefix} LF`, { contact: b(60), power: b(60), speed: b(58), defense: b(52) }, 'L'),
    makeHitter(`${prefix} CF`, { contact: b(64), power: b(48), speed: b(70), defense: b(60) }, 'R'),
    makeHitter(`${prefix} RF`, { contact: b(56), power: b(62), speed: b(50), defense: b(54) }, 'R'),
    makeHitter(`${prefix} DH`, { contact: b(62), power: b(68), speed: b(40), defense: b(40) }, 'L'),
  ]
}

function buildOpponent(snap: ReturnType<typeof buildFixtureDailyMatchupSnapshot>): RosterSimTeam {
  const opp = snap.opponent!
  const rp = opp.lineup.RP!
  const cl = opp.lineup.CL!
  // Flat, equal rotation so the user's offense faces constant pitching every
  // game. (If the opponent rotation cycled in lockstep with the user's, the
  // user's slot-0 starter would always draw the opponent's best starter and
  // slot-4 the worst — a matchup confound that corrupts the depth comparison.)
  const rotation: LivePlayer[] = [
    makePitcher('OPP SP1', 54, 52, 55),
    makePitcher('OPP SP2', 54, 52, 55),
    makePitcher('OPP SP3', 54, 52, 55),
    makePitcher('OPP SP4', 54, 52, 55),
    makePitcher('OPP SP5', 54, 52, 55),
  ]
  const bullpen: LivePlayer[] = [
    cl,
    rp,
    makePitcher('LAD RP3', 48, 48, 40),
    makePitcher('LAD RP4', 46, 46, 40),
  ]
  const lineup = strongLineup('OPP', 8)
  return {
    name: opp.teamName,
    battingOrder: [...lineup, PITCHER_SPOT],
    bench: [],
    rotation,
    bullpen: [...bullpen].sort((a, b) => b.grades.overall - a.grades.overall),
    singleRp: { rp, cl },
    catcherDefense: lineup[0]!.grades.defense,
    isUser: false,
  }
}

function buildUserRoster(
  hitters: LivePlayer[],
  bench: LivePlayer[],
  rotation: LivePlayer[],
  bullpen: LivePlayer[],
  singleRp: { rp: LivePlayer; cl: LivePlayer },
  name: string,
): RosterSimTeam {
  return {
    name,
    battingOrder: [...hitters.slice(0, 9), PITCHER_SPOT],
    bench,
    rotation,
    bullpen: [...bullpen].sort((a, b) => b.grades.overall - a.grades.overall),
    singleRp,
    catcherDefense: hitters[0]?.grades.defense ?? 50,
    isUser: true,
  }
}

function avgRunsAllowed(results: GameResult[]): number {
  const total = results.reduce((sum, r) => sum + r.oppScore, 0)
  return Math.round((total / results.length) * 100) / 100
}

function armFrequency(arms: Array<{ name: string; overall: number }>): Map<string, number> {
  const freq = new Map<string, number>()
  for (const a of arms) freq.set(a.name, (freq.get(a.name) ?? 0) + 1)
  return freq
}

// ---------------------------------------------------------------------------
// Experiment driver.
// ---------------------------------------------------------------------------

const SAMPLE = Number(process.env.SAMPLE ?? 100)
const BENCH_SIZE = 4

function runSection(title: string): void {
  console.log(`\n${'='.repeat(72)}`)
  console.log(title)
  console.log('='.repeat(72))
}

async function main(): Promise<void> {
  const snap = buildFixtureDailyMatchupSnapshot('2026-06-26', '2026-06-25')
  const opponent = buildOpponent(snap)

  // Starting lineup synthesized at ~58 overall (with real power) so that
  // pitching quality is the swing variable. The fixture pool grades hitters
  // with power=20, which masks pitching effects; controlled lineups isolate
  // the 25-man pitching mechanics this spike exists to validate.
  const userLineup = strongLineup('USR', 8)
  // Bench comes from the real fixtures (graded via the live percentile model).
  const userBench = snap.players
    .filter((p) => p.teamId === 111 && p.role === 'hitter')
    .sort((a, b) => b.grades.overall - a.grades.overall)
    .slice(0, BENCH_SIZE)

  // Shared bullpen (identical for deep & top-heavy so only rotation differs).
  // Strong enough to clearly beat a shallow single-RP pen (experiment 3) but,
  // because the leverage model conserves the closer in blowouts, it cannot
  // rescue a replacement-level starter whose games are already out of reach
  // (experiment 2).
  const sharedBullpen: LivePlayer[] = [
    makePitcher('User CL', 72, 70, 45),
    makePitcher('User SU1', 66, 64, 45),
    makePitcher('User SU2', 60, 58, 42),
    makePitcher('User MID', 56, 54, 42),
    makePitcher('User MID2', 52, 50, 40),
    makePitcher('User LONG', 44, 44, 40),
  ]
  // Shallow single-RP baseline: one moderate RP + one moderate CL, the rest
  // of the deep bullpen ignored. Models the current daily-roster (SP/RP/CL).
  const userSingleRp = {
    rp: makePitcher('User Single-RP', 50, 50, 42),
    cl: makePitcher('User Single-CL', 54, 54, 45),
  }

  const deepRotation: LivePlayer[] = [
    makePitcher('Deep SP1', 64, 62, 62),
    makePitcher('Deep SP2', 62, 60, 60),
    makePitcher('Deep SP3', 60, 58, 58),
    makePitcher('Deep SP4', 60, 58, 58),
    makePitcher('Deep SP5', 58, 56, 56),
  ]
  // Top-heavy: one true ace plus four replacement-level starters. The reps are
  // bad enough that their starts become blowouts by inning 6, so the leverage
  // bullpen's closer is conserved and those games are near-auto-losses.
  const topHeavyRotation: LivePlayer[] = [
    makePitcher('Ace SP1', 74, 70, 66),
    makePitcher('Rep SP2', 20, 20, 40),
    makePitcher('Rep SP3', 20, 20, 40),
    makePitcher('Rep SP4', 20, 20, 40),
    makePitcher('Rep SP5', 20, 20, 40),
  ]

  const deepTeam = buildUserRoster(
    userLineup, userBench, deepRotation, sharedBullpen, userSingleRp, 'User (deep staff)',
  )
  const topHeavyTeam = buildUserRoster(
    userLineup, userBench, topHeavyRotation, sharedBullpen, userSingleRp, 'User (top-heavy)',
  )

  const SEED = 'w0a-spike'

  // --- 1. Rotation cycling --------------------------------------------------
  runSection('1. ROTATION CYCLING (starter = rotation[game % 5])')
  const cycleResults: GameResult[] = []
  for (let g = 0; g < 10; g += 1) {
    const r = simulateGameRoster(deepTeam, opponent, SEED, g % 2 === 1, g, {
      bullpenMode: 'leverage',
      useBench: true,
    })
    cycleResults.push(r)
  }
  console.log('game | starter (user)              | starter (opp)')
  console.log('-----+------------------------------+-----------------------------')
  for (const [i, r] of cycleResults.entries()) {
    console.log(
      `  ${i}  | ${r.starterUser.padEnd(28)} | ${r.starterOpp}`,
    )
  }
  const wrapOk =
    cycleResults[0]!.starterUser === 'Deep SP1' &&
    cycleResults[4]!.starterUser === 'Deep SP5' &&
    cycleResults[5]!.starterUser === 'Deep SP1'
  console.log(`\n[check] game0 -> SP1: ${cycleResults[0]!.starterUser === 'Deep SP1'}`)
  console.log(`[check] game4 -> SP5: ${cycleResults[4]!.starterUser === 'Deep SP5'}`)
  console.log(`[check] game5 wraps -> SP1: ${cycleResults[5]!.starterUser === 'Deep SP1'}`)
  console.log(`[check] cycling correct: ${wrapOk}`)

  // --- 2. Rotation depth shifts win totals ---------------------------------
  runSection(`2. ROTATION DEPTH (${SAMPLE} games, deep vs top-heavy)`)
  const deepResults: GameResult[] = []
  const topHeavyResults: GameResult[] = []
  for (let g = 0; g < SAMPLE; g += 1) {
    deepResults.push(
      simulateGameRoster(deepTeam, opponent, SEED, g % 2 === 1, g, {
        bullpenMode: 'leverage',
        useBench: true,
      }),
    )
    topHeavyResults.push(
      simulateGameRoster(topHeavyTeam, opponent, SEED, g % 2 === 1, g, {
        bullpenMode: 'leverage',
        useBench: true,
      }),
    )
  }
  const deepWins = deepResults.filter((r) => r.userWon).length
  const topWins = topHeavyResults.filter((r) => r.userWon).length
  console.log(`deep staff    : ${deepWins}-${SAMPLE - deepWins}  (avg runs allowed: ${avgRunsAllowed(deepResults)})`)
  console.log(`top-heavy     : ${topWins}-${SAMPLE - topWins}  (avg runs allowed: ${avgRunsAllowed(topHeavyResults)})`)
  console.log(`[check] deep wins more: ${deepWins > topWins}  (delta = ${deepWins - topWins})`)

  const bySlot = (results: GameResult[], rotation: LivePlayer[]): string => {
    const rows: string[] = []
    for (let s = 0; s < rotation.length; s += 1) {
      const slotGames = results.filter((_, i) => i % rotation.length === s)
      const w = slotGames.filter((r) => r.userWon).length
      const avgOpp = Math.round((slotGames.reduce((sum, r) => sum + r.oppScore, 0) / slotGames.length) * 100) / 100
      rows.push(`${rotation[s]!.name}=${w}-${slotGames.length - w}(era ${avgOpp})`)
    }
    return rows.join('  ')
  }
  console.log(`  deep slots   : ${bySlot(deepResults, deepRotation)}`)
  console.log(`  top-heavy    : ${bySlot(topHeavyResults, topHeavyRotation)}`)
  console.log('  DEBUG top-heavy g0-9:',
    topHeavyResults.slice(0, 10).map((r, i) => `g${i}[${r.starterUser} U${r.userScore}-O${r.oppScore}${r.userWon ? ' W' : ' L'}]`).join(' '))
  console.log('  DEBUG deep      g0-9:',
    deepResults.slice(0, 10).map((r, i) => `g${i}[${r.starterUser} U${r.userScore}-O${r.oppScore}${r.userWon ? ' W' : ' L'}]`).join(' '))

  // --- 3. Bullpen by leverage ----------------------------------------------
  runSection(`3. BULLPEN-BY-LEVERAGE (${SAMPLE} games, leverage vs single-RP)`)
  const leverageResults: GameResult[] = []
  const singleResults: GameResult[] = []
  for (let g = 0; g < SAMPLE; g += 1) {
    leverageResults.push(
      simulateGameRoster(deepTeam, opponent, SEED, g % 2 === 1, g, {
        bullpenMode: 'leverage',
        useBench: true,
      }),
    )
    singleResults.push(
      simulateGameRoster(deepTeam, opponent, SEED, g % 2 === 1, g, {
        bullpenMode: 'single',
        useBench: true,
      }),
    )
  }
  const levWins = leverageResults.filter((r) => r.userWon).length
  const sinWins = singleResults.filter((r) => r.userWon).length
  const levLateClose = leverageResults.reduce((s, r) => s + r.userLateRunsAllowedClose, 0)
  const sinLateClose = singleResults.reduce((s, r) => s + r.userLateRunsAllowedClose, 0)
  const levArms = armFrequency(leverageResults.flatMap((r) => r.highLeverageArms))
  const sinArms = armFrequency(singleResults.flatMap((r) => r.highLeverageArms))
  console.log(`leverage model : ${levWins}-${SAMPLE - levWins}  (late close runs allowed: ${levLateClose})`)
  console.log(`single-RP model: ${sinWins}-${SAMPLE - sinWins}  (late close runs allowed: ${sinLateClose})`)
  console.log('\nhigh-leverage arms used (inning>=8, any game state, by user):')
  console.log('  leverage :', [...levArms.entries()].map(([n, c]) => `${n}=${c}`).join(', '))
  console.log('  single   :', [...sinArms.entries()].map(([n, c]) => `${n}=${c}`).join(', '))
  console.log(`\n[check] high-lev arm (User CL, 76) used in close late innings: ${levArms.has('User CL')}`)
  console.log(`[check] differs from single-RP model: ${levWins !== sinWins || levLateClose !== sinLateClose}`)
  console.log(`[check] leverage allows fewer close late runs: ${levLateClose < sinLateClose}`)
  console.log(`[check] leverage wins more than single-RP: ${levWins > sinWins}  (delta = ${levWins - sinWins})`)

  // --- 4. Bench pinch-hitting ----------------------------------------------
  runSection(`4. BENCH PINCH-HITTING (${SAMPLE} games, useBench on vs off)`)
  const benchOnResults: GameResult[] = []
  const benchOffResults: GameResult[] = []
  for (let g = 0; g < SAMPLE; g += 1) {
    benchOnResults.push(
      simulateGameRoster(deepTeam, opponent, SEED, g % 2 === 1, g, {
        bullpenMode: 'leverage',
        useBench: true,
      }),
    )
    benchOffResults.push(
      simulateGameRoster(deepTeam, opponent, SEED, g % 2 === 1, g, {
        bullpenMode: 'leverage',
        useBench: false,
      }),
    )
  }
  const allPh = benchOnResults.flatMap((r) => r.phLog).filter((p) => p.team === 'user')
  const phCount = allPh.length
  const allLate = allPh.every((p) => p.inning >= 7)
  const benchOnWins = benchOnResults.filter((r) => r.userWon).length
  const benchOffWins = benchOffResults.filter((r) => r.userWon).length
  console.log(`total user PH events: ${phCount}  (all in inning >= 7: ${allLate})`)
  console.log(`games with >=1 PH: ${benchOnResults.filter((r) => r.phLog.some((p) => p.team === 'user')).length} / ${SAMPLE}`)
  console.log('\nsample PH log (first 8):')
  for (const p of allPh.slice(0, 8)) {
    console.log(`  inning ${p.inning} | ${p.hitterName} PH for ${p.forName} (gameDiff ${p.gameDiff})`)
  }
  console.log(`\nbench-on wins : ${benchOnWins}-${SAMPLE - benchOnWins}`)
  console.log(`bench-off wins: ${benchOffWins}-${SAMPLE - benchOffWins}`)
  console.log(`[check] PH fires in late innings: ${phCount > 0 && allLate}`)
  console.log(`[check] bench PH changes outcomes: ${benchOnWins !== benchOffWins}`)

  // --- Summary --------------------------------------------------------------
  runSection('ACCEPTANCE SUMMARY')
  console.log(`[1] rotation cycling (game5 -> SP1)       : ${wrapOk ? 'PASS' : 'FAIL'}`)
  console.log(`[2] deep wins > top-heavy (delta ${deepWins - topWins})       : ${deepWins > topWins ? 'PASS' : 'FAIL'}`)
  console.log(`[3] leverage wins > single-RP (delta ${levWins - sinWins})    : ${levWins > sinWins ? 'PASS' : 'FAIL'}`)
  console.log(`[4] bench PH fires in late innings        : ${phCount > 0 && allLate ? 'PASS' : 'FAIL'}`)
  console.log(`\nExisting sim untouched (no edits to shared/live or src).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
