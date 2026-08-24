import { describe, expect, it } from 'vitest'
import {
  buildReplay,
  buildSeriesReplay,
  headlineMoment,
  topPerformers,
  topPitchers,
} from './series-replay'
import { buildSimTeam, simulateBestOfThree } from '@shared/live/pa-sim'
import { buildFixtureDailyMatchupSnapshot } from '@shared/live/live-fixtures'
import {
  createEmptyDailyLineup,
  DAILY_HITTER_POSITIONS,
} from '@shared/live/daily-roster'
import type {
  PaEvent,
  SimulatedGame,
  SimulatedSeries,
} from '@shared/live/live-types'

function buildUserTeam() {
  const snapshot = buildFixtureDailyMatchupSnapshot('2026-06-26', '2026-06-25')
  const lineup = createEmptyDailyLineup()
  const hitters = snapshot.players.filter((p) => p.role === 'hitter')
  const pitchers = snapshot.players.filter((p) => p.role === 'pitcher')
  DAILY_HITTER_POSITIONS.forEach((pos, i) => {
    lineup[pos] = hitters[i] ?? null
  })
  lineup.SP = pitchers[0] ?? null
  lineup.RP = pitchers[1] ?? null
  lineup.CL = pitchers[2] ?? null
  return buildSimTeam('You', lineup, hitters.slice(0, 9), true)
}

function buildOpponentTeam() {
  const snapshot = buildFixtureDailyMatchupSnapshot('2026-06-26', '2026-06-25')
  const lineup = createEmptyDailyLineup()
  for (const [pos, player] of Object.entries(snapshot.opponent!.lineup)) {
    if (player) {
      lineup[pos as keyof typeof lineup] = player
    }
  }
  return buildSimTeam(
    snapshot.opponent!.teamName,
    lineup,
    snapshot.opponent!.battingOrder,
    false,
  )
}

function buildSeries(seed: string): SimulatedSeries {
  return simulateBestOfThree(buildUserTeam(), buildOpponentTeam(), seed)
}

function syntheticGame(
  events: PaEvent[],
  opts: {
    userWasHome?: boolean
    homeScore?: number
    awayScore?: number
  } = {},
): SimulatedGame {
  const homeScore = opts.homeScore ?? 0
  const awayScore = opts.awayScore ?? 0
  return {
    homeScore,
    awayScore,
    homeBox: { runs: homeScore, hits: 0, errors: 0, homeRuns: 0 },
    awayBox: { runs: awayScore, hits: 0, errors: 0, homeRuns: 0 },
    events,
    userWasHome: opts.userWasHome ?? true,
  }
}

function pa(
  inning: number,
  half: 'top' | 'bottom',
  type: PaEvent['type'],
  batterName: string,
  runsScored = 0,
  pitcherName = 'P',
): PaEvent {
  return {
    inning,
    half,
    batterName,
    pitcherName,
    type,
    description: `${batterName} ${type.replace('_', ' ')}`,
    runsScored,
  }
}

const SEEDS = ['seed-a', 'seed-b', 'seed-c', 'seed-d', 'seed-e']

describe('buildReplay — score invariant', () => {
  for (const seed of SEEDS) {
    it(`reconstructed final score matches box score for ${seed}`, () => {
      const series = buildSeries(seed)
      for (const [gameIndex, game] of series.games.entries()) {
        const frames = buildReplay(game, gameIndex)
        expect(frames.length).toBeGreaterThan(0)
        const last = frames[frames.length - 1]!
        const userScore = game.userWasHome ? game.homeScore : game.awayScore
        const oppScore = game.userWasHome ? game.awayScore : game.homeScore
        expect(last.scoreAfter.user).toBe(userScore)
        expect(last.scoreAfter.opponent).toBe(oppScore)
      }
    })
  }
})

describe('buildReplay — outs invariant', () => {
  it('no half-inning exceeds 3 outs and completed halves reach 3', () => {
    const series = buildSeries('seed-a')
    for (const [gameIndex, game] of series.games.entries()) {
      const frames = buildReplay(game, gameIndex)
      const halfLastOut = new Map<string, number>()
      for (const f of frames) {
        expect(f.outsAfter).toBeLessThanOrEqual(3)
        halfLastOut.set(`${f.inning}-${f.half}`, f.outsAfter)
      }
      for (const outs of halfLastOut.values()) {
        expect(outs).toBe(3)
      }
    }
  })
})

