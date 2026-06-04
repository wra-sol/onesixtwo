import { describe, expect, it } from 'vitest'
import type { HitterStats, PitcherStats, Player } from './types'
import {
  comparePlayersRandom,
  formatPlayerSlashLine,
  formatPlayerTotals,
  formatSimulatedSlashLine,
  formatSimulatedTotals,
  seasonHitterCounts,
  seasonHitterErrors,
  seasonPitcherCounts,
  seasonReliefPitcherCounts,
  seasonStarterPitcherCounts,
  simulatedSeasonRates,
} from './player-stats'
import { STANDARD_RP_IP } from './calibration'

function hitterPlayer(stats: HitterStats): Player {
  return {
    id: 'test-h',
    personId: 'test-h',
    name: 'Test Hitter',
    teamId: 'yankees',
    teamName: 'Yankees',
    era: '2000s',
    role: 'hitter',
    positions: ['RF'],
    stats,
    ratings: {
      contact: 80,
      power: 80,
      speed: 80,
      runProduction: 80,
      ops: 80,
      era: 0,
      whip: 0,
      strikeouts: 0,
      wins: 0,
      saves: 0,
      workload: 0,
      overall: 80,
    },
  }
}

function pitcherPlayer(stats: PitcherStats): Player {
  return {
    id: 'test-p',
    personId: 'test-p',
    name: 'Test Pitcher',
    teamId: 'yankees',
    teamName: 'Yankees',
    era: '2000s',
    role: 'pitcher',
    positions: ['SP'],
    stats,
    ratings: {
      contact: 0,
      power: 0,
      speed: 0,
      runProduction: 0,
      ops: 0,
      era: 85,
      whip: 85,
      strikeouts: 85,
      wins: 85,
      saves: 50,
      workload: 85,
      overall: 85,
    },
  }
}

describe('seasonHitterCounts', () => {
  it('prorates counting stats to 600 plate appearances', () => {
    const counts = seasonHitterCounts({
      avg: '.300',
      hr: 40,
      rbi: 120,
      sb: 20,
      ops: '.900',
      pa: 500,
      g: 140,
    })
    expect(counts.hr).toBe(Math.round(40 * (600 / 500)))
    expect(counts.rbi).toBe(Math.round(120 * (600 / 500)))
    expect(counts.sb).toBe(Math.round(20 * (600 / 500)))
  })

  it('falls back to 162-game proration when plate appearances are absent', () => {
    const counts = seasonHitterCounts({
      avg: '.300',
      hr: 40,
      rbi: 120,
      sb: 20,
      ops: '.900',
      g: 140,
    })
    expect(counts.hr).toBe(Math.round(40 * (162 / 140)))
    expect(counts.rbi).toBe(Math.round(120 * (162 / 140)))
    expect(counts.sb).toBe(Math.round(20 * (162 / 140)))
  })
})

describe('seasonHitterErrors', () => {
  it('prorates errors to 162 fielding games', () => {
    expect(
      seasonHitterErrors({
        avg: '.250',
        hr: 10,
        rbi: 40,
        sb: 2,
        ops: '.700',
        errors: 24,
        fieldingGames: 81,
      }),
    ).toBe(48)
  })

  it('returns null when errors are absent', () => {
    expect(
      seasonHitterErrors({
        avg: '.250',
        hr: 10,
        rbi: 40,
        sb: 2,
        ops: '.700',
      }),
    ).toBeNull()
  })
})

describe('hitter fielding totals formatting', () => {
  it('appends prorated errors to card and simulated totals', () => {
    const player = hitterPlayer({
      avg: '.270',
      hr: 20,
      rbi: 70,
      sb: 8,
      ops: '.780',
      pa: 600,
      errors: 18,
      fieldingGames: 162,
    })
    expect(formatPlayerTotals(player)).toContain('18 E')
    expect(formatSimulatedTotals(player)).toContain('18 E')
  })
})

describe('seasonPitcherCounts', () => {
  it('prorates counting stats to 30 starts', () => {
    const counts = seasonPitcherCounts({
      era: '3.50',
      whip: '1.20',
      so: 164,
      wins: 41,
      gs: 82,
    })
    expect(counts.wins).toBe(Math.round(41 * (30 / 82)))
    expect(counts.so).toBe(Math.round(164 * (30 / 82)))
  })
})

