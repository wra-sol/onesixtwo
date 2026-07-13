import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import DailyPlayerBrowser from '@/components/daily-matchup/DailyPlayerBrowser'
import type { LivePlayer } from '@shared/live/live-types'

vi.mock('@/lib/text', () => ({
  normalizeForSearch: (text: string) => text.toLowerCase(),
}))

afterEach(() => {
  cleanup()
})

function hitter(
  id: string,
  teamAbbrev: string,
  positions: LivePlayer['positions'],
  overall: number,
): LivePlayer {
  return {
    id,
    personId: Number(id),
    name: `Player ${id}`,
    teamId: Number(id),
    teamAbbrev,
    teamName: `Team ${teamAbbrev}`,
    positions,
    role: 'hitter',
    grades: { overall },
    appearedOnTargetDate: true,
    isFallback: false,
  }
}

function pitcher(
  id: string,
  teamAbbrev: string,
  roles: ('SP' | 'RP' | 'CL')[],
  overall: number,
): LivePlayer {
  return {
    id,
    personId: Number(id),
    name: `Player ${id}`,
    teamId: Number(id),
    teamAbbrev,
    teamName: `Team ${teamAbbrev}`,
    positions: ['SP'],
    role: 'pitcher',
    grades: { overall },
    appearedOnTargetDate: true,
    isFallback: false,
    pitcherRoles: roles,
  }
}

const players: LivePlayer[] = [
  hitter('1', 'LAD', ['C'], 70),
  hitter('2', 'NYY', ['1B'], 60),
  hitter('3', 'BOS', ['OF'], 50),
  pitcher('4', 'HOU', ['SP'], 65),
  pitcher('5', 'ATL', ['CL'], 55),
]

function renderBrowser(overrides?: Partial<React.ComponentProps<typeof DailyPlayerBrowser>>) {
  const onSelect = vi.fn()
  const getDisabledReason = vi.fn(() => null)
  const props: React.ComponentProps<typeof DailyPlayerBrowser> = {
    players,
    search: '',
    setSearch: vi.fn(),
    selectedPlayer: null,
    canSelect: true,
    getDisabledReason,
    onSelect,
    ...overrides,
  }
  return { ...render(<DailyPlayerBrowser {...props} />), onSelect, getDisabledReason, props }
}

describe('DailyPlayerBrowser', () => {
  it('renders all players by default sorted by overall desc', () => {
    renderBrowser()
    const names = screen.getAllByText(/^Player \d$/).map((el) => el.textContent)
    expect(names).toEqual(['Player 1', 'Player 4', 'Player 2', 'Player 5', 'Player 3'])
  })

  it('filters to a position when a position chip is clicked', () => {
    renderBrowser()
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(screen.getAllByText(/^Player \d$/)).toHaveLength(1)
    expect(screen.getByText('Player 1')).toBeTruthy()
    expect(screen.getByText(/1 player/)).toBeTruthy()
  })

  it('sorts by name when the sort selector changes', () => {
    renderBrowser()
    fireEvent.change(screen.getByDisplayValue('Overall'), { target: { value: 'name' } })
    const names = screen.getAllByText(/^Player \d$/).map((el) => el.textContent)
    expect(names).toEqual(['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5'])
  })

  it('hides unavailable players when the toggle is on', () => {
    const getDisabledReason = (p: LivePlayer) =>
      p.id === '2' ? 'NYY used' : null
    renderBrowser({ getDisabledReason })
    fireEvent.click(screen.getByLabelText('Hide unavailable'))
    const names = screen.getAllByText(/^Player \d$/).map((el) => el.textContent)
    expect(names).not.toContain('Player 2')
    expect(names).toHaveLength(4)
  })

  it('shows a no-match message when filters exclude everyone', () => {
    renderBrowser()
    fireEvent.click(screen.getByRole('button', { name: '2B' }))
    expect(screen.getByText(/No players match/)).toBeTruthy()
  })

  it('calls onSelect when a player card is clicked', () => {
    const { onSelect } = renderBrowser()
    fireEvent.click(screen.getByText('Player 1'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]![0].id).toBe('1')
  })
})
