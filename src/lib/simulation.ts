import {
  ELITE_SEASON_VARIANCE,
  INITIAL_SEASON_VARIANCE,
  MAX_REROLL_SWING,
  PER_GAME_VARIANCE,
  getPerfectSeasonGate,
  PERFECT_SEASON_MIN_SCORE,
  PERFECT_SEASON_THRESHOLD,
  SEASON_LENGTH,
  SEASON_SEGMENTS,
  VOLATILITY_MODIFIER,
} from './calibration'
import { calculateRunPrevention } from './run-prevention'
import { projectWins } from './game'
import { lineupPlayers, lineupToSeed as buildLineupSeed, getActiveLineupPositions } from './roster-format'
import { getBattingRatings } from './player-ratings'
import { blendedPitchingRating } from './pitching-contributors'
import { teamWorkloadScore } from './pitching-workload'
import { playerHasBattingProfile } from './player-eligibility'
import type {
  Lineup,
  LineupPosition,
  RosterFormatId,
  SeasonNoteSource,
  SeasonSegment,
  SeasonSimulation,
  SimulatedGame,
  SimulationSeed,
} from './types'

export { getPerfectSeasonGate } from './calibration'

export type TeamProfile = {
  teamScore: number
  contact: number
  power: number
  speed: number
  runProduction: number
  runPrevention: number
  control: number
  dominance: number
  workload: number
  starPower: number
  balance: number
  volatility: number
  offenseStrength: number
  pitchingStrength: number
}

/** Mulberry32 seeded PRNG — deterministic from numeric seed. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable seed from lineup personIds and positions. */
export function lineupToSeed(
  lineup: Lineup,
  formatId: RosterFormatId = 'classic',
): SimulationSeed {
  return buildLineupSeed(lineup, formatId)
}

/** Hash a string to a numeric seed. */
export function hashSeed(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function resolveSimulationSeed(
  lineup: Lineup,
  formatId: RosterFormatId,
  rerollSeed?: SimulationSeed,
): SimulationSeed {
  if (rerollSeed) {
    return `${lineupToSeed(lineup, formatId)}::reroll:${rerollSeed}`
  }
  return lineupToSeed(lineup, formatId)
}

function getSegmentForGame(gameIndex: number): SeasonSegment {
  if (gameIndex < SEASON_SEGMENTS.early.end) return 'early'
  if (gameIndex < SEASON_SEGMENTS.middle.end) return 'middle'
  return 'late'
}

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
}

export function buildTeamProfile(
  lineup: Lineup,
  teamScore: number,
  formatId: RosterFormatId,
): TeamProfile {
  const players = lineupPlayers(lineup, formatId)
  const batters = players.filter((p) => playerHasBattingProfile(p))

  const batRatings = batters.map(getBattingRatings)

  const contact = avg(batRatings.map((r) => r.contact))
  const power = avg(batRatings.map((r) => r.power))
  const speed = avg(batRatings.map((r) => r.speed))
  const runProduction = avg(batRatings.map((r) => r.runProduction))
  const runPrevention = calculateRunPrevention(lineup, formatId).value
  const control = blendedPitchingRating(lineup, formatId, (r) => r.whip)
  const dominance = blendedPitchingRating(lineup, formatId, (r) => r.strikeouts)
  const workload = teamWorkloadScore(lineup, formatId)
  const hasRpSlot = getActiveLineupPositions(formatId).includes('RP')
  const closerValue = hasRpSlot
    ? blendedPitchingRating(lineup, formatId, (r) => r.saves)
    : null

  const overalls = players.map((p) => p.ratings.overall)
  const starPower = Math.max(...overalls, 0)
  const avgOverall = avg(overalls)
  const variance =
    overalls.reduce((s, o) => s + (o - avgOverall) ** 2, 0) /
    Math.max(overalls.length, 1)
  const balance = Math.max(0, 100 - Math.sqrt(variance) * 2)
  const volatility = Math.min(1, Math.sqrt(variance) / 30)

  const offenseStrength = (contact + power + runProduction) / 3
  const pitchingStrength =
    closerValue != null
      ? (runPrevention + control + dominance + workload + closerValue) / 5
      : (runPrevention + control + dominance + workload) / 4

  return {
    teamScore,
    contact,
    power,
    speed,
    runProduction,
    runPrevention,
    control,
    dominance,
    workload,
    starPower,
    balance,
    volatility,
    offenseStrength,
    pitchingStrength,
  }
}

