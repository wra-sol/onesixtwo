import { createSeededRandomFromString } from './rng'
import { playSeries } from './series-sim'
import { lineupSeriesGameSeed, rosterSeriesGameSeed } from './seeds'
import type {
  LivePlayer,
  PaEvent,
  SimBoxScore,
  SimulatedGame,
  SimulatedSeries,
} from './live-types'
import type { DailyBattingOrder, DailyLineup } from './daily-roster'
import { DAILY_PITCHER_POSITIONS } from './daily-roster'

export type SimTeam = {
  name: string
  battingOrder: LivePlayer[]
  lineup: DailyLineup
  isUser: boolean
}

function gradeNorm(grade: number | undefined, fallback = 50): number {
  return (grade ?? fallback) / 50
}

function platoonModifier(
  batter: LivePlayer,
  pitcher: LivePlayer,
): number {
  const bat = batter.batSide ?? 'R'
  const hand = pitcher.pitchHand ?? 'R'
  if (bat === 'S') return 1
  if (bat === 'L' && hand === 'R') return 1.03
  if (bat === 'R' && hand === 'L') return 1.03
  if (bat === 'L' && hand === 'L') return 0.97
  if (bat === 'R' && hand === 'R') return 0.97
  return 1
}

export function paProbabilities(batter: LivePlayer, pitcher: LivePlayer, defense: number) {
  const contact = gradeNorm(batter.grades.contact) * platoonModifier(batter, pitcher)
  const power = gradeNorm(batter.grades.power)
  const stuff = gradeNorm(pitcher.grades.stuff)
  const command = gradeNorm(pitcher.grades.command)
  const defenseFactor = gradeNorm(defense, 50)

  const kRate = Math.max(0.08, Math.min(0.35, 0.22 * stuff / contact))
  const bbRate = Math.max(0.04, Math.min(0.18, 0.08 * (1 / command) * contact))
  const hrRate = Math.max(0.01, Math.min(0.12, 0.04 * power * (2 - stuff) * 0.5))
  const tripleRate = 0.004 * gradeNorm(batter.grades.speed)
  const doubleRate = Math.max(0.02, Math.min(0.08, 0.04 * power * 0.8))
  const singleRate = Math.max(
    0.1,
    0.28 * contact * (2 - stuff) * defenseFactor * 0.4,
  )
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

export function pickOutcome(
  probs: ReturnType<typeof paProbabilities>,
  random: () => number,
): PaEvent['type'] {
  const roll = random()
  let acc = 0
  const entries: Array<[PaEvent['type'], number]> = [
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

function emptyBox(): SimBoxScore {
  return { runs: 0, hits: 0, errors: 0, homeRuns: 0 }
}

function getPitcher(lineup: DailyLineup, role: 'SP' | 'RP' | 'CL'): LivePlayer {
  return lineup[role]!
}

function defenseForCatcher(lineup: DailyLineup): number {
  const catcher = lineup.C
  return catcher?.grades.defense ?? 50
}

/**
 * The single half-inning engine. HOW a plate appearance's batter and pitcher
 * are chosen lives in strategy callbacks; the baseball itself — steal
 * attempts, outcome-to-bases rules, run scoring, event emission — exists here
 * exactly once. Strategies must not draw from `random`; the only draws are
 * pickOutcome and the steal roll, in that order, so seed streams stay stable.
 */
function playHalfInning(options: {
  inning: number
  half: 'top' | 'bottom'
  random: () => number
  events: PaEvent[]
  catcherDefense: number
  battingOrderLength: number
  /** Called once per plate appearance; may substitute (pinch hit). */
  nextBatter: (pitcher: LivePlayer) => { batter: LivePlayer }
  /** Runs scored by this offense so far in the half are passed in. */
  pitcherFor: (halfRunsSoFar: number) => LivePlayer
}): number {
  let outs = 0
  let runs = 0
  const bases = [false, false, false]

  while (outs < 3) {
    const pitcher = options.pitcherFor(runs)
    const batter = options.nextBatter(pitcher).batter

    const probs = paProbabilities(batter, pitcher, options.catcherDefense)
    const outcome = pickOutcome(probs, options.random)

    if (
      outcome !== 'strikeout' &&
      outcome !== 'walk' &&
      bases[0] &&
      options.random() < gradeNorm(batter.grades.speed) * 0.08
    ) {
      const caught = options.random() < options.catcherDefense / 200
      options.events.push({
        inning: options.inning,
        half: options.half,
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
      options.events.push({
        inning: options.inning,
        half: options.half,
        batterName: batter.name,
        pitcherName: pitcher.name,
        type: 'run_scored',
        description: `${batter.name} drives in ${runsScored} run(s)`,
        runsScored,
      })
    }

    options.events.push({
      inning: options.inning,
      half: options.half,
      batterName: batter.name,
      pitcherName: pitcher.name,
      type: outcome,
      description,
      runsScored,
    })
  }

  return runs
}

function simulateHalfInning(
  offense: SimTeam,
  defense: SimTeam,
  inning: number,
  half: 'top' | 'bottom',
  random: () => number,
  events: PaEvent[],
): number {
  // Classic convention: order counter resets every half-inning; bullpen is
  // three fixed roles chosen by inning and half-inning closeness.
  let orderIndex = 0
  const sp = getPitcher(defense.lineup, 'SP')
  const rp = getPitcher(defense.lineup, 'RP')
  const cl = getPitcher(defense.lineup, 'CL')

  return playHalfInning({
    inning,
    half,
    random,
    events,
    catcherDefense: defenseForCatcher(defense.lineup),
    battingOrderLength: offense.battingOrder.length,
    pitcherFor: (halfRuns) => {
      if (inning >= 8 && Math.abs(halfRuns) <= 2) return cl
      if (inning >= 6) return rp
      return sp
    },
    nextBatter: () => {
      const batter = offense.battingOrder[orderIndex % offense.battingOrder.length]!
      orderIndex += 1
      return { batter }
    },
  })
}

export function simulateGame(
  user: SimTeam,
  opponent: SimTeam,
  seed: string,
  userIsHome: boolean,
): SimulatedGame {
  const random = createSeededRandomFromString(seed)
  const events: PaEvent[] = []
  let awayRuns = 0
  let homeRuns = 0
  const awayBox = emptyBox()
  const homeBox = emptyBox()

  const away = userIsHome ? opponent : user
  const home = userIsHome ? user : opponent

  for (let inning = 1; inning <= 9; inning += 1) {
    const topRuns = simulateHalfInning(away, home, inning, 'top', random, events)
    awayRuns += topRuns
    awayBox.runs += topRuns

    const bottomRuns = simulateHalfInning(home, away, inning, 'bottom', random, events)
    homeRuns += bottomRuns
    homeBox.runs += bottomRuns
  }

  let extra = 10
  while (awayRuns === homeRuns && extra <= 15) {
    const topRuns = simulateHalfInning(away, home, extra, 'top', random, events)
    awayRuns += topRuns
    awayBox.runs += topRuns
    const bottomRuns = simulateHalfInning(home, away, extra, 'bottom', random, events)
    homeRuns += bottomRuns
    homeBox.runs += bottomRuns
    extra += 1
  }

  for (const event of events) {
    const box = event.half === 'top' ? awayBox : homeBox
    if (event.type === 'single' || event.type === 'double' || event.type === 'triple') {
      box.hits += 1
    }
    if (event.type === 'home_run') {
      box.hits += 1
      box.homeRuns += 1
    }
  }

  return {
    homeScore: homeRuns,
    awayScore: awayRuns,
    homeBox,
    awayBox,
    events,
    userWasHome: userIsHome,
  }
}

export function simulateBestOfThree(
  user: SimTeam,
  opponent: SimTeam,
  baseSeed: string,
): SimulatedSeries {
  // Daily Matchup / Live Draft convention: user bats away first, tied games
  // stand (a 1-1-1 series has no winner). Game seed suffix must stay stable —
  // stored leaderboard rows re-sim from these seeds.
  return playSeries({
    bestOf: 3,
    seed: baseSeed,
    userHomeParity: 'odd',
    tiePolicy: 'stand',
    simulateGame: (i, userIsHome) =>
      simulateGame(user, opponent, lineupSeriesGameSeed(baseSeed, i), userIsHome),
  })
}

export function buildSimTeam(
  name: string,
  lineup: DailyLineup,
  battingOrder: DailyBattingOrder,
  isUser: boolean,
): SimTeam {
  for (const pos of DAILY_PITCHER_POSITIONS) {
    if (!lineup[pos]) {
      throw new Error(`Missing pitcher at ${pos}`)
    }
  }
  if (battingOrder.length !== 9) {
    throw new Error('Batting order must have 9 hitters')
  }
  return { name, battingOrder, lineup, isUser }
}

export type RosterSimTeam = {
  name: string
  battingOrder: LivePlayer[]
  bench: LivePlayer[]
  rotation: LivePlayer[]
  bullpen: LivePlayer[]
  catcherDefense: number
  isUser: boolean
}

export function buildRosterSimTeam(
  name: string,
  battingOrder: LivePlayer[],
  bench: LivePlayer[],
  rotation: LivePlayer[],
  bullpen: LivePlayer[],
  catcherDefense: number,
  isUser: boolean,
): RosterSimTeam {
  if (battingOrder.length !== 9) {
    throw new Error('RosterSimTeam battingOrder must have 9 hitters')
  }
  if (rotation.length === 0) {
    throw new Error('RosterSimTeam rotation must have at least 1 starter')
  }
  return {
    name,
    battingOrder,
    bench,
    rotation,
    bullpen: [...bullpen].sort((a, b) => b.grades.overall - a.grades.overall),
    catcherDefense,
    isUser,
  }
}

function selectRosterPitcher(
  defense: RosterSimTeam,
  inning: number,
  offCurrentRuns: number,
  defGameRuns: number,
  starter: LivePlayer,
): LivePlayer {
  if (inning <= 5) return starter
  if (defense.bullpen.length === 0) return starter
  const gameDiff = defGameRuns - offCurrentRuns
  if (inning >= 8) {
    const close = Math.abs(gameDiff) <= 2
    return close
      ? defense.bullpen[0]!
      : defense.bullpen[defense.bullpen.length - 1]!
  }
  const mid = Math.floor(defense.bullpen.length / 2)
  return defense.bullpen[mid]!
}

function simulateHalfInningRoster(
  offense: RosterSimTeam,
  defense: RosterSimTeam,
  inning: number,
  half: 'top' | 'bottom',
  random: () => number,
  events: PaEvent[],
  ctx: {
    starter: LivePlayer
    offGameRuns: number
    defGameRuns: number
    orderIndex: { i: number }
    benchUsed: Set<string>
  },
): number {
  // Roster convention: the order persists across innings, late-inning final
  // slots may pinch-hit from the bench, and pitching changes follow leverage.
  return playHalfInning({
    inning,
    half,
    random,
    events,
    catcherDefense: defense.catcherDefense,
    battingOrderLength: offense.battingOrder.length,
    pitcherFor: (halfRuns) =>
      selectRosterPitcher(
        defense,
        inning,
        ctx.offGameRuns + halfRuns,
        ctx.defGameRuns,
        ctx.starter,
      ),
    nextBatter: (pitcher) => {
      const dueIndex = ctx.orderIndex.i
      ctx.orderIndex.i += 1
      const slot = dueIndex % offense.battingOrder.length
      const due = offense.battingOrder[slot]!

      if (inning >= 7 && slot === offense.battingOrder.length - 1) {
        const available = offense.bench.filter((b) => !ctx.benchUsed.has(b.id))
        if (available.length > 0) {
          const ph = [...available].sort((a, b) => b.grades.overall - a.grades.overall)[0]!
          ctx.benchUsed.add(ph.id)
          events.push({
            inning,
            half,
            batterName: ph.name,
            pitcherName: pitcher.name,
            type: 'pinch_hit',
            description: `${ph.name} pinch-hits for ${due.name}`,
            runsScored: 0,
          })
          return { batter: ph }
        }
      }
      return { batter: due }
    },
  })
}

export function simulateGameRoster(
  user: RosterSimTeam,
  opponent: RosterSimTeam,
  seed: string,
  userIsHome: boolean,
  gameIndex: number,
): SimulatedGame {
  const random = createSeededRandomFromString(rosterSeriesGameSeed(seed, gameIndex))
  const userStarter = user.rotation[gameIndex % user.rotation.length]!
  const oppStarter = opponent.rotation[gameIndex % opponent.rotation.length]!
  const away = userIsHome ? opponent : user
  const home = userIsHome ? user : opponent

  let awayRuns = 0
  let homeRuns = 0
  const events: PaEvent[] = []
  const awayBox = emptyBox()
  const homeBox = emptyBox()
  const orderIndexAway = { i: 0 }
  const orderIndexHome = { i: 0 }
  const benchUsedAway = new Set<string>()
  const benchUsedHome = new Set<string>()

  const playInning = (inning: number) => {
    const topRuns = simulateHalfInningRoster(away, home, inning, 'top', random, events, {
      starter: home === user ? userStarter : oppStarter,
      offGameRuns: awayRuns,
      defGameRuns: homeRuns,
      orderIndex: orderIndexAway,
      benchUsed: benchUsedAway,
    })
    awayRuns += topRuns
    awayBox.runs += topRuns

    const bottomRuns = simulateHalfInningRoster(home, away, inning, 'bottom', random, events, {
      starter: away === user ? userStarter : oppStarter,
      offGameRuns: homeRuns,
      defGameRuns: awayRuns,
      orderIndex: orderIndexHome,
      benchUsed: benchUsedHome,
    })
    homeRuns += bottomRuns
    homeBox.runs += bottomRuns
  }

  for (let inning = 1; inning <= 9; inning += 1) playInning(inning)
  let extra = 10
  while (awayRuns === homeRuns && extra <= 20) {
    playInning(extra)
    extra += 1
  }

  for (const event of events) {
    const box = event.half === 'top' ? awayBox : homeBox
    if (event.type === 'single' || event.type === 'double' || event.type === 'triple') {
      box.hits += 1
    }
    if (event.type === 'home_run') {
      box.hits += 1
      box.homeRuns += 1
    }
  }

  return {
    homeScore: homeRuns,
    awayScore: awayRuns,
    homeBox,
    awayBox,
    events,
    userWasHome: userIsHome,
  }
}
