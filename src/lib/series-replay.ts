import type {
  PaEventType,
  SimulatedGame,
  SimulatedSeries,
} from '@shared/live/live-types'

export type BaseState = {
  first: boolean
  second: boolean
  third: boolean
}

export type ReplayFrame = {
  gameIndex: number
  eventIndex: number
  inning: number
  half: 'top' | 'bottom'
  battingSide: 'user' | 'opponent'
  batterName: string
  pitcherName: string
  pitcherRole: 'SP' | 'RP' | 'CL'
  type: PaEventType
  description: string
  runsScoredOnPlay: number
  basesAfter: BaseState
  outsAfter: number
  scoreAfter: { user: number; opponent: number }
  isHighlight: boolean
  isPitcherChange: boolean
  isWalkOff: boolean
}

export type PerformerStat = {
  name: string
  hits: number
  homeRuns: number
  rbi: number
}

export type HeadlineMoment = {
  description: string
  gameIndex: number
}

const EMPTY_BASES: BaseState = { first: false, second: false, third: false }

const OUTCOME_TYPES: ReadonlySet<PaEventType> = new Set([
  'strikeout',
  'walk',
  'single',
  'double',
  'triple',
  'home_run',
  'out',
])

function isHighlightType(type: PaEventType, runsScored: number): boolean {
  if (type === 'home_run' || type === 'triple') return true
  if (type === 'steal' || type === 'caught_stealing') return true
  if (runsScored > 0) return true
  return false
}

function pitcherRoleFor(inning: number, halfInningRuns: number): 'SP' | 'RP' | 'CL' {
  if (inning >= 8 && halfInningRuns <= 2) return 'CL'
  if (inning >= 6) return 'RP'
  return 'SP'
}

function applyOutcome(
  type: PaEventType,
  bases: BaseState,
): { runsScored: number; bases: BaseState; addedOut: boolean } {
  const b = { ...bases }
  let runsScored = 0
  let addedOut = false

  switch (type) {
    case 'strikeout':
      addedOut = true
      break
    case 'walk':
      if (b.first && b.second && b.third) runsScored = 1
      if (b.first && b.second) b.third = true
      if (b.first) b.second = true
      b.first = true
      break
    case 'single':
      runsScored = (b.third ? 1 : 0) + (b.second ? 1 : 0)
      b.second = b.first
      b.first = true
      b.third = false
      break
    case 'double':
      runsScored = (b.third ? 1 : 0) + (b.second ? 1 : 0) + (b.first ? 1 : 0)
      b.third = true
      b.second = false
      b.first = false
      break
    case 'triple':
      runsScored = (b.first ? 1 : 0) + (b.second ? 1 : 0) + (b.third ? 1 : 0)
      b.first = true
      b.second = false
      b.third = false
      break
    case 'home_run':
      runsScored = 1 + (b.first ? 1 : 0) + (b.second ? 1 : 0) + (b.third ? 1 : 0)
      b.first = false
      b.second = false
      b.third = false
      break
    default:
      addedOut = true
      break
  }

  return { runsScored, bases: b, addedOut }
}

export function buildReplay(game: SimulatedGame, gameIndex: number): ReplayFrame[] {
  const frames: ReplayFrame[] = []
  const userIsHome = game.userWasHome

  let bases: BaseState = { ...EMPTY_BASES }
  let outs = 0
  let awayRuns = 0
  let homeRuns = 0
  let halfInningRuns = 0
  let currentHalf = ''
  let prevRole: 'SP' | 'RP' | 'CL' | null = null

  for (const event of game.events) {
    const halfKey = `${event.inning}-${event.half}`
    if (halfKey !== currentHalf) {
      currentHalf = halfKey
      bases = { ...EMPTY_BASES }
      outs = 0
      halfInningRuns = 0
    }

    if (event.type === 'run_scored') {
      continue
    }

    const battingSide: 'user' | 'opponent' =
      event.half === 'top'
        ? userIsHome
          ? 'opponent'
          : 'user'
        : userIsHome
          ? 'user'
          : 'opponent'

    const role = pitcherRoleFor(event.inning, halfInningRuns)
    const isPitcherChange = prevRole !== null && role !== prevRole
    prevRole = role

    let runsOnPlay: number
    let basesAfter: BaseState
    let outsAfter: number

    if (event.type === 'caught_stealing') {
      outs += 1
      bases = { ...bases, first: false }
      outsAfter = outs
      basesAfter = bases
      runsOnPlay = 0
    } else if (OUTCOME_TYPES.has(event.type)) {
      const result = applyOutcome(event.type, bases)
      bases = result.bases
      runsOnPlay = result.runsScored
      if (result.addedOut) outs += 1
      outsAfter = outs
      basesAfter = bases
      if (event.half === 'top') awayRuns += runsOnPlay
      else homeRuns += runsOnPlay
      halfInningRuns += runsOnPlay
    } else {
      basesAfter = bases
      outsAfter = outs
      runsOnPlay = 0
    }

    const homeBefore = homeRuns - (event.half === 'bottom' ? runsOnPlay : 0)
    const awayBefore = awayRuns - (event.half === 'top' ? runsOnPlay : 0)
    const isWalkOff =
      event.inning >= 9 &&
      event.half === 'bottom' &&
      runsOnPlay > 0 &&
      homeBefore <= awayBefore &&
      homeRuns > awayRuns

    const scoreAfter = userIsHome
      ? { user: homeRuns, opponent: awayRuns }
      : { user: awayRuns, opponent: homeRuns }

    const isHighlight = isHighlightType(event.type, runsOnPlay)

    frames.push({
      gameIndex,
      eventIndex: frames.length,
      inning: event.inning,
      half: event.half,
      battingSide,
      batterName: event.batterName,
      pitcherName: event.pitcherName,
      pitcherRole: role,
      type: event.type,
      description: event.description,
      runsScoredOnPlay: runsOnPlay,
      basesAfter,
      outsAfter,
      scoreAfter,
      isHighlight,
      isPitcherChange,
      isWalkOff,
    })
  }

  return frames
}

