import { describe, expect, it } from 'vitest'
import type { Player, PitcherStats } from './types'
import { pitcherComponentScore, reliefComponentScore } from './pitching-contributors'

function closer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'closer',
    personId: 'closer',
    name: 'Elite Closer',
    teamId: 'yankees',
    teamName: 'Yankees',
    era: '1990s',
    role: 'pitcher',
    positions: ['RP'],
    stats: {
      era: '2.20',
      whip: '0.95',
      so: 80,
      wins: 4,
      saves: 228,
      gs: 0,
      g: 439,
      reliefGames: 439,
      ip: 473,
    } satisfies PitcherStats,
    ratings: {
      contact: 0,
      power: 0,
      speed: 0,
      runProduction: 0,
      ops: 0,
      era: 95,
      whip: 95,
      strikeouts: 90,
      wins: 55,
      saves: 95,
      workload: 90,
      overall: 94,
    },
    ...overrides,
  }
}

describe('reliefComponentScore', () => {
  it('weights save value more heavily than starter scoring', () => {
    const eliteCloser = closer()
    const lowSaveCloser = closer({
      ratings: {
        ...eliteCloser.ratings,
        saves: 52,
        overall: 78,
      },
    })

    const reliefHighSaves = reliefComponentScore([eliteCloser])
    const reliefLowSaves = reliefComponentScore([lowSaveCloser])
    const starterHighSaves = pitcherComponentScore([eliteCloser])
    const starterLowSaves = pitcherComponentScore([lowSaveCloser])

    expect(reliefHighSaves - reliefLowSaves).toBeGreaterThan(
      starterHighSaves - starterLowSaves,
    )
    expect(reliefHighSaves).toBeGreaterThan(reliefLowSaves)
  })
})
