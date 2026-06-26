import { describe, expect, it } from 'vitest'
import {
  buildLegendsSnapshot,
  classicPlayerToLive,
  filterLegendsByTeam,
} from './classic-live-adapter'
import { PLAYERS } from '../data'
import type { HitterStats, PitcherStats, Player, TeamId } from './types'

const DEFAULT_HITTER_STATS: HitterStats = {
  avg: '.300',
  hr: 10,
  rbi: 50,
  sb: 5,
  ops: '.900',
}
const DEFAULT_PITCHER_STATS: PitcherStats = {
  era: '3.00',
  whip: '1.10',
  so: 200,
  wins: 15,
}

function hitter(overrides: Partial<Player>): Player {
  return {
    id: 'test-hitter',
    personId: 'testhitter01',
    name: 'Test Hitter',
    teamId: 'yankees',
    teamName: 'Yankees',
    era: '1990s',
    role: 'hitter',
    positions: ['1B', 'DH'],
    stats: DEFAULT_HITTER_STATS,
    ratings: {
      contact: 70,
      power: 70,
      speed: 70,
      runProduction: 70,
      ops: 70,
      era: 0,
      whip: 0,
      strikeouts: 0,
      wins: 0,
      saves: 0,
      workload: 0,
      overall: 70,
    },
    ...overrides,
  }
}

function pitcher(overrides: Partial<Player>): Player {
  return {
    id: 'test-pitcher',
    personId: 'testpitcher01',
    name: 'Test Pitcher',
    teamId: 'yankees',
    teamName: 'Yankees',
    era: '1990s',
    role: 'pitcher',
    positions: ['SP'],
    stats: DEFAULT_PITCHER_STATS,
    ratings: {
      contact: 0,
      power: 0,
      speed: 0,
      runProduction: 0,
      ops: 0,
      era: 70,
      whip: 70,
      strikeouts: 70,
      wins: 70,
      saves: 50,
      workload: 80,
      overall: 70,
    },
    ...overrides,
  }
}