export function buildSeriesReplay(series: SimulatedSeries): ReplayFrame[][] {
  return series.games.map((game, index) => buildReplay(game, index))
}

function sideOfEvent(
  half: 'top' | 'bottom',
  userIsHome: boolean,
): 'user' | 'opponent' {
  if (half === 'top') return userIsHome ? 'opponent' : 'user'
  return userIsHome ? 'user' : 'opponent'
}

export function topPerformers(
  series: SimulatedSeries,
  side: 'user' | 'opponent',
  limit = 3,
): PerformerStat[] {
  const stats = new Map<string, PerformerStat>()

  for (const game of series.games) {
    for (const event of game.events) {
      if (sideOfEvent(event.half, game.userWasHome) !== side) continue

      const entry =
        stats.get(event.batterName) ??
        { name: event.batterName, hits: 0, homeRuns: 0, rbi: 0 }

      if (
        event.type === 'single' ||
        event.type === 'double' ||
        event.type === 'triple' ||
        event.type === 'home_run'
      ) {
        entry.hits += 1
        if (event.type === 'home_run') entry.homeRuns += 1
      }

      if (event.type === 'run_scored') {
        entry.rbi += event.runsScored
      }

      stats.set(event.batterName, entry)
    }
  }

  return [...stats.values()]
    .sort(
      (a, b) =>
        b.homeRuns - a.homeRuns || b.rbi - a.rbi || b.hits - a.hits,
    )
    .slice(0, limit)
}

function scoreBeforeFrame(
  frames: ReplayFrame[],
  index: number,
): { user: number; opponent: number } {
  if (index === 0) return { user: 0, opponent: 0 }
  return frames[index - 1]!.scoreAfter
}

export function headlineMoment(series: SimulatedSeries): HeadlineMoment {
  const frames: ReplayFrame[] = buildSeriesReplay(series).flat()

  const walkOffHr = frames.find((f) => f.isWalkOff && f.type === 'home_run')
  if (walkOffHr) {
    return { description: walkOffHr.description, gameIndex: walkOffHr.gameIndex }
  }

  const walkOffRbi = frames.find((f) => f.isWalkOff && f.runsScoredOnPlay > 0)
  if (walkOffRbi) {
    return { description: walkOffRbi.description, gameIndex: walkOffRbi.gameIndex }
  }

  for (let i = 0; i < frames.length; i += 1) {
    const f = frames[i]!
    if (f.inning >= 8 && f.runsScoredOnPlay > 0 && !f.isWalkOff) {
      const before = scoreBeforeFrame(frames, i)
      const bat = f.battingSide
      const other = bat === 'user' ? 'opponent' : 'user'
      if (before[bat] <= before[other] && f.scoreAfter[bat] > f.scoreAfter[other]) {
        return { description: f.description, gameIndex: f.gameIndex }
      }
    }
  }

  const slam = frames.find((f) => f.type === 'home_run' && f.runsScoredOnPlay === 4)
  if (slam) return { description: slam.description, gameIndex: slam.gameIndex }

  const highRbi = frames
    .filter((f) => f.runsScoredOnPlay > 0)
    .sort((a, b) => b.runsScoredOnPlay - a.runsScoredOnPlay)[0]
  if (highRbi) {
    return { description: highRbi.description, gameIndex: highRbi.gameIndex }
  }

  const firstHr = frames.find((f) => f.type === 'home_run')
  if (firstHr) return { description: firstHr.description, gameIndex: firstHr.gameIndex }

  const firstHighlight = frames.find((f) => f.isHighlight)
  if (firstHighlight) {
    return {
      description: firstHighlight.description,
      gameIndex: firstHighlight.gameIndex,
    }
  }

  return { description: 'Series complete', gameIndex: 0 }
}
