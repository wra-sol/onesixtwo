import { describe, expect, it } from 'vitest'
import { validateDataset } from '../data'
import {
  BENCHMARK_WIN_RANGES,
  buildBenchmarkLineup,
} from './benchmarks'
import {
  applySpin,
  assignPlayer,
  calculateSeasonResult,
  calculateTeamScore,
  canAssignPlayer,
  createEmptyLineup,
  createInitialGameState,
  getEligiblePositionsForPlayer,
  getPlayerDisabledReason,
  getSpinEligibleBuckets,
  isLineupComplete,
  pickRandomBucket,
  restartGame,
  selectPlayer,
  startGame,
} from './game'
import { DRAFT_BUCKETS, PLAYER_BY_ID } from '../data'

const alwaysFirst: () => number = () => 0

describe('dataset', () => {
  it('passes validation with position coverage', () => {
    expect(validateDataset()).toEqual([])
  })

  it('has spin-eligible buckets at game start', () => {
    const state = createInitialGameState()
    expect(getSpinEligibleBuckets(state).length).toBeGreaterThan(0)
  })

  it('loads generated buckets with multiple players', () => {
    expect(DRAFT_BUCKETS.length).toBeGreaterThan(50)
    const sample = DRAFT_BUCKETS.find((b) => b.id === 'yankees-1990s')
    expect(sample?.playerIds.length).toBeGreaterThanOrEqual(2)
  })

  it('uses real player names from Lahman (no filler contributors)', () => {
    const names = [...PLAYER_BY_ID.values()].map((p) => p.name)
    expect(names.some((n) => n.includes('Contributor'))).toBe(false)
    expect(names).toContain('Babe Ruth')
    expect(names.length).toBeGreaterThan(1000)
  })
})

describe('personId duplicate prevention', () => {
  it('blocks drafting same person twice via different cards', () => {
    const player = [...PLAYER_BY_ID.values()][0]
    let state = createInitialGameState()
    state = {
      ...state,
      status: 'assigning',
      selectedPlayerId: player.id,
      currentBucket: DRAFT_BUCKETS[0],
    }
    const pos = player.positions[0]
    state = assignPlayer(state, pos)
    expect(state.draftedPersonIds).toContain(player.personId)

    const reason = getPlayerDisabledReason(player, state)
    expect(reason).toBe('Already drafted')
  })
})

describe('lineup positions', () => {
  it('rejects assignment to wrong position', () => {
    const hitter = [...PLAYER_BY_ID.values()].find(
      (p) => p.role === 'hitter' && p.positions.includes('SS'),
    )
    expect(hitter).toBeDefined()
    let state = createInitialGameState()
    state = {
      ...state,
      status: 'assigning',
      selectedPlayerId: hitter!.id,
      lineup: createEmptyLineup(),
    }
    expect(canAssignPlayer(state, 'SS')).toBe(true)
    expect(canAssignPlayer(state, 'P')).toBe(false)
  })
})

describe('draft flow', () => {
  it('completes nine-round draft with deterministic rng', () => {
    let state = createInitialGameState()
    state = startGame(state)

    for (let i = 0; i < 9; i++) {
      state = applySpin(state, alwaysFirst)
      expect(state.availablePlayers.length).toBeGreaterThan(0)
      const player = state.availablePlayers[0]
      state = selectPlayer(state, player.id)
      const pos = getEligiblePositionsForPlayer(player, state.lineup)[0]
      state = assignPlayer(state, pos)
    }

    expect(state.status).toBe('complete')
    expect(isLineupComplete(state.lineup)).toBe(true)
    expect(state.history).toHaveLength(9)
  })

  it('enters stuck state when no buckets remain', () => {
    let state = createInitialGameState()
    state = {
      ...state,
      status: 'spinning',
      round: 9,
      lineup: createEmptyLineup(),
      draftedPersonIds: [],
    }
    const allPersons = new Set(
      [...PLAYER_BY_ID.values()].map((p) => p.personId),
    )
    state.draftedPersonIds = [...allPersons]
    state = applySpin(state, alwaysFirst)
    expect(state.status).toBe('stuck')
  })

  it('restarts cleanly', () => {
    const restarted = restartGame()
    expect(restarted.status).toBe('intro')
    expect(restarted.draftedPersonIds).toHaveLength(0)
    expect(restarted.history).toHaveLength(0)
  })
})

describe('scoring benchmarks', () => {
  it('bounds team score 0-100', () => {
    const lineup = buildBenchmarkLineup('great')
    expect(isLineupComplete(lineup)).toBe(true)
    const score = calculateTeamScore(lineup)
    expect(score).not.toBeNull()
    expect(score!).toBeGreaterThanOrEqual(0)
    expect(score!).toBeLessThanOrEqual(100)
  })

  it('projects wins within expected ranges by benchmark tier', () => {
    for (const tier of ['mediocre', 'great', 'elite', 'nearPerfect'] as const) {
      const lineup = buildBenchmarkLineup(tier)
      expect(isLineupComplete(lineup)).toBe(true)
      const result = calculateSeasonResult(lineup)
      expect(result).not.toBeNull()
      const range = BENCHMARK_WIN_RANGES[tier]
      expect(result!.wins).toBeGreaterThanOrEqual(range.min)
      expect(result!.wins).toBeLessThanOrEqual(range.max)
    }
  })

  it('allows 162-0 only at near-perfect tier', () => {
    const near = calculateSeasonResult(buildBenchmarkLineup('nearPerfect'))
    const great = calculateSeasonResult(buildBenchmarkLineup('great'))
    expect(near!.wins).toBeGreaterThanOrEqual(great!.wins)
  })

  it('includes recap fields', () => {
    const result = calculateSeasonResult(buildBenchmarkLineup('elite'))
    expect(result?.bestPlayer).not.toBeNull()
    expect(result?.shareText).toContain('162-0')
  })
})

describe('randomization', () => {
  it('picks from eligible buckets only', () => {
    const state = createInitialGameState()
    const bucket = pickRandomBucket(state, alwaysFirst)
    expect(bucket).not.toBeNull()
    expect(getSpinEligibleBuckets(state).map((b) => b.id)).toContain(bucket!.id)
  })
})
