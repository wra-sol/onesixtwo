import { describe, expect, it } from 'vitest'
import { deriveTeamOptions } from './team-options'
import type { LivePlayer } from '@shared/live/live-types'

function player(id: string, teamAbbrev: string, teamName: string): LivePlayer {
  return {
    id,
    personId: Number(id),
    name: `Player ${id}`,
    teamId: Number(id),
    teamAbbrev,
    teamName,
    positions: ['C'],
    role: 'hitter',
    grades: { overall: 50 },
    appearedOnTargetDate: true,
    isFallback: false,
  }
}

describe('deriveTeamOptions', () => {
  it('returns unique teams sorted by name with counts', () => {
    const options = deriveTeamOptions([
      player('1', 'NYY', 'New York Yankees'),
      player('2', 'ATL', 'Atlanta Braves'),
      player('3', 'NYY', 'New York Yankees'),
    ])
    expect(options).toEqual([
      { abbrev: 'ATL', name: 'Atlanta Braves', count: 1 },
      { abbrev: 'NYY', name: 'New York Yankees', count: 2 },
    ])
  })

  it('returns an empty list for an empty pool', () => {
    expect(deriveTeamOptions([])).toEqual([])
  })
})