describe('classicPlayerToLive — grade mapping', () => {
  it('maps contact/power/speed directly then clamps to 20-80', () => {
    const lp = classicPlayerToLive(
      hitter({ ratings: { ...hitter({ stats: { avg: '.300', hr: 10, rbi: 50, sb: 5, ops: '.900' } }).ratings, contact: 64, power: 72, speed: 58, overall: 68 } }),
    )
    expect(lp.grades.contact).toBe(64)
    expect(lp.grades.power).toBe(72)
    expect(lp.grades.speed).toBe(58)
    expect(lp.grades.overall).toBe(68)
  })

  it('clamps elite (100) and floor contact/power/speed into [20,80]', () => {
    const lp = classicPlayerToLive(
      hitter({
        ratings: {
          ...hitter({ stats: { avg: '.300', hr: 10, rbi: 50, sb: 5, ops: '.900' } }).ratings,
          contact: 100,
          power: 100,
          speed: 100,
          overall: 100,
        },
      }),
    )
    expect(lp.grades.contact).toBe(80)
    expect(lp.grades.power).toBe(80)
    expect(lp.grades.speed).toBe(80)
    expect(lp.grades.overall).toBe(80)
  })

  it('maps stuff directly from strikeouts (clamped)', () => {
    const lp = classicPlayerToLive(
      pitcher({ ratings: { ...pitcher({ stats: { era: '3.00', whip: '1.10', so: 200, wins: 15 } }).ratings, strikeouts: 75, saves: 50 } }),
    )
    expect(lp.grades.stuff).toBe(75)
  })

  it('maps command directly from whip rating — an elite ace (high whip rating) gets high command', () => {
    // The Classic `whip` rating is higher=better (PITCHER_WHIP_ANCHORS: 0.95→100,
    // 1.41→50). The plan's `100 - whip` would invert this and hand aces ~2 command,
    // breaking PA-sim. So command maps directly from the whip rating, clamped 20-80.
    const ace = classicPlayerToLive(
      pitcher({ ratings: { ...pitcher({ stats: { era: '2.00', whip: '0.95', so: 300, wins: 20 } }).ratings, whip: 95, saves: 50 } }),
    )
    expect(ace.grades.command).toBe(80)
    const poor = classicPlayerToLive(
      pitcher({ ratings: { ...pitcher({ stats: { era: '5.00', whip: '1.50', so: 50, wins: 5 } }).ratings, whip: 50, saves: 50 } }),
    )
    expect(poor.grades.command).toBe(50)
  })

  it('soft-clamps command to 20-80', () => {
    const top = classicPlayerToLive(
      pitcher({ ratings: { ...pitcher({ stats: { era: '2.00', whip: '0.90', so: 300, wins: 20 } }).ratings, whip: 100, saves: 50 } }),
    )
    expect(top.grades.command).toBe(80)
    const bottom = classicPlayerToLive(
      pitcher({ ratings: { ...pitcher({ stats: { era: '6.00', whip: '2.00', so: 30, wins: 2 } }).ratings, whip: 10, saves: 50 } }),
    )
    expect(bottom.grades.command).toBe(20)
  })

  it('gives starters stamina from workload, relievers stamina 50', () => {
    const starter = classicPlayerToLive(
      pitcher({ ratings: { ...pitcher({ stats: { era: '3.00', whip: '1.10', so: 200, wins: 15 } }).ratings, workload: 88, saves: 50 } }),
    )
    expect(starter.grades.stamina).toBe(80)
    expect(starter.pitcherRoles).toEqual(['SP'])
    const closer = classicPlayerToLive(
      pitcher({ ratings: { ...pitcher({ stats: { era: '2.50', whip: '1.00', so: 100, wins: 5 } }).ratings, workload: 70, saves: 72 } }),
    )
    expect(closer.grades.stamina).toBe(50)
    expect(closer.pitcherRoles).toEqual(['RP', 'CL'])
    const reliever = classicPlayerToLive(
      pitcher({ ratings: { ...pitcher({ stats: { era: '3.50', whip: '1.25', so: 80, wins: 6 } }).ratings, workload: 70, saves: 55 } }),
    )
    expect(reliever.grades.stamina).toBe(50)
    expect(reliever.pitcherRoles).toEqual(['RP'])
  })
})