/** Convert team score to baseline per-game win probability. */
export function baselineWinProbability(teamScore: number): number {
  const { wins } = projectWins(teamScore)
  return wins / SEASON_LENGTH
}

function winProbabilityCeiling(teamScore: number): number {
  if (teamScore >= 98) return 0.99
  if (teamScore >= 95) return 0.98
  if (teamScore >= 90) return 0.94
  return 0.92
}

function initialSeasonVariance(teamScore: number): number {
  if (teamScore >= 95) return ELITE_SEASON_VARIANCE
  if (teamScore >= 90) return INITIAL_SEASON_VARIANCE + 2
  return INITIAL_SEASON_VARIANCE
}

function gameWinProbability(profile: TeamProfile, random: () => number): number {
  const base = baselineWinProbability(profile.teamScore)
  const offenseMod = (profile.offenseStrength - 50) / 2000
  const pitchingMod = (profile.pitchingStrength - 50) / 2000
  const balanceMod = (profile.balance - 50) / 2500
  const volatilitySwing =
    (random() - 0.5) *
    PER_GAME_VARIANCE *
    (1 + profile.volatility * VOLATILITY_MODIFIER * 10)
  const starBoost =
    profile.starPower >= 92 ? 0.015 : profile.starPower >= 88 ? 0.008 : 0
  const ceiling = winProbabilityCeiling(profile.teamScore)

  return Math.min(
    ceiling,
    Math.max(
      0.08,
      base + offenseMod + pitchingMod + balanceMod + starBoost + volatilitySwing,
    ),
  )
}

function clampWins(
  wins: number,
  profile: TeamProfile,
  expectedWins: number,
  isReroll: boolean,
  formatId: RosterFormatId,
): number {
  const perfectGate = getPerfectSeasonGate(formatId)
  let clamped = Math.min(SEASON_LENGTH, Math.max(0, wins))

  const varianceCap = isReroll
    ? MAX_REROLL_SWING
    : initialSeasonVariance(profile.teamScore)
  const minWins = Math.max(0, expectedWins - varianceCap)
  const maxWins = Math.min(SEASON_LENGTH, expectedWins + varianceCap)
  clamped = Math.min(maxWins, Math.max(minWins, clamped))

  if (profile.teamScore < PERFECT_SEASON_MIN_SCORE && clamped === SEASON_LENGTH) {
    clamped = SEASON_LENGTH - 1
  }

  if (
    profile.teamScore < PERFECT_SEASON_THRESHOLD &&
    clamped >= SEASON_LENGTH - 5
  ) {
    clamped = Math.min(clamped, SEASON_LENGTH - 6)
  }

  if (
    profile.teamScore >= perfectGate.minTeamScore &&
    wins >= perfectGate.minRawWins &&
    expectedWins >= perfectGate.minExpectedWins
  ) {
    clamped = SEASON_LENGTH
  }

  if (profile.teamScore < 75 && clamped >= 110) {
    clamped = Math.min(clamped, 105)
  }

  if (profile.teamScore < 70 && clamped >= 100) {
    clamped = Math.min(clamped, 98)
  }

  return clamped
}

function computeStreaks(games: SimulatedGame[]): {
  longestWinStreak: number
  longestLosingStreak: number
} {
  let longestWin = 0
  let longestLoss = 0
  let currentWin = 0
  let currentLoss = 0

  for (const game of games) {
    if (game.won) {
      currentWin++
      currentLoss = 0
      longestWin = Math.max(longestWin, currentWin)
    } else {
      currentLoss++
      currentWin = 0
      longestLoss = Math.max(longestLoss, currentLoss)
    }
  }

  return { longestWinStreak: longestWin, longestLosingStreak: longestLoss }
}

