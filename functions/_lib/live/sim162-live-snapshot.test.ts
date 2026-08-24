import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LiveDraftSnapshot } from '../../../shared/live/live-types'
import type { MlbDataSource } from './mlb-source'

vi.mock('./live-draft-snapshot', () => ({
  buildLiveDraftSnapshot: vi.fn(),
}))

const { buildSim162LiveSnapshot } = await import('./sim162-live-snapshot')
const { buildLiveDraftSnapshot } = await import('./live-draft-snapshot')

const stubSource = {
  schedule: vi.fn(),
  boxscore: vi.fn(),
  teamRoster: vi.fn(),
  seasonStats: vi.fn(),
  allTeams: vi.fn(),
  pitchArsenal: vi.fn(),
} as unknown as MlbDataSource

const stubDraft: LiveDraftSnapshot = {
  kind: 'live-draft',
  challengeDate: '2026-06-26',
  players: [
    {
      id: 'mlb-1',
      personId: 1,
      name: 'Live Hitter',
      teamId: 147,
      teamAbbrev: 'NYY',
      teamName: 'Yankees',
      positions: ['1B'],
      role: 'hitter',
      grades: { overall: 60 },
      appearedOnTargetDate: true,
      isFallback: false,
    },
  ],
  coinFlipUserFirst: true,
  simSeed: '2026-06-26|live-draft',
}

describe('buildSim162LiveSnapshot', () => {
  beforeEach(() => {
    vi.mocked(buildLiveDraftSnapshot).mockReset()
  })

  it('delegates to buildLiveDraftSnapshot and reshapes into a sim162-live snapshot', async () => {
    vi.mocked(buildLiveDraftSnapshot).mockResolvedValue(stubDraft)

    const snapshot = await buildSim162LiveSnapshot('2026-06-26', stubSource)

    expect(buildLiveDraftSnapshot).toHaveBeenCalledWith('2026-06-26', stubSource)
    expect(snapshot.kind).toBe('sim162-live')
    expect(snapshot.simSeed).toBe('2026-06-26|sim162-live')
    expect(snapshot.players).toBe(stubDraft.players)
    expect(snapshot.players[0].teamId).toBe(147)
    expect(snapshot.players[0].teamName).toBe('Yankees')
  })

  it('drops the live-draft-only fields (coinFlipUserFirst) from the sim162 shape', async () => {
    vi.mocked(buildLiveDraftSnapshot).mockResolvedValue(stubDraft)
    const snapshot = await buildSim162LiveSnapshot('2026-06-26', stubSource)
    expect(snapshot).not.toHaveProperty('coinFlipUserFirst')
    expect(snapshot).not.toHaveProperty('challengeDate')
  })
})
