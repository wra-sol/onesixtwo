import { describe, expect, it } from 'vitest'
import { createEmptyRoster25 } from './roster25'
import {
  buildOpponentRoster25SimTeam,
  buildRoster25SimTeam,
  catcherDefenseForBattingOrder,
} from './sim162-team'
import type { LivePlayer } from './live-types'

function hitter(id: string, positions: string[], defense = 50): LivePlayer {
  return {
    id,
    personId: id.length * 1000,
    name: `Player ${id}`,
    teamId: 1,
    teamAbbrev: 'TST',
    teamName: 'Test',
    positions: positions as LivePlayer['positions'],
    role: 'hitter',
    grades: { contact: 50, power: 50, speed: 50, defense, overall: 50 },
    appearedOnTargetDate: true,
    isFallback: false,
  }
}

function pitcher(id: string, roles: string[]): LivePlayer {
  return {
    id,
    personId: id.length * 2000,
    name: `Arm ${id}`,
    teamId: 1,
    teamAbbrev: 'TST',
    teamName: 'Test',
    positions: ['SP'],
    role: 'pitcher',
    grades: { stuff: 50, command: 50, stamina: 50, defense: 50, overall: 50 },
    appearedOnTargetDate: true,
    isFallback: false,
    pitcherRoles: roles as LivePlayer['pitcherRoles'],
  }
}

describe('buildRoster25SimTeam', () => {
  it('takes catcher defense from the roster C slot, not the batting order', () => {
    const roster = createEmptyRoster25()
    roster.C1 = hitter('c1', ['C'], 77)
    roster.C2 = hitter('c2', ['C'], 30)
    // Fill remaining slots with non-catchers.
    const others = [
      '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH',
      'BENCH1', 'BENCH2', 'BENCH3',
    ] as const
    for (const slot of others) {
      roster[slot] = hitter(slot.toLowerCase(), [slot === 'DH' ? 'DH' : slot])
    }
    for (let i = 0; i < 5; i += 1) {
      roster[`SP${(i + 1) as 1 | 2 | 3 | 4 | 5}`] = pitcher(`sp${i}`, ['SP'])
    }
    for (let i = 0; i < 6; i += 1) {
      roster[`RP${(i + 1) as 1 | 2 | 3 | 4 | 5 | 6}`] = pitcher(`rp${i}`, ['RP'])
    }
    roster.CL = pitcher('cl', ['CL'])

    const team = buildRoster25SimTeam(roster)
    expect(team.catcherDefense).toBe(77)
    expect(team.battingOrder.length).toBe(9)
    expect(team.rotation.length).toBe(5)
  })
})

describe('catcherDefenseForBattingOrder', () => {
  it('finds the catcher in the order and defaults to 50 without one', () => {
    expect(
      catcherDefenseForBattingOrder([hitter('a', ['C'], 64), hitter('b', ['SS'])]),
    ).toBe(64)
    expect(catcherDefenseForBattingOrder([hitter('a', ['SS'])])).toBe(50)
  })
})

describe('buildOpponentRoster25SimTeam', () => {
  it('pads thin franchises with fallback players to legal sizes', () => {
    const team = buildOpponentRoster25SimTeam('thin', 'Thin Franchise', [], null)
    expect(team.battingOrder.length).toBe(9)
    expect(team.bench.length).toBe(3)
    expect(team.rotation.length).toBe(5)
    expect(team.bullpen.length).toBe(7)
    expect(team.catcherDefense).toBe(50)
    expect(team.battingOrder.every((p) => p.isFallback)).toBe(true)
  })
})
