import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

import ShareResultPanel from '@/components/ShareResultPanel'

const baseProps = {
  shareUrl: 'https://example.com/s/x',
  shareTitle: 'Title',
  shareText: 'Title\nhttps://example.com/s/x',
  restartLabel: 'Play again',
  onRestart: vi.fn(),
}

describe('ShareResultPanel', () => {
  it('renders the restart button and fires onRestart', () => {
    const onRestart = vi.fn()
    render(<ShareResultPanel {...baseProps} onRestart={onRestart} />)
    const button = screen.getByRole('button', { name: 'Play again' })
    fireEvent.click(button)
    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  it('previews the share text inside the details block', () => {
    render(<ShareResultPanel {...baseProps} />)
    expect(screen.getByText(/Preview share text/)).toBeTruthy()
    expect(screen.getByText(/https:\/\/example\.com\/s\/x/)).toBeTruthy()
  })

  it('shows Copied! after a successful clipboard copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText },
      share: undefined,
    })
    render(<ShareResultPanel {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await screen.findByText('Copied!')
    expect(writeText).toHaveBeenCalledWith(baseProps.shareUrl)
  })

  it('falls back to selectable text when the clipboard fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.assign(navigator, { clipboard: { writeText }, share: undefined })
    render(<ShareResultPanel {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await screen.findByText(/Select the text below/)
  })

  it('shows the Leaderboard button only when requested', () => {
    const { rerender } = render(<ShareResultPanel {...baseProps} />)
    expect(screen.queryByRole('button', { name: 'Leaderboard' })).toBeNull()
    rerender(<ShareResultPanel {...baseProps} showLeaderboard />)
    expect(screen.getByRole('button', { name: 'Leaderboard' })).toBeTruthy()
  })

  it('hides share chrome when shareUrl is null but keeps restart', () => {
    render(
      <ShareResultPanel
        {...baseProps}
        shareUrl={null}
        shareTitle="Title"
        shareText="Title"
      />,
    )
    expect(screen.queryByText(/Preview share text/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Play again' })).toBeTruthy()
  })
})