describe('seasonReliefPitcherCounts', () => {
  it('prorates counting stats to standard RP innings', () => {
    const counts = seasonReliefPitcherCounts({
      era: '2.50',
      whip: '1.00',
      so: 669,
      wins: 45,
      gs: 0,
      g: 1302,
      reliefGames: 1302,
      ip: 713,
    })
    expect(counts.so).toBe(Math.round(669 * (STANDARD_RP_IP / 713)))
    expect(counts.wins).toBe(Math.round(45 * (STANDARD_RP_IP / 713)))
  })

  it('does not inflate gs=0 closers to a 30-start scale', () => {
    const relief = seasonReliefPitcherCounts({
      era: '2.50',
      whip: '1.00',
      so: 100,
      wins: 5,
      gs: 0,
      g: 65,
      reliefGames: 65,
      ip: 120,
    })
    const starter = seasonStarterPitcherCounts({
      era: '2.50',
      whip: '1.00',
      so: 100,
      wins: 5,
      gs: 0,
      g: 65,
      reliefGames: 65,
      ip: 120,
    })
    expect(relief.so).toBeLessThan(starter.so)
  })
})

describe('pitcher totals formatting', () => {
  it('displays raw pitcher totals prorated to 30 starts', () => {
    const player = pitcherPlayer({
      era: '3.50',
      whip: '1.20',
      so: 164,
      wins: 41,
      gs: 82,
    })

    expect(formatPlayerTotals(player)).toBe('60 K · 15 W')
  })

  it('uses relief proration for RP-only profiles on cards', () => {
    const player = pitcherPlayer({
      era: '2.50',
      whip: '1.00',
      so: 100,
      wins: 5,
      gs: 0,
      g: 65,
      reliefGames: 65,
      ip: 120,
    })
    player.positions = ['RP']
    const counts = seasonReliefPitcherCounts(player.stats as PitcherStats)
    expect(formatPlayerTotals(player)).toBe(
      `${counts.so.toLocaleString('en-US')} K · ${counts.wins.toLocaleString('en-US')} W`,
    )
  })

  it('uses relief proration in simulated RP rows', () => {
    const player = pitcherPlayer({
      era: '2.50',
      whip: '1.00',
      so: 669,
      wins: 45,
      gs: 0,
      g: 1302,
      reliefGames: 1302,
      ip: 713,
    })
    player.positions = ['RP']
    const counts = seasonReliefPitcherCounts(player.stats as PitcherStats)
    expect(formatSimulatedTotals(player, 'RP')).toBe(
      `${counts.so.toLocaleString('en-US')} K · ${counts.wins.toLocaleString('en-US')} W`,
    )
  })

  it('shows prorated saves on relief cards when present', () => {
    const player = pitcherPlayer({
      era: '2.50',
      whip: '1.00',
      so: 100,
      wins: 5,
      saves: 228,
      gs: 0,
      g: 439,
      reliefGames: 439,
      ip: 473,
    })
    player.positions = ['RP']
    expect(formatPlayerTotals(player)).toContain('SV')
  })
})

describe('two-way player stat formatting', () => {
  it('shows both batting and pitching lines on draft cards', () => {
    const player: Player = {
      id: 'tw',
      personId: 'tw',
      name: 'Two-Way Star',
      teamId: 'angels',
      teamName: 'Angels',
      era: '2010s',
      role: 'two-way',
      positions: ['SP', 'DH'],
      stats: {
        avg: '.286',
        obp: '.350',
        slg: '.455',
        hr: 40,
        rbi: 123,
        sb: 22,
        ops: '.805',
        pa: 600,
      },
      battingStats: {
        avg: '.286',
        obp: '.350',
        slg: '.455',
        hr: 40,
        rbi: 123,
        sb: 22,
        ops: '.805',
        pa: 600,
      },
      pitchingStats: {
        era: '3.31',
        whip: '1.12',
        so: 180,
        wins: 12,
        gs: 30,
        g: 31,
      },
      ratings: {
        contact: 80,
        power: 80,
        speed: 70,
        runProduction: 80,
        ops: 80,
        era: 85,
        whip: 85,
        strikeouts: 85,
        wins: 80,
        saves: 50,
        workload: 80,
        overall: 82,
      },
    }

    expect(formatPlayerSlashLine(player)).toContain('.286 / .350 / .455')
    expect(formatPlayerSlashLine(player)).toContain('3.31 ERA')
    expect(formatPlayerSlashLine(player)).toContain('1.12 WHIP')
    expect(formatPlayerTotals(player)).toContain('40 HR')
    expect(formatPlayerTotals(player)).toContain('180 K')
  })
})