describe('buildReplay — run_scored does not double-count', () => {
  it('skips run_scored events for state and score', () => {
    const events: PaEvent[] = [
      pa(1, 'bottom', 'single', 'A', 0),
      pa(1, 'bottom', 'run_scored', 'B', 2),
      pa(1, 'bottom', 'home_run', 'B', 2),
    ]
    const game = syntheticGame(events, { userWasHome: true, homeScore: 2, awayScore: 0 })
    const frames = buildReplay(game, 0)
    const runScoredFrames = frames.filter((f) => f.type === 'run_scored')
    expect(runScoredFrames).toHaveLength(0)
    const last = frames[frames.length - 1]!
    expect(last.scoreAfter.user).toBe(2)
    expect(last.scoreAfter.opponent).toBe(0)
  })
})

describe('buildReplay — steal is a visual no-op', () => {
  it('steal does not change bases or score', () => {
    const events: PaEvent[] = [
      pa(1, 'top', 'single', 'A', 0),
      pa(1, 'top', 'steal', 'A', 0),
      pa(1, 'top', 'out', 'B', 0),
      pa(1, 'top', 'out', 'C', 0),
      pa(1, 'top', 'out', 'D', 0),
    ]
    const game = syntheticGame(events, { userWasHome: false, awayScore: 0, homeScore: 0 })
    const frames = buildReplay(game, 0)
    const stealFrame = frames.find((f) => f.type === 'steal')!
    const singleFrame = frames.find((f) => f.type === 'single')!
    expect(stealFrame.basesAfter.first).toBe(true)
    expect(stealFrame.basesAfter).toEqual(singleFrame.basesAfter)
    expect(stealFrame.runsScoredOnPlay).toBe(0)
    expect(stealFrame.scoreAfter).toEqual(singleFrame.scoreAfter)
    expect(stealFrame.isHighlight).toBe(true)
  })

  it('caught_stealing adds an out and clears first base', () => {
    const events: PaEvent[] = [
      pa(1, 'top', 'single', 'A', 0),
      pa(1, 'top', 'caught_stealing', 'A', 0),
      pa(1, 'top', 'out', 'B', 0),
      pa(1, 'top', 'out', 'C', 0),
    ]
    const game = syntheticGame(events, { userWasHome: false, awayScore: 0, homeScore: 0 })
    const frames = buildReplay(game, 0)
    const caughtFrame = frames.find((f) => f.type === 'caught_stealing')!
    expect(caughtFrame.outsAfter).toBe(1)
    expect(caughtFrame.basesAfter.first).toBe(false)
    expect(caughtFrame.isHighlight).toBe(true)
  })
})

describe('buildReplay — battingSide attribution', () => {
  it('user is home → bottom is user, top is opponent', () => {
    const events: PaEvent[] = [
      pa(1, 'top', 'out', 'A', 0),
      pa(1, 'top', 'out', 'B', 0),
      pa(1, 'top', 'out', 'C', 0),
      pa(1, 'bottom', 'out', 'D', 0),
      pa(1, 'bottom', 'out', 'E', 0),
      pa(1, 'bottom', 'out', 'F', 0),
    ]
    const game = syntheticGame(events, { userWasHome: true })
    const frames = buildReplay(game, 0)
    expect(frames.filter((f) => f.half === 'top').every((f) => f.battingSide === 'opponent')).toBe(true)
    expect(frames.filter((f) => f.half === 'bottom').every((f) => f.battingSide === 'user')).toBe(true)
  })

  it('user is away → top is user, bottom is opponent', () => {
    const events: PaEvent[] = [
      pa(1, 'top', 'out', 'A', 0),
      pa(1, 'top', 'out', 'B', 0),
      pa(1, 'top', 'out', 'C', 0),
      pa(1, 'bottom', 'out', 'D', 0),
      pa(1, 'bottom', 'out', 'E', 0),
      pa(1, 'bottom', 'out', 'F', 0),
    ]
    const game = syntheticGame(events, { userWasHome: false })
    const frames = buildReplay(game, 0)
    expect(frames.filter((f) => f.half === 'top').every((f) => f.battingSide === 'user')).toBe(true)
    expect(frames.filter((f) => f.half === 'bottom').every((f) => f.battingSide === 'opponent')).toBe(true)
  })
})

