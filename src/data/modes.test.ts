import { describe, expect, it } from 'vitest'
import { getModeDataset, validateModeDataset } from './modes'

describe('mode datasets', () => {
  it('keeps all-time and active pools separate', () => {
    const allTime = getModeDataset('all-time')
    const active = getModeDataset('active')

    expect(allTime.players.length).toBeGreaterThan(1000)
    expect(active.players.length).toBeGreaterThan(0)
    expect(allTime.players[0]?.id).not.toBe(active.players[0]?.id)

    const allTimeIds = new Set(allTime.players.map((player) => player.id))
    const overlap = active.players.filter((player) => allTimeIds.has(player.id))
    expect(overlap).toHaveLength(0)
  })

  it('validates all-time dataset', () => {
    expect(validateModeDataset('all-time')).toEqual([])
  })
})
