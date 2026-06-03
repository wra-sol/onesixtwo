import { describe, expect, it } from 'vitest'
import { validateDataset } from '../data'
import {
  BENCHMARK_WIN_RANGES,
  buildBenchmarkLineup,
} from './benchmarks'
import { BENCHMARK_EXPECTATIONS, MAX_REROLL_SWING } from './calibration'
import {
  applyRespinTeam,
  applyRespinYear,
  applySpin,
  assignPlayer,
  calculateSeasonResult,
  calculateTeamScore,
  canAssignPlayer,
  canRespinTeam,
  canRespinYear,
  createEmptyLineup,
  createInitialGameState,
  getEligiblePositionsForPlayer,
  filterAvailablePlayers,
  getPlayerDisabledReason,
  playerIsPickable,
  getSpinEligibleBuckets,
  getTeamRespinCandidates,
  getYearRespinCandidates,
  isLineupComplete,
  pickRandomBucket,
  requestTeamRespin,
  requestYearRespin,
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

  it('only includes 1960s onward in playable buckets', () => {
    const eras = new Set(DRAFT_BUCKETS.map((b) => b.era))
    expect(eras.has('1910s')).toBe(false)
    expect(eras.has('1950s')).toBe(false)
    expect(eras.has('1960s')).toBe(true)
    expect(eras.has('2020s')).toBe(true)
  })

  it('uses real player names from Lahman (no filler contributors)', () => {
    const names = [...PLAYER_BY_ID.values()].map((p) => p.name)
    expect(names.some((n) => n.includes('Contributor'))).toBe(false)
    expect(names).toContain('Derek Jeter')
    expect(names.length).toBeGreaterThan(1000)
  })

  it('lists each person at most once per franchise-decade bucket', () => {
    for (const bucket of DRAFT_BUCKETS) {
      const players = bucket.playerIds.map((id) => PLAYER_BY_ID.get(id))
      const personIds = players.map((p) => p?.personId)
      expect(new Set(personIds).size).toBe(personIds.length)
      const names = players.map((p) => p?.name)
      expect(new Set(names).size).toBe(names.length)
    }
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

describe('available players list', () => {
  it('includes undrafted players whose positions are already filled', () => {
    const pitcher = [...PLAYER_BY_ID.values()].find((p) => p.role === 'pitcher')
    expect(pitcher).toBeDefined()
    const bucket = DRAFT_BUCKETS.find((b) => b.playerIds.includes(pitcher!.id))
    expect(bucket).toBeDefined()

    const otherPitcher = [...PLAYER_BY_ID.values()].find(
      (p) => p.role === 'pitcher' && p.id !== pitcher!.id,
    )
    expect(otherPitcher).toBeDefined()

    let state = createInitialGameState()
    state = {
      ...state,
      lineup: { ...createEmptyLineup(), P: otherPitcher! },
    }
    const listed = filterAvailablePlayers(bucket!, state)
    expect(listed.some((p) => p.id === pitcher!.id)).toBe(true)
    expect(getPlayerDisabledReason(pitcher!, state)).toBe('P filled')
    expect(playerIsPickable(pitcher!, state)).toBe(false)
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

  it('allows drafting into a filled position when the current player can switch to an open position', () => {
    const flexiblePlayer = [...PLAYER_BY_ID.values()].find(
      (p) =>
        p.role === 'hitter' &&
        p.positions.includes('C') &&
        p.positions.includes('1B'),
    )
    const catcher = [...PLAYER_BY_ID.values()].find(
      (p) =>
        p.role === 'hitter' &&
        p.positions.includes('C') &&
        !p.positions.includes('1B') &&
        p.id !== flexiblePlayer?.id,
    )
    expect(flexiblePlayer).toBeDefined()
    expect(catcher).toBeDefined()

    let state = createInitialGameState()
    state = {
      ...state,
      status: 'assigning',
      selectedPlayerId: catcher!.id,
      lineup: { ...createEmptyLineup(), C: flexiblePlayer! },
    }

    expect(getEligiblePositionsForPlayer(catcher!, state.lineup)).toContain('C')
    expect(canAssignPlayer(state, 'C')).toBe(true)

    state = assignPlayer(state, 'C')
    expect(state.lineup.C?.id).toBe(catcher!.id)
    expect(state.lineup['1B']?.id).toBe(flexiblePlayer!.id)
    expect(state.history.at(-1)?.position).toBe('C')
  })

  it('does not switch a filled position when the current player has no open alternate position', () => {
    const flexiblePlayer = [...PLAYER_BY_ID.values()].find(
      (p) =>
        p.role === 'hitter' &&
        p.positions.includes('C') &&
        p.positions.includes('1B'),
    )
    const catcher = [...PLAYER_BY_ID.values()].find(
      (p) =>
        p.role === 'hitter' &&
        p.positions.includes('C') &&
        !p.positions.includes('1B') &&
        p.id !== flexiblePlayer?.id,
    )
    const firstBaseman = [...PLAYER_BY_ID.values()].find(
      (p) =>
        p.role === 'hitter' &&
        p.positions.includes('1B') &&
        p.id !== flexiblePlayer?.id,
    )
    expect(flexiblePlayer).toBeDefined()
    expect(catcher).toBeDefined()
    expect(firstBaseman).toBeDefined()

    const lineup = {
      ...createEmptyLineup(),
      C: flexiblePlayer!,
      '1B': firstBaseman!,
    }
    const state = {
      ...createInitialGameState(),
      status: 'assigning' as const,
      selectedPlayerId: catcher!.id,
      lineup,
    }

    expect(getEligiblePositionsForPlayer(catcher!, lineup)).not.toContain('C')
    expect(canAssignPlayer(state, 'C')).toBe(false)
  })
})

describe('draft flow', () => {
  it('completes nine-round draft with deterministic rng', () => {
    let state = createInitialGameState()
    state = startGame(state)

    for (let i = 0; i < 9; i++) {
      state = applySpin(state, alwaysFirst)
      expect(state.availablePlayers.length).toBeGreaterThan(0)
      const player = state.availablePlayers.find((p) => playerIsPickable(p, state))
      expect(player).toBeDefined()
      const pick = player!
      state = selectPlayer(state, pick.id)
      const pos = getEligiblePositionsForPlayer(pick, state.lineup)[0]
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
    expect(restarted.teamRespinUsed).toBe(false)
    expect(restarted.yearRespinUsed).toBe(false)
  })
})

describe('respins', () => {
  it('allows one team respin per game keeping the same decade', () => {
    let state = createInitialGameState()
    state = startGame(state)
    state = applySpin(state, alwaysFirst)
    const originalEra = state.currentBucket!.era
    const originalTeam = state.currentBucket!.teamId

    expect(canRespinTeam(state)).toBe(
      getTeamRespinCandidates(state).length > 0,
    )
    state = requestTeamRespin(state)
    expect(state.status).toBe('spinning')
    expect(state.spinIntent).toBe('team')

    state = applyRespinTeam(state, alwaysFirst)
    expect(state.teamRespinUsed).toBe(true)
    expect(state.currentBucket!.era).toBe(originalEra)
    expect(state.currentBucket!.teamId).not.toBe(originalTeam)
    expect(canRespinTeam(state)).toBe(false)
  })

  it('allows one year respin per game keeping the same franchise', () => {
    let state = createInitialGameState()
    state = startGame(state)
    state = applySpin(state, alwaysFirst)
    const originalTeam = state.currentBucket!.teamId
    const originalEra = state.currentBucket!.era

    state = requestYearRespin(state)
    state = applyRespinYear(state, alwaysFirst)
    expect(state.yearRespinUsed).toBe(true)
    expect(state.currentBucket!.teamId).toBe(originalTeam)
    expect(state.currentBucket!.era).not.toBe(originalEra)
    expect(canRespinYear(state)).toBe(false)
  })

  it('still allows year respin after team respin is consumed', () => {
    let state = createInitialGameState()
    state = startGame(state)
    state = applySpin(state, alwaysFirst)
    state = applyRespinTeam(state, alwaysFirst)
    expect(canRespinTeam(state)).toBe(false)
    expect(state.yearRespinUsed).toBe(false)
    if (getYearRespinCandidates(state).length > 0) {
      expect(canRespinYear(state)).toBe(true)
    }
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
    expect(result?.shareText).toContain('onesixtytwo.win')
    expect(result?.shareText).toContain('Perfect Season')
    expect(result?.shareText).toContain('162-0')
    expect(result?.simulation).toBeDefined()
    expect(result?.scorecard.rows).toHaveLength(9)
    expect(result?.seasonMoments.length).toBeGreaterThan(0)
    expect(result?.identity.label).toBeTruthy()
    expect(result?.strengths.length).toBeGreaterThan(0)
    expect(result?.weaknesses.length).toBeGreaterThan(0)
    expect(result?.tier.label).toBeTruthy()
  })

  it('produces deterministic initial simulation for same lineup', () => {
    const lineup = buildBenchmarkLineup('great')
    const first = calculateSeasonResult(lineup)
    const second = calculateSeasonResult(lineup)
    expect(first!.wins).toBe(second!.wins)
    expect(first!.simulation.seed).toBe(second!.simulation.seed)
  })

  it('changes simulated record on reroll', () => {
    const lineup = buildBenchmarkLineup('elite')
    const initial = calculateSeasonResult(lineup)
    const rerolled = calculateSeasonResult(lineup, { rerollSeed: '1' })
    expect(rerolled!.simulation.seed).not.toBe(initial!.simulation.seed)
  })

  it('keeps reroll variance within configured bounds', () => {
    const lineup = buildBenchmarkLineup('elite')
    const initial = calculateSeasonResult(lineup)
    for (let i = 1; i <= 5; i++) {
      const rerolled = calculateSeasonResult(lineup, {
        rerollSeed: String(i),
      })
      expect(
        Math.abs(rerolled!.wins - initial!.expectedWins),
      ).toBeLessThanOrEqual(MAX_REROLL_SWING + 2)
    }
  })

  it('does not allow ordinary lineups to reach perfect season', () => {
    for (const tier of ['mediocre', 'great', 'elite'] as const) {
      const lineup = buildBenchmarkLineup(tier)
      const result = calculateSeasonResult(lineup)
      expect(result!.wins).toBeLessThan(162)
    }
  })

  it('aligns simulated wins with calibration expectations', () => {
    for (const tier of ['mediocre', 'great', 'elite', 'nearPerfect'] as const) {
      const lineup = buildBenchmarkLineup(tier)
      const result = calculateSeasonResult(lineup)
      const expected = BENCHMARK_EXPECTATIONS[tier]
      expect(result!.wins).toBeGreaterThanOrEqual(expected.winBand.min - 5)
      expect(result!.wins).toBeLessThanOrEqual(expected.winBand.max + 5)
    }
  })

  it('scorecard has nine rows with simulated stat lines', () => {
    const result = calculateSeasonResult(buildBenchmarkLineup('great'))
    expect(result!.scorecard.rows).toHaveLength(9)
    for (const row of result!.scorecard.rows) {
      expect(row.slashLine).toBeTruthy()
      expect(row.countingLine).toBeTruthy()
      expect(row.statNote).toBe('Simulated season')
    }
  })

  it('scorecard slash lines change when simulation seed changes', () => {
    const lineup = buildBenchmarkLineup('great')
    const initial = calculateSeasonResult(lineup)!
    const rerolled = calculateSeasonResult(lineup, { rerollSeed: '1' })!
    const initialSlash = initial.scorecard.rows.map((r) => r.slashLine).join('|')
    const rerolledSlash = rerolled.scorecard.rows.map((r) => r.slashLine).join('|')
    expect(rerolledSlash).not.toBe(initialSlash)
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