describe('buildReplay — walk-off detection', () => {
  it('flags go-ahead home run in bottom of the 9th', () => {
    const events: PaEvent[] = [
      pa(9, 'top', 'home_run', 'X', 1),
      pa(9, 'bottom', 'home_run', 'Y', 1),
      pa(9, 'bottom', 'home_run', 'Z', 1),
    ]
    const game = syntheticGame(events, { userWasHome: true, homeScore: 2, awayScore: 1 })
    const frames = buildReplay(game, 0)
    const walkOffs = frames.filter((f) => f.isWalkOff)
    expect(walkOffs).toHaveLength(1)
    expect(walkOffs[0]!.type).toBe('home_run')
    expect(walkOffs[0]!.batterName).toBe('Z')
    expect(walkOffs[0]!.scoreAfter).toEqual({ user: 2, opponent: 1 })
  })

  it('does not flag a top-of-inning home run as walk-off', () => {
    const events: PaEvent[] = [
      pa(9, 'top', 'home_run', 'X', 1),
      pa(9, 'top', 'out', 'A', 0),
      pa(9, 'top', 'out', 'B', 0),
      pa(9, 'top', 'out', 'C', 0),
      pa(9, 'bottom', 'out', 'D', 0),
      pa(9, 'bottom', 'out', 'E', 0),
      pa(9, 'bottom', 'out', 'F', 0),
    ]
    const game = syntheticGame(events, { userWasHome: true, homeScore: 0, awayScore: 1 })
    const frames = buildReplay(game, 0)
    expect(frames.filter((f) => f.isWalkOff)).toHaveLength(0)
  })
})

describe('topPerformers', () => {
  it('aggregates hits, home runs, and rbi for the user side', () => {
    const series = buildSeries('seed-a')
    const performers = topPerformers(series, 'user', 3)
    expect(performers.length).toBeLessThanOrEqual(3)
    for (const p of performers) {
      expect(p.hits).toBeGreaterThanOrEqual(0)
      expect(p.homeRuns).toBeGreaterThanOrEqual(0)
      expect(p.rbi).toBeGreaterThanOrEqual(0)
    }
    if (performers.length >= 2) {
      const [a, b] = performers
      const aRank = a!.homeRuns * 1000 + a!.rbi
      const bRank = b!.homeRuns * 1000 + b!.rbi
      expect(aRank).toBeGreaterThanOrEqual(bRank)
    }
  })

  it('returns user-side performers with at least one hit across a full series', () => {
    const series = buildSeries('seed-b')
    const performers = topPerformers(series, 'user', 5)
    const totalHits = performers.reduce((sum, p) => sum + p.hits, 0)
    expect(totalHits).toBeGreaterThan(0)
  })
})

