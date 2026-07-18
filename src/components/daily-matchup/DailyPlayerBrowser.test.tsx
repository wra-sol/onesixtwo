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

// Two teams so the team filter can be exercised: AAA has players 1,2,5; BBB has 3,4.
const players: LivePlayer[] = [
  hitter('1', 'AAA', ['C'], 70),
  hitter('2', 'AAA', ['1B'], 60),
  hitter('3', 'BBB', ['OF'], 50),
  pitcher('4', 'BBB', ['SP'], 65),
  pitcher('5', 'AAA', ['CL'], 55),
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

const selectTeam = (abbrev: string) =>
  fireEvent.change(screen.getByLabelText('Filter players by team'), {
    target: { value: abbrev },
  })

describe('DailyPlayerBrowser', () => {
  it('defaults to all teams sorted by overall desc (team filter is optional)', () => {
    renderBrowser()
    const names = screen.getAllByText(/^Player \d$/).map((el) => el.textContent)
    expect(names).toEqual(['Player 1', 'Player 4', 'Player 2', 'Player 5', 'Player 3'])
    expect(screen.getByRole('option', { name: 'All teams' })).toBeTruthy()
  })

  it('narrows to a single team when one is selected', () => {
    renderBrowser()
    selectTeam('AAA')
    const names = screen.getAllByText(/^Player \d$/).map((el) => el.textContent)
    expect(names).toEqual(['Player 1', 'Player 2', 'Player 5'])
    expect(screen.getByText(/3 players/)).toBeTruthy()
  })

  it('returns to all teams via the All teams option', () => {
    renderBrowser()
    selectTeam('BBB')
    expect(screen.getAllByText(/^Player \d$/).map((el) => el.textContent)).toEqual([
      'Player 4',
      'Player 3',
    ])
    selectTeam('')
    expect(screen.getAllByText(/^Player \d$/)).toHaveLength(5)
  })

  it('shows all teams and disables the team select when a search is active', () => {
    renderBrowser({ search: 'player' })
    const names = screen.getAllByText(/^Player \d$/).map((el) => el.textContent)
    expect(names).toEqual(['Player 1', 'Player 4', 'Player 2', 'Player 5', 'Player 3'])
    expect((screen.getByLabelText('Filter players by team') as HTMLSelectElement).disabled).toBe(true)
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
    const getDisabledReason = (p: LivePlayer) => (p.id === '2' ? 'AAA used' : null)
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