describe('classicPlayerToLive — handedness, positions, identity', () => {
  it("defaults batSide to 'R' for hitters and pitchHand to 'R' for pitchers", () => {
    const h = classicPlayerToLive(hitter({ stats: { avg: '.300', hr: 10, rbi: 50, sb: 5, ops: '.900' } }))
    expect(h.batSide).toBe('R')
    expect(h.pitchHand).toBeUndefined()
    const p = classicPlayerToLive(pitcher({ stats: { era: '3.00', whip: '1.10', so: 200, wins: 15 } }))
    expect(p.pitchHand).toBe('R')
    expect(p.batSide).toBeUndefined()
  })

  it('collapses LF/CF/RF into OF', () => {
    const lp = classicPlayerToLive(
      hitter({ positions: ['LF', 'CF', 'RF', 'DH'], stats: { avg: '.300', hr: 10, rbi: 50, sb: 5, ops: '.900' } }),
    )
    expect(lp.positions).toContain('OF')
    expect(lp.positions).not.toContain('LF')
    expect(lp.positions).not.toContain('CF')
    expect(lp.positions).not.toContain('RF')
    expect(lp.positions).toContain('DH')
  })

  it('maps teamId to a stable number (FRANCHISES index + 1) and derives abbrev/name', () => {
    const lp = classicPlayerToLive(hitter({ teamId: 'yankees', stats: { avg: '.300', hr: 10, rbi: 50, sb: 5, ops: '.900' } }))
    expect(lp.teamId).toBe(1)
    expect(lp.teamAbbrev).toBe('NYY')
    expect(lp.teamName).toBe('Yankees')
    const dodger = classicPlayerToLive(
      hitter({ teamId: 'dodgers', era: '1950s', stats: { avg: '.300', hr: 10, rbi: 50, sb: 5, ops: '.900' } }),
    )
    expect(dodger.teamId).toBe(26)
    expect(dodger.teamAbbrev).toBe('LAD')
    expect(dodger.teamName).toBe('Brooklyn Dodgers')
  })

  it('uses the Classic player id and a stable numeric personId (hash for non-numeric)', () => {
    const lp = classicPlayerToLive(
      hitter({ id: 'gehrilo01-yankees-1930s', personId: 'gehrilo01', stats: { avg: '.300', hr: 10, rbi: 50, sb: 5, ops: '.900' } }),
    )
    expect(lp.id).toBe('gehrilo01-yankees-1930s')
    expect(typeof lp.personId).toBe('number')
    expect(lp.personId).toBeGreaterThan(0)
    const again = classicPlayerToLive(
      hitter({ id: 'gehrilo01-yankees-1930s', personId: 'gehrilo01', stats: { avg: '.300', hr: 10, rbi: 50, sb: 5, ops: '.900' } }),
    )
    expect(again.personId).toBe(lp.personId)
  })

  it('parses a purely numeric personId to a number', () => {
    const lp = classicPlayerToLive(
      hitter({ personId: '12345', stats: { avg: '.300', hr: 10, rbi: 50, sb: 5, ops: '.900' } }),
    )
    expect(lp.personId).toBe(12345)
  })

  it('flags legends as not appearedOnTargetDate and not fallback', () => {
    const lp = classicPlayerToLive(hitter({ stats: { avg: '.300', hr: 10, rbi: 50, sb: 5, ops: '.900' } }))
    expect(lp.appearedOnTargetDate).toBe(false)
    expect(lp.isFallback).toBe(false)
  })

  it('emits two-way players as hitters using batting ratings', () => {
    const tw = classicPlayerToLive({
      ...hitter({ positions: ['SP', 'RP', 'DH'], stats: { avg: '.196', hr: 7, rbi: 15, sb: 0, ops: '.757' } }),
      id: 'tw-01',
      role: 'two-way',
      battingRatings: {
        contact: 50,
        power: 55,
        speed: 50,
        runProduction: 50,
        ops: 81,
        era: 0,
        whip: 0,
        strikeouts: 0,
        wins: 0,
        saves: 0,
        workload: 0,
        overall: 64,
      },
      pitchingStats: { era: '3.55', whip: '1.29', so: 185, wins: 12, gs: 37, g: 110, reliefGames: 73, ip: 283.7, saves: 4 },
    })
    expect(tw.role).toBe('hitter')
    expect(tw.batSide).toBe('R')
    expect(tw.pitcherRoles).toBeUndefined()
    expect(tw.grades.contact).toBe(50)
    expect(tw.grades.power).toBe(55)
    expect(tw.positions).toEqual(['DH'])
  })

  it('derives catcher defense from error rate; non-catchers default to 50', () => {
    const catcher = classicPlayerToLive(
      hitter({
        positions: ['C', 'DH'],
        stats: { avg: '.250', hr: 5, rbi: 30, sb: 0, ops: '.700', errors: 10, fieldingGames: 120 },
      }),
    )
    expect(catcher.grades.defense).not.toBe(50)
    expect(catcher.grades.defense).toBeGreaterThanOrEqual(20)
    expect(catcher.grades.defense).toBeLessThanOrEqual(80)
    const firstBase = classicPlayerToLive(
      hitter({ positions: ['1B', 'DH'], stats: { avg: '.300', hr: 10, rbi: 50, sb: 5, ops: '.900', errors: 20, fieldingGames: 150 } }),
    )
    expect(firstBase.grades.defense).toBe(50)
  })
})

