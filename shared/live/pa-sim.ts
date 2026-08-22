import { createSeededRandomFromString } from './rng'
import { playSeries } from './series-sim'
import { lineupSeriesGameSeed, rosterSeriesGameSeed } from './seeds'
import { gradeNorm, type PaOutcomeType } from './pa-outcomes'
import { resolvePlateAppearance, type PitcherCondition } from './count-engine'
import { type TeamStaffState, conditionFor, advanceRest, recordAppearance } from './staff-state'

export type { PaOutcomeType }
import type {
  LivePlayer,
  PaEvent,
  SimBoxScore,
  SimulatedGame,
  SimulatedSeries,
} from './live-types'
import type { DailyBattingOrder, DailyLineup } from './daily-roster'
import { DAILY_PITCHER_POSITIONS } from './daily-roster'

const FRESH_CONDITION: PitcherCondition = { stuffMult: 1, commandMult: 1 }

export type SimTeam = {
  name: string
  battingOrder: LivePlayer[]
  lineup: DailyLineup
  isUser: boolean
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
  /** Called once per plate appearance; may substitute (pinch hit). */
  nextBatter: (pitcher: LivePlayer) => { batter: LivePlayer }
  /** Runs scored by this offense so far in the half are passed in. */
  pitcherFor: (halfRunsSoFar: number) => LivePlayer
  /** Defensive staff state for fatigue/rest; absent = every arm fresh. */
  defenseStaff?: TeamStaffState
  /** Shared per-game pitch counts, keyed by pitcher id. */
  pitchCounts?: Map<string, number>
}): number {
  const conditionForPitcher = (pitcher: LivePlayer): PitcherCondition =>
    options.defenseStaff || options.pitchCounts
      ? conditionFor(pitcher, {
          staff: options.defenseStaff,
          currentGamePitches: options.pitchCounts?.get(pitcher.id),
        })
      : FRESH_CONDITION
  let outs = 0
  let runs = 0
  const bases = [false, false, false]

  while (outs < 3) {
    const pitcher = options.pitcherFor(runs)
    const batter = options.nextBatter(pitcher).batter

    const resolved = resolvePlateAppearance({
      batter,
      pitcher,
      catcherDefense: options.catcherDefense,
      condition: conditionForPitcher(pitcher),
      random: options.random,
    })
    if (options.pitchCounts) {
      options.pitchCounts.set(
        pitcher.id,
        (options.pitchCounts.get(pitcher.id) ?? 0) + resolved.pitches,
      )
    }

    if (
      resolved.outcome !== 'strikeout' &&
      resolved.outcome !== 'walk' &&
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

    const outcome = resolved.outcome
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
      pitches: resolved.pitches,
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
    defenseStaff?: TeamStaffState
    pitchCounts?: Map<string, number>
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
    defenseStaff: ctx.defenseStaff,
    pitchCounts: ctx.pitchCounts,
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

export type GameStaffContext = {
  user: TeamStaffState
  opponent: TeamStaffState
}

export function simulateGameRoster(
  user: RosterSimTeam,
  opponent: RosterSimTeam,
  seed: string,
  userIsHome: boolean,
  gameIndex: number,
  staffs?: GameStaffContext,
): SimulatedGame {
  const random = createSeededRandomFromString(rosterSeriesGameSeed(seed, gameIndex))
  // Rotation slot is plain modulo-5 by game index; rest/fatigue penalties
  // are applied through staff state at pitch time.

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

  const pitchCounts = new Map<string, number>()
  const awayStaff = staffs ? (away === user ? staffs.user : staffs.opponent) : undefined
  const homeStaff = staffs ? (home === user ? staffs.user : staffs.opponent) : undefined

  const playInning = (inning: number) => {
    const topRuns = simulateHalfInningRoster(away, home, inning, 'top', random, events, {
      starter: home === user ? userStarter : oppStarter,
      offGameRuns: awayRuns,
      defGameRuns: homeRuns,
      orderIndex: orderIndexAway,
      benchUsed: benchUsedAway,
      defenseStaff: homeStaff,
      pitchCounts,
    })
    awayRuns += topRuns
    awayBox.runs += topRuns

    const bottomRuns = simulateHalfInningRoster(home, away, inning, 'bottom', random, events, {
      starter: away === user ? userStarter : oppStarter,
      offGameRuns: homeRuns,
      defGameRuns: awayRuns,
      orderIndex: orderIndexHome,
      benchUsed: benchUsedHome,
      defenseStaff: awayStaff,
      pitchCounts,
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

  if (staffs) {
    for (const [id, pitches] of pitchCounts) {
      const isUserArm = user.battingOrder.some((p) => p.id === id) ||
        [...user.rotation, ...user.bullpen, ...user.bench].some((p) => p.id === id)
      recordAppearance(isUserArm ? staffs.user : staffs.opponent, id, pitches)
    }
    advanceRest(staffs.user)
    advanceRest(staffs.opponent)
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
