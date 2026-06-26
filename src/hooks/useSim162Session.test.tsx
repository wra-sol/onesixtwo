import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sim162Snapshot } from '@shared/live/sim162-snapshot'
import type {
  LivePlayer,
  LivePlayerPosition,
  PitcherRoleSlot,
} from '@shared/live/live-types'
import { useSim162Session } from './useSim162Session'

vi.mock('@/lib/sim162-snapshot', () => ({
  fetchSim162Snapshot: vi.fn(),
}))

vi.mock('@/lib/text', () => ({
  normalizeForSearch: (text: string) => text.toLowerCase(),
}))

const { fetchSim162Snapshot } = await import('@/lib/sim162-snapshot')

function makePlayer(
  id: string,
  teamId: number,
  positions: LivePlayerPosition[],
  role: 'hitter' | 'pitcher',
  pitcherRoles?: PitcherRoleSlot[],
): LivePlayer {
  return {
    id,
    personId: teamId,
    name: `Player ${id}`,
    teamId,
    teamAbbrev: `T${teamId}`,
    teamName: `Team ${teamId}`,
    positions,
    role,
    grades: { overall: 50 },
    appearedOnTargetDate: true,
    isFallback: false,
    pitcherRoles,
  }
}

function makeFullSnapshot(): Sim162Snapshot {
  const players: LivePlayer[] = [
    makePlayer('c1', 1, ['C'], 'hitter'),
    makePlayer('c2', 2, ['C'], 'hitter'),
    makePlayer('1b', 3, ['1B'], 'hitter'),
    makePlayer('2b', 4, ['2B'], 'hitter'),
    makePlayer('3b', 5, ['3B'], 'hitter'),
    makePlayer('ss', 6, ['SS'], 'hitter'),
    makePlayer('lf', 7, ['OF'], 'hitter'),
    makePlayer('cf', 8, ['OF'], 'hitter'),
    makePlayer('rf', 9, ['OF'], 'hitter'),
    makePlayer('dh', 10, ['DH'], 'hitter'),
    makePlayer('b1', 11, ['1B'], 'hitter'),
    makePlayer('b2', 12, ['2B'], 'hitter'),
    makePlayer('b3', 13, ['3B'], 'hitter'),
    makePlayer('sp1', 14, ['SP'], 'pitcher', ['SP']),
    makePlayer('sp2', 15, ['SP'], 'pitcher', ['SP']),
    makePlayer('sp3', 16, ['SP'], 'pitcher', ['SP']),
    makePlayer('sp4', 17, ['SP'], 'pitcher', ['SP']),
    makePlayer('sp5', 18, ['SP'], 'pitcher', ['SP']),
    makePlayer('rp1', 19, ['RP'], 'pitcher', ['RP']),
    makePlayer('rp2', 20, ['RP'], 'pitcher', ['RP']),
    makePlayer('rp3', 21, ['RP'], 'pitcher', ['RP']),
    makePlayer('rp4', 22, ['RP'], 'pitcher', ['RP']),
    makePlayer('rp5', 23, ['RP'], 'pitcher', ['RP']),
    makePlayer('rp6', 24, ['RP'], 'pitcher', ['RP']),
    makePlayer('cl', 25, ['CL'], 'pitcher', ['CL']),
  ]
  return {
    kind: 'sim162-legends',
    players,
    simSeed: 'test-seed',
  }
}