describe('topPitchers', () => {
  it('attributes pitching lines to the fielding side and formats IP', () => {
    const events: PaEvent[] = [
      // Opponent bats top (user is home): user pitcher U1 works a clean inning.
      pa(1, 'top', 'out', 'A', 0, 'U1'),
      pa(1, 'top', 'strikeout', 'B', 0, 'U1'),
      pa(1, 'top', 'out', 'C', 0, 'U1'),
      // User bats bottom: opponent pitcher O1 allows a homer.
      pa(1, 'bottom', 'home_run', 'X', 1, 'O1'),
      pa(1, 'bottom', 'out', 'Y', 0, 'O1'),
      pa(1, 'bottom', 'strikeout', 'Z', 0, 'O1'),
    ]
    const game = syntheticGame(events, { userWasHome: true, homeScore: 1, awayScore: 0 })
    const series: SimulatedSeries = {
      games: [game],
      userWins: 1,
      opponentWins: 0,
      userRuns: 1,
      opponentRuns: 0,
      userRunDiff: 1,
      wonSeries: true,
      seed: 'synthetic',
    }
    expect(topPitchers(series, 'user', 2)).toEqual([
      {
        name: 'U1',
        ip: '1.0',
        hits: 0,
        runs: 0,
        strikeouts: 1,
        pitches: 0,
      },
    ])
    expect(topPitchers(series, 'opponent', 2)).toEqual([
      {
        name: 'O1',
        ip: '0.2',
        hits: 1,
        runs: 1,
        strikeouts: 1,
        pitches: 0,
      },
    ])
  })

  it('aggregates partial innings across games', () => {
    const halfInning = (half: 'top' | 'bottom', pitcher: string): PaEvent[] => [
      pa(1, half, 'out', 'A', 0, pitcher),
      pa(1, half, 'out', 'B', 0, pitcher),
    ]
    const gameA = syntheticGame(
      [...halfInning('top', 'U1'), ...halfInning('bottom', 'O1')],
      { userWasHome: true },
    )
    const gameB = syntheticGame(
      [...halfInning('top', 'U1'), ...halfInning('bottom', 'O1')],
      { userWasHome: true },
    )
    const series: SimulatedSeries = {
      games: [gameA, gameB],
      userWins: 0,
      opponentWins: 0,
      userRuns: 0,
      opponentRuns: 0,
      userRunDiff: 0,
      wonSeries: false,
      seed: 'synthetic',
    }
    expect(topPitchers(series, 'user', 2)).toEqual([
      {
        name: 'U1',
        ip: '1.1',
        hits: 0,
        runs: 0,
        strikeouts: 0,
        pitches: 0,
      },
    ])
  })

  it('ranks by workload then strikeouts on real sims', () => {
    const series = buildSeries('seed-c')
    for (const side of ['user', 'opponent'] as const) {
      const arms = topPitchers(series, side, 3)
      expect(arms.length).toBeLessThanOrEqual(3)
      for (const arm of arms) {
        expect(arm.ip).toMatch(/^\d+\.\d$/)
        expect(Number(arm.ip.split('.')[1])).toBeLessThanOrEqual(2)
      }
      for (let i = 1; i < arms.length; i += 1) {
        const prevOuts =
          Number(arms[i - 1]!.ip.split('.')[0]) * 3 +
          Number(arms[i - 1]!.ip.split('.')[1])
        const outs =
          Number(arms[i]!.ip.split('.')[0]) * 3 +
          Number(arms[i]!.ip.split('.')[1])
        expect(prevOuts).toBeGreaterThanOrEqual(outs)
      }
    }
  })
})

describe('headlineMoment', () => {
  it('returns a description and valid game index', () => {
    const series = buildSeries('seed-a')
    const moment = headlineMoment(series)
    expect(moment.description.length).toBeGreaterThan(0)
    expect(moment.gameIndex).toBeGreaterThanOrEqual(0)
    expect(moment.gameIndex).toBeLessThan(series.games.length)
  })

  it('prefers a walk-off home run', () => {
    const events: PaEvent[] = [
      pa(9, 'top', 'home_run', 'X', 1),
      pa(9, 'bottom', 'home_run', 'Y', 1),
      pa(9, 'bottom', 'home_run', 'Z', 1),
    ]
    const game = syntheticGame(events, { userWasHome: true, homeScore: 2, awayScore: 1 })
    const series: SimulatedSeries = {
      games: [game],
      userWins: 1,
      opponentWins: 0,
      userRuns: 2,
      opponentRuns: 1,
      userRunDiff: 1,
      wonSeries: true,
      seed: 'synthetic',
    }
    const moment = headlineMoment(series)
    expect(moment.description).toContain('Z')
  })
})

describe('buildSeriesReplay', () => {
  it('produces one frame array per game', () => {
    const series = buildSeries('seed-a')
    const replay = buildSeriesReplay(series)
    expect(replay).toHaveLength(series.games.length)
    for (const frames of replay) {
      expect(frames.length).toBeGreaterThan(0)
    }
  })

  it('frames carry correct game index', () => {
    const series = buildSeries('seed-a')
    const replay = buildSeriesReplay(series)
    replay.forEach((frames, gameIndex) => {
      for (const f of frames) {
        expect(f.gameIndex).toBe(gameIndex)
      }
    })
  })
})