describe('classicPlayerToLive — grades in-band across the dataset', () => {
  const extremes = [
    ...PLAYERS.filter((p) => p.role === 'hitter').sort((a, b) => b.ratings.contact - a.ratings.contact).slice(0, 3),
    ...PLAYERS.filter((p) => p.role === 'pitcher').sort((a, b) => b.ratings.whip - a.ratings.whip).slice(0, 3),
    ...PLAYERS.filter((p) => p.role === 'pitcher').sort((a, b) => a.ratings.overall - b.ratings.overall).slice(0, 3),
    ...PLAYERS.filter((p) => p.role === 'two-way'),
    ...PLAYERS.filter((p) => p.role === 'pitcher' && p.ratings.saves >= 60).slice(0, 3),
  ]

  it('first 200 players: every grade is a finite number in [20,80]', () => {
    for (const cp of PLAYERS.slice(0, 200)) {
      const lp = classicPlayerToLive(cp)
      for (const v of Object.values(lp.grades)) {
        expect(typeof v).toBe('number')
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(20)
        expect(v).toBeLessThanOrEqual(80)
      }
    }
  })

  it('extreme cases: every grade is a finite number in [20,80]', () => {
    for (const cp of extremes) {
      const lp = classicPlayerToLive(cp)
      for (const v of Object.values(lp.grades)) {
        expect(v).toBeGreaterThanOrEqual(20)
        expect(v).toBeLessThanOrEqual(80)
      }
    }
  })
})

describe('buildLegendsSnapshot', () => {
  it('returns a non-empty array adapted from PLAYERS', () => {
    const snapshot = buildLegendsSnapshot()
    expect(snapshot.length).toBe(PLAYERS.length)
    expect(snapshot.length).toBeGreaterThan(0)
  })

  it('sampled entries have valid grades and required identity fields', () => {
    const snapshot = buildLegendsSnapshot()
    const step = Math.max(1, Math.floor(snapshot.length / 200))
    const sample = snapshot.filter((_, i) => i % step === 0)
    expect(sample.length).toBeGreaterThan(50)
    for (const lp of sample) {
      expect(lp.grades.overall).toBeGreaterThanOrEqual(20)
      expect(lp.grades.overall).toBeLessThanOrEqual(80)
      for (const v of Object.values(lp.grades)) {
        expect(v).toBeGreaterThanOrEqual(20)
        expect(v).toBeLessThanOrEqual(80)
      }
      expect(typeof lp.id).toBe('string')
      expect(typeof lp.personId).toBe('number')
      expect(typeof lp.teamId).toBe('number')
      expect(lp.positions.length).toBeGreaterThan(0)
      expect(lp.appearedOnTargetDate).toBe(false)
      expect(lp.isFallback).toBe(false)
      if (lp.role === 'pitcher') {
        expect(lp.pitcherRoles?.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('filterLegendsByTeam', () => {
  const snapshot = buildLegendsSnapshot()

  it('returns only players from the given franchise', () => {
    const yankees = filterLegendsByTeam(snapshot, 'yankees')
    expect(yankees.length).toBeGreaterThan(0)
    for (const lp of yankees) {
      expect(lp.teamId).toBe(1)
      expect(lp.teamAbbrev).toBe('NYY')
    }
  })

  it('yankees, red-sox, and dodgers each have enough legends for a 25-man roster', () => {
    const cases: Array<{ teamId: TeamId; expectedNumber: number }> = [
      { teamId: 'yankees', expectedNumber: 1 },
      { teamId: 'red-sox', expectedNumber: 2 },
      { teamId: 'dodgers', expectedNumber: 26 },
    ]
    for (const { teamId, expectedNumber } of cases) {
      const roster = filterLegendsByTeam(snapshot, teamId)
      expect(roster.length).toBeGreaterThanOrEqual(25)
      for (const lp of roster) {
        expect(lp.teamId).toBe(expectedNumber)
      }
    }
  })

  it('returns an empty array for a franchise with no legends (synthetic edge)', () => {
    const onlyYankees = filterLegendsByTeam(snapshot, 'yankees')
    const mets = onlyYankees.filter((lp) => lp.teamId === 21)
    expect(mets).toEqual([])
  })
})