function buildNoteSources(
  games: SimulatedGame[],
  profile: TeamProfile,
  wins: number,
  expectedWins: number,
): SeasonNoteSource[] {
  const notes: SeasonNoteSource[] = []
  const { longestWinStreak, longestLosingStreak } = computeStreaks(games)

  if (longestWinStreak >= 8) {
    notes.push({
      segment: 'middle',
      type: 'streak',
      importance: Math.min(10, longestWinStreak),
    })
  }
  if (longestLosingStreak >= 5) {
    notes.push({
      segment: 'middle',
      type: 'slump',
      importance: Math.min(8, longestLosingStreak),
    })
  }

  const closeWins = games.filter((g) => g.won && g.close).length
  const closeLosses = games.filter((g) => !g.won && g.close).length
  if (closeWins + closeLosses >= 20) {
    notes.push({
      segment: 'late',
      type: 'closeGames',
      importance: 6 + Math.floor((closeWins + closeLosses) / 10),
    })
  }

  const blowoutWins = games.filter((g) => g.won && g.blowout).length
  if (blowoutWins >= 15) {
    notes.push({
      segment: 'early',
      type: 'blowouts',
      importance: 5 + Math.floor(blowoutWins / 10),
    })
  }

  const offenseWins = games.filter((g) => g.won && g.offenseDriven).length
  const pitchingWins = games.filter((g) => g.won && g.pitchingDriven).length
  if (offenseWins > pitchingWins + 10) {
    notes.push({
      segment: 'early',
      type: 'offense',
      importance: 7,
      gradeLabel: 'Power',
    })
  } else if (pitchingWins > offenseWins + 10) {
    notes.push({
      segment: 'early',
      type: 'pitching',
      importance: 7,
      gradeLabel: 'Run Prevention',
    })
  }

  if (profile.starPower >= 90) {
    notes.push({
      segment: 'middle',
      type: 'starPlayer',
      importance: 8,
    })
  }

  if (profile.volatility > 0.6) {
    notes.push({
      segment: 'late',
      type: 'weakness',
      importance: 5 + Math.round(profile.volatility * 5),
    })
  }

  const luckDelta = wins - expectedWins
  if (Math.abs(luckDelta) >= 5) {
    notes.push({
      segment: 'late',
      type: 'expectation',
      importance: 6 + Math.min(4, Math.abs(luckDelta) / 3),
    })
  }

  return notes.sort((a, b) => b.importance - a.importance)
}

export function simulateSeason(
  lineup: Lineup,
  teamScore: number,
  options?: { rerollSeed?: SimulationSeed; rosterFormatId?: RosterFormatId },
): SeasonSimulation {
  const formatId = options?.rosterFormatId ?? 'classic'
  const seed = resolveSimulationSeed(lineup, formatId, options?.rerollSeed)
  const random = createSeededRandom(hashSeed(seed))
  const profile = buildTeamProfile(lineup, teamScore, formatId)
  const expectedWins = projectWins(teamScore).wins
  const isReroll = Boolean(options?.rerollSeed)

  const games: SimulatedGame[] = []

  for (let i = 0; i < SEASON_LENGTH; i++) {
    const winProb = gameWinProbability(profile, random)
    const roll = random()
    const won = roll < winProb
    const marginRoll = random()
    const close = marginRoll > 0.35 && marginRoll < 0.65
    const blowout = marginRoll < 0.15 || marginRoll > 0.85
    const offenseDriven =
      profile.offenseStrength >= profile.pitchingStrength && random() > 0.4
    const pitchingDriven = !offenseDriven && random() > 0.4

    games.push({
      won,
      close,
      blowout,
      offenseDriven,
      pitchingDriven,
      segment: getSegmentForGame(i),
    })
  }

  let wins = games.filter((g) => g.won).length
  wins = clampWins(wins, profile, expectedWins, isReroll, formatId)
  const losses = SEASON_LENGTH - wins

  const closeWins = games.filter((g) => g.won && g.close).length
  const closeLosses = games.filter((g) => !g.won && g.close).length
  const blowoutWins = games.filter((g) => g.won && g.blowout).length
  const blowoutLosses = games.filter((g) => !g.won && g.blowout).length
  const offenseDrivenWins = games.filter((g) => g.won && g.offenseDriven).length
  const pitchingDrivenWins = games.filter(
    (g) => g.won && g.pitchingDriven,
  ).length

  const { longestWinStreak, longestLosingStreak } = computeStreaks(games)
  const luckDelta = wins - expectedWins
  const expectationResult: SeasonSimulation['expectationResult'] =
    luckDelta > 3 ? 'exceeded' : luckDelta < -3 ? 'fell_short' : 'met'

  const noteSources = buildNoteSources(games, profile, wins, expectedWins)

  return {
    wins,
    losses,
    record: `${wins}-${losses}`,
    expectedWins,
    luckDelta,
    expectationResult,
    longestWinStreak,
    longestLosingStreak,
    closeGameRecord: `${closeWins}-${closeLosses}`,
    blowoutRecord: `${blowoutWins}-${blowoutLosses}`,
    offenseDrivenWins,
    pitchingDrivenWins,
    closeWins,
    closeLosses,
    blowoutWins,
    blowoutLosses,
    noteSources,
    seed,
  }
}

export function getSegmentForPosition(position: LineupPosition): SeasonSegment {
  void position
  return 'middle'
}

export { VOLATILITY_MODIFIER }
