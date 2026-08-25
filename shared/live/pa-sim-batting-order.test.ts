import { describe, expect, it } from 'vitest'
import { buildSimTeam, simulateGame } from './pa-sim'
import type { LivePlayer } from './live-types'
import type { DailyLineup, DailyLineupPosition } from './daily-roster'

let synth = 0

function makeHitter(name: string, contact: number): LivePlayer {
  synth += 1
  const overall = contact
  return {
    id: `synth-h-${synth}`,
    personId: 910000 + synth,
    name,
    teamId: 999,
    teamAbbrev: 'SYN',
    teamName: 'Synthetic',
    positions: ['DH'],
    role: 'hitter',
    batSide: 'R',
    grades: { contact, power: contact - 10, speed: 50, defense: 50, overall },
    appearedOnTargetDate: true,
    isFallback: false,
  }
}

function makePitcher(name: string, stuff: number): LivePlayer {
  synth += 1
  const overall = stuff
  return {
    id: `synth-p-${synth}`,
    personId: 900000 + synth,
    name,
    teamId: 998,
    teamAbbrev: 'SYN',
    teamName: 'Synthetic',
    positions: ['SP'],
    role: 'pitcher',
    pitchHand: 'R',
    grades: { stuff, command: stuff, stamina: stuff, defense: overall, overall },
    appearedOnTargetDate: true,
    isFallback: false,
    pitcherRoles: ['SP', 'RP', 'CL'],
  }
}

function battingOrderOf(prefix: string): LivePlayer[] {
  // Slot order matters: descending skill mirrors defaultBattingOrderFromLineup,
  // which is exactly what made bottom-of-order zero-PA games visible.
  return Array.from({ length: 9 }, (_, i) =>
    makeHitter(`${prefix} slot${i + 1}`, 60 - i),
  )
}

function buildTeam(name: string): ReturnType<typeof buildSimTeam> {
  const order = battingOrderOf(name)
  const lineup = {} as DailyLineup
  const positions: DailyLineupPosition[] = [
    'C', '1B', '2B', '3B', 'SS', 'OF1', 'OF2', 'OF3', 'DH', 'SP', 'RP', 'CL',
  ]
  order.forEach((player, i) => {
    lineup[positions[i]!] = player
  })
  lineup.SP = makePitcher(`${name} SP`, 55)
  lineup.RP = makePitcher(`${name} RP`, 55)
  lineup.CL = makePitcher(`${name} CL`, 55)
  return buildSimTeam(name, lineup, order, true)
}

const PA_TYPES = new Set([
  'out', 'strikeout', 'walk', 'single', 'double', 'triple', 'home_run',
])

function plateAppearancesByBatter(
  events: ReturnType<typeof simulateGame>['events'],
  half: 'top' | 'bottom',
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const event of events) {
    if (event.half !== half || !PA_TYPES.has(event.type)) continue
    counts.set(event.batterName, (counts.get(event.batterName) ?? 0) + 1)
  }
  return counts
}

describe('simulateGame batting-order continuity', () => {
  it('gives every hitter in the order at least one plate appearance', () => {
    const user = buildTeam('User')
    const opponent = buildTeam('Opponent')

    for (const seed of ['order-continuity-a', 'order-continuity-b', 'order-continuity-c']) {
      const result = simulateGame(user, opponent, seed, false)

      const awayPas = plateAppearancesByBatter(result.events, 'top')
      const homePas = plateAppearancesByBatter(result.events, 'bottom')

      expect(awayPas.size).toBe(9)
      expect(homePas.size).toBe(9)
    }
  })

  it('keeps the same seed reproducible across runs', () => {
    const user = buildTeam('User')
    const opponent = buildTeam('Opponent')
    const a = simulateGame(user, opponent, 'repro-seed', false)
    const b = simulateGame(user, opponent, 'repro-seed', false)
    expect(a.events.map((e) => `${e.batterName}:${e.type}`)).toEqual(
      b.events.map((e) => `${e.batterName}:${e.type}`),
    )
  })
})
