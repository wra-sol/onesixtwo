import { describe, expect, it } from 'vitest'
import {
  createEmptyRoster25,
  roster25FromPlayerIds,
  roster25IsComplete,
  roster25ToPlayerIds,
  roster25ToSeed,
  type Roster25,
  type Roster25Slot,
} from './roster25'
import {
  lineupSeriesGameSeed,
  regularSeasonGameSeed,
  rosterSeriesGameSeed,
  sim162SeasonSeed,
} from './seeds'
import type { LivePlayer } from './live-types'

function player(id: string): LivePlayer {
  return {
    id,
    personId: id.length,
    name: id,
    teamId: 1,
    teamAbbrev: 'T',
    teamName: 'T',
    positions: ['OF'],
    role: 'hitter',
    grades: { contact: 50, power: 50, speed: 50, defense: 50, overall: 50 },
    appearedOnTargetDate: true,
    isFallback: false,
  }
}

function filledRoster(prefix = 'p'): Roster25 {
  const roster = createEmptyRoster25()
  const slots = Object.keys(roster) as Roster25Slot[]
  slots.forEach((slot, i) => {
    roster[slot] = player(`${prefix}${i}`)
  })
  return roster
}

describe('Sim 162 determinism contract', () => {
  it('round-trips roster → ids → roster without loss', () => {
    const roster = filledRoster()
    expect(roster25IsComplete(roster)).toBe(true)

    const ids = roster25ToPlayerIds(roster)
    expect(ids.length).toBe(25)

    // Decode against a map containing the real players.
    const decoded = roster25FromPlayerIds(ids, new Map([
      ...Array.from({ length: 25 }, (_, i) => [`p${i}`, player(`p${i}`)] as const),
    ]))

    expect(roster25ToSeed(decoded)).toBe(roster25ToSeed(roster))
    expect(roster25IsComplete(decoded)).toBe(true)
  })

  it('season seed depends on both roster composition and sim seed', () => {
    const a = sim162SeasonSeed(filledRoster('a'), 'seed-1')
    const b = sim162SeasonSeed(filledRoster('b'), 'seed-1')
    const c = sim162SeasonSeed(filledRoster('a'), 'seed-2')
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
    expect(a).toBe(sim162SeasonSeed(filledRoster('a'), 'seed-1'))
  })

  it('share-encoded season replays the identical season seed', () => {
    // The exact flow of useSim162Session (encode) and sim162-share (decode):
    // the decoded roster must reproduce the encoded season seed.
    const roster = filledRoster()
    const simSeed = 'snap-seed'
    const encodedIds = roster25ToPlayerIds(roster)

    const poolById = new Map(encodedIds.map((id) => [id, player(id)]))
    const decoded = roster25FromPlayerIds(encodedIds, poolById)

    expect(sim162SeasonSeed(decoded, simSeed)).toBe(
      sim162SeasonSeed(roster, simSeed),
    )
  })
})

describe('game seed formats', () => {
  it('each dialect is namespaced and index-varying', () => {
    expect(regularSeasonGameSeed('s', 0)).toBe('s|reg0')
    expect(regularSeasonGameSeed('s', 1)).toBe('s|reg1')
    expect(rosterSeriesGameSeed('s', 0)).toBe('s|g0')
    expect(lineupSeriesGameSeed('s', 0)).toBe('s|game0')
    // Dialects must never collide across contexts sharing a base seed.
    const values = [
      regularSeasonGameSeed('s', 3),
      rosterSeriesGameSeed('s', 3),
      lineupSeriesGameSeed('s', 3),
    ]
    expect(new Set(values).size).toBe(3)
  })
})