describe('useSim162Session', () => {
  beforeEach(() => {
    vi.mocked(fetchSim162Snapshot).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with null pool and no snapshot', () => {
    const { result } = renderHook(() => useSim162Session())
    expect(result.current.pool).toBeNull()
    expect(result.current.snapshot).toBeNull()
    expect(result.current.draftState).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('loads the snapshot when pool is set', async () => {
    vi.mocked(fetchSim162Snapshot).mockResolvedValue(makeFullSnapshot())
    const { result } = renderHook(() => useSim162Session())

    act(() => result.current.setPool('legends'))

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.pool).toBe('legends')
    expect(result.current.snapshot).not.toBeNull()
    expect(result.current.snapshot!.players).toHaveLength(25)
    expect(result.current.draftState).not.toBeNull()
    expect(result.current.draftState!.status).toBe('drafting')
    expect(result.current.error).toBeNull()
  })

  it('accepts an initial pool and loads on mount', async () => {
    vi.mocked(fetchSim162Snapshot).mockResolvedValue(makeFullSnapshot())
    const { result } = renderHook(() => useSim162Session('legends'))

    await waitFor(() => {
      expect(result.current.snapshot).not.toBeNull()
    })

    expect(result.current.pool).toBe('legends')
    expect(result.current.draftState).not.toBeNull()
  })

  it('surfaces an error when the fetch fails', async () => {
    vi.mocked(fetchSim162Snapshot).mockRejectedValue(new Error('Network down'))
    const { result } = renderHook(() => useSim162Session())

    act(() => result.current.setPool('live'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Network down')
    expect(result.current.snapshot).toBeNull()
    expect(result.current.draftState).toBeNull()
  })

  it('selects a player and assigns to a slot', async () => {
    vi.mocked(fetchSim162Snapshot).mockResolvedValue(makeFullSnapshot())
    const { result } = renderHook(() => useSim162Session('legends'))

    await waitFor(() => {
      expect(result.current.draftState).not.toBeNull()
    })

    const catcher = result.current.snapshot!.players[0]!
    act(() => result.current.handleSelect(catcher))
    expect(result.current.selectedPlayer?.id).toBe('c1')

    act(() => result.current.handleAssign('C1'))
    expect(result.current.selectedPlayer).toBeNull()
    expect(result.current.draftState!.roster.C1?.id).toBe('c1')
    expect(result.current.draftState!.draftedPlayerIds).toContain('c1')
  })

  it('auto-fills the remaining roster', async () => {
    vi.mocked(fetchSim162Snapshot).mockResolvedValue(makeFullSnapshot())
    const { result } = renderHook(() => useSim162Session('legends'))

    await waitFor(() => {
      expect(result.current.draftState).not.toBeNull()
    })

    act(() => result.current.handleAutoFill())

    expect(result.current.isRosterComplete).toBe(true)
    expect(result.current.draftState!.status).toBe('complete')
  })

  it('enters lineup phase and initializes batting + rotation order when roster is complete', async () => {
    vi.mocked(fetchSim162Snapshot).mockResolvedValue(makeFullSnapshot())
    const { result } = renderHook(() => useSim162Session('legends'))

    await waitFor(() => {
      expect(result.current.draftState).not.toBeNull()
    })

    act(() => result.current.handleAutoFill())

    await waitFor(() => {
      expect(result.current.isLineupPhase).toBe(true)
    })

    expect(result.current.battingOrder).toHaveLength(9)
    expect(result.current.rotationOrder).toHaveLength(5)
    expect(result.current.isRosterComplete).toBe(true)
  })

  it('stubs handleSimulate and produces a placeholder season result', async () => {
    vi.mocked(fetchSim162Snapshot).mockResolvedValue(makeFullSnapshot())
    const { result } = renderHook(() => useSim162Session('legends'))

    await waitFor(() => {
      expect(result.current.draftState).not.toBeNull()
    })

    act(() => result.current.handleAutoFill())

    await waitFor(() => {
      expect(result.current.isLineupPhase).toBe(true)
    })

    act(() => result.current.handleSimulate())

    expect(result.current.isSimulating).toBe(true)

    await waitFor(() => {
      expect(result.current.seasonResult).not.toBeNull()
    })

    expect(result.current.isSimulating).toBe(false)
    expect(result.current.seasonResult).not.toBeNull()
    expect(result.current.seasonResult!.userRecord.wins + result.current.seasonResult!.userRecord.losses).toBe(162)
  })

  it('filters players by search', async () => {
    vi.mocked(fetchSim162Snapshot).mockResolvedValue(makeFullSnapshot())
    const { result } = renderHook(() => useSim162Session('legends'))

    await waitFor(() => {
      expect(result.current.draftState).not.toBeNull()
    })

    act(() => result.current.setSearch('c1'))

    expect(result.current.filteredPlayers).toHaveLength(1)
    expect(result.current.filteredPlayers[0]!.id).toBe('c1')
  })

  it('retries on error by reloading the snapshot', async () => {
    vi.mocked(fetchSim162Snapshot).mockRejectedValueOnce(new Error('First fail'))
    const { result } = renderHook(() => useSim162Session())

    act(() => result.current.setPool('legends'))

    await waitFor(() => {
      expect(result.current.error).toBe('First fail')
    })

    vi.mocked(fetchSim162Snapshot).mockResolvedValue(makeFullSnapshot())

    act(() => result.current.retry())

    await waitFor(() => {
      expect(result.current.snapshot).not.toBeNull()
    })

    expect(result.current.error).toBeNull()
  })
})