describe('simulatedSeasonRates', () => {
  it('is deterministic for the same seed and position', () => {
    const player = hitterPlayer({
      avg: '.285',
      obp: '.380',
      slg: '.520',
      hr: 35,
      rbi: 100,
      sb: 10,
      ops: '.900',
      g: 500,
    })
    const a = simulatedSeasonRates(player, 'seed-a', 'RF')
    const b = simulatedSeasonRates(player, 'seed-a', 'RF')
    expect(a).toEqual(b)
  })

  it('differs when simulation seed changes', () => {
    const player = hitterPlayer({
      avg: '.285',
      obp: '.380',
      slg: '.520',
      hr: 35,
      rbi: 100,
      sb: 10,
      ops: '.900',
      g: 500,
    })
    const a = formatSimulatedSlashLine(player, 'seed-a', 'RF')
    const b = formatSimulatedSlashLine(player, 'seed-b', 'RF')
    expect(a).not.toBe(b)
  })

  it('keeps obp at or above avg for triple-slash hitters', () => {
    const player = hitterPlayer({
      avg: '.310',
      obp: '.400',
      slg: '.550',
      hr: 40,
      rbi: 110,
      sb: 5,
      ops: '.950',
      g: 600,
    })
    for (let i = 0; i < 20; i++) {
      const rates = simulatedSeasonRates(
        player,
        `seed-${i}`,
        'RF',
      ) as { avg: string; obp?: string; slg?: string }
      expect(parseRate(rates.obp!)).toBeGreaterThanOrEqual(parseRate(rates.avg))
      expect(parseRate(rates.slg!)).toBeGreaterThanOrEqual(parseRate(rates.avg))
    }
  })

  it('clamps pitcher era and whip to plausible ranges', () => {
    const player = pitcherPlayer({
      era: '2.50',
      whip: '1.00',
      so: 300,
      wins: 20,
      gs: 100,
    })
    for (let i = 0; i < 20; i++) {
      const rates = simulatedSeasonRates(player, `seed-${i}`, 'SP') as {
        era: string
        whip: string
      }
      const era = parseFloat(rates.era)
      const whip = parseFloat(rates.whip)
      expect(era).toBeGreaterThanOrEqual(1.5)
      expect(era).toBeLessThanOrEqual(7)
      expect(whip).toBeGreaterThanOrEqual(0.85)
      expect(whip).toBeLessThanOrEqual(2)
    }
  })
})

function parseRate(value: string): number {
  return Number.parseFloat(value)
}

describe('comparePlayersRandom', () => {
  it('is deterministic for the same players and seed', () => {
    const a = hitterPlayer({
      avg: '.300',
      hr: 40,
      rbi: 120,
      sb: 20,
      ops: '.900',
    })
    const b = hitterPlayer({
      avg: '.250',
      hr: 20,
      rbi: 80,
      sb: 5,
      ops: '.750',
    })
    b.id = 'test-h-b'
    b.personId = 'test-h-b'

    const first = comparePlayersRandom(a, b, 'seed-1')
    const second = comparePlayersRandom(a, b, 'seed-1')
    expect(first).toBe(second)
  })

  it('changes order when the seed changes', () => {
    const players = ['a', 'b', 'c', 'd', 'e'].map((id) => {
      const player = hitterPlayer({
        avg: '.280',
        hr: 30,
        rbi: 90,
        sb: 10,
        ops: '.850',
      })
      player.id = id
      player.personId = id
      return player
    })

    function sortedIds(seed: string): string[] {
      return [...players]
        .sort((a, b) => comparePlayersRandom(a, b, seed))
        .map((p) => p.id)
    }

    const orderA = sortedIds('seed-a')
    const orderB = sortedIds('seed-b')
    expect(orderA).not.toEqual(orderB)
  })
})
