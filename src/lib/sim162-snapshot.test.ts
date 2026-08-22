import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSim162Snapshot, type Sim162Snapshot } from './sim162-snapshot'
import { buildLegendsSnapshotForSim162 } from './classic-live-adapter'
import { filterSim162PlayersByTeam } from '@shared/live/sim162-snapshot'
import { FRANCHISES } from '../data/franchises'
import type { LivePlayer } from '@shared/live/live-types'

const FRANCHISE_NUMBER: Record<string, number> = Object.fromEntries(
  FRANCHISES.map((f, i) => [f.id, i + 1]),
)

describe('buildLegendsSnapshotForSim162', () => {
  it('returns a non-empty Sim162Snapshot with kind sim162-legends', () => {
    const snapshot = buildLegendsSnapshotForSim162()
    expect(snapshot.kind).toBe('sim162-legends')
    expect(snapshot.simSeed).toBe('sim162-legends')
    expect(snapshot.players.length).toBeGreaterThan(0)
  })

  it('tags every player with a numeric teamId and teamName', () => {
    const { players } = buildLegendsSnapshotForSim162()
    for (const p of players) {
      expect(typeof p.teamId).toBe('number')
      expect(p.teamId).toBeGreaterThan(0)
      expect(typeof p.teamName).toBe('string')
      expect(p.teamName.length).toBeGreaterThan(0)
    }
  })
})

describe('filterSim162PlayersByTeam', () => {
  const { players } = buildLegendsSnapshotForSim162()

  it('returns only players whose teamId matches the given number', () => {
    const yankees = filterSim162PlayersByTeam(players, FRANCHISE_NUMBER['yankees'])
    expect(yankees.length).toBeGreaterThan(0)
    for (const lp of yankees) {
      expect(lp.teamId).toBe(FRANCHISE_NUMBER['yankees'])
    }
    const empty = filterSim162PlayersByTeam(players, 9999)
    expect(empty).toEqual([])
  })

  it('yankees, red-sox, and dodgers each have enough legends for a 25-man roster', () => {
    const cases = ['yankees', 'red-sox', 'dodgers'] as const
    for (const franchise of cases) {
      const roster = filterSim162PlayersByTeam(players, FRANCHISE_NUMBER[franchise])
      expect(roster.length).toBeGreaterThanOrEqual(25)
      for (const lp of roster) {
        expect(lp.teamId).toBe(FRANCHISE_NUMBER[franchise])
      }
    }
  })
})

describe('fetchSim162Snapshot', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('legends pool returns the legends snapshot without a network fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const snapshot = await fetchSim162Snapshot('legends', '2026-06-26')
    expect(snapshot.kind).toBe('sim162-legends')
    expect(snapshot.simSeed).toBe('sim162-legends')
    expect(snapshot.players.length).toBeGreaterThan(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('live pool calls the sim162-live-snapshot endpoint and parses the response', async () => {
    const stubPlayer: LivePlayer = {
      id: 'mlb-1',
      personId: 1,
      name: 'Test Live',
      teamId: 147,
      teamAbbrev: 'NYY',
      teamName: 'Yankees',
      positions: ['1B'],
      role: 'hitter',
      grades: { overall: 60 },
      appearedOnTargetDate: true,
      isFallback: false,
    }
    const stub: Sim162Snapshot = {
      kind: 'sim162-live',
      players: [stubPlayer],
      simSeed: '2026-06-26|sim162-live',
    }
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(stub), { status: 200 }))

    const snapshot = await fetchSim162Snapshot('live', '2026-06-26')
    expect(snapshot.kind).toBe('sim162-live')
    expect(snapshot.simSeed).toBe('2026-06-26|sim162-live')
    expect(snapshot.players).toHaveLength(1)
    expect(snapshot.players[0].teamId).toBe(147)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]![0]).toBe('/api/sim162-live-snapshot?date=2026-06-26')
  })

  it('live pool surfaces an error when the endpoint fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'upstream down' }), { status: 503 }),
    )
    await expect(fetchSim162Snapshot('live', '2026-06-26')).rejects.toThrow(
      'upstream down',
    )
  })
})
