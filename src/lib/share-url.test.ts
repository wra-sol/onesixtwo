import { describe, expect, it } from 'vitest'
import { buildBenchmarkLineup } from './benchmarks'
import { calculateSeasonResult } from './game'
import {
  buildOgPath,
  buildSharePath,
  buildShareUrl,
  isParsedShare,
  parseShareParams,
  reconstructLineup,
} from './share-url'

describe('share-url', () => {
  const lineup = buildBenchmarkLineup('great')

  it('round-trips encode and decode', () => {
    const path = buildSharePath(lineup, 2)
    expect(path).toMatch(/^\/share\?p=/)
    expect(path).toContain('&n=2')

    const parsed = parseShareParams(new URLSearchParams(path.split('?')[1]))
    expect(isParsedShare(parsed)).toBe(true)
    if (!isParsedShare(parsed)) return

    expect(parsed.reroll).toBe(2)
    expect(reconstructLineup(parsed)).toEqual(lineup)
  })

  it('omits reroll param when zero', () => {
    const path = buildSharePath(lineup, 0)
    expect(path).not.toContain('&n=')
    const parsed = parseShareParams(new URLSearchParams(path.split('?')[1]))
    expect(isParsedShare(parsed)).toBe(true)
    if (!isParsedShare(parsed)) return
    expect(parsed.reroll).toBe(0)
  })

  it('builds absolute share URL', () => {
    expect(buildShareUrl(lineup)).toBe(
      `https://onesixtytwo.win${buildSharePath(lineup, 0)}`,
    )
  })

  it('builds OG path from parsed share', () => {
    const parsed = parseShareParams(
      new URLSearchParams(buildSharePath(lineup, 1).split('?')[1]),
    )
    expect(isParsedShare(parsed)).toBe(true)
    if (!isParsedShare(parsed)) return
    expect(buildOgPath(parsed)).toMatch(/^\/og\?p=/)
    expect(buildOgPath(parsed)).toContain('&n=1')
  })

  it('rejects wrong player count', () => {
    const params = new URLSearchParams()
    params.set('p', 'a,b,c')
    expect(parseShareParams(params)).toBe('wrong_count')
  })

  it('rejects invalid reroll param', () => {
    const params = new URLSearchParams(buildSharePath(lineup).split('?')[1])
    params.set('n', '-1')
    expect(parseShareParams(params)).toBe('invalid_reroll')
    params.set('n', 'abc')
    expect(parseShareParams(params)).toBe('invalid_reroll')
  })

  it('rejects unknown player IDs', () => {
    const parsed = parseShareParams(
      new URLSearchParams(buildSharePath(lineup).split('?')[1]),
    )
    expect(isParsedShare(parsed)).toBe(true)
    if (!isParsedShare(parsed)) return
    const brokenIds = [...parsed.playerIds]
    brokenIds[0] = 'not-a-real-player-id'
    expect(
      parseShareParams(new URLSearchParams(`p=${brokenIds.join(',')}`)),
    ).toBe('unknown_player')
  })

  it('rejects duplicate personIds', () => {
    const ids = lineup.C!.id
    const duplicateLine = Array(9).fill(ids).join(',')
    expect(parseShareParams(new URLSearchParams(`p=${duplicateLine}`))).toBe(
      'duplicate_person',
    )
  })

  it('parsed URL produces same record as direct calculation', () => {
    const path = buildSharePath(lineup, 3)
    const parsed = parseShareParams(new URLSearchParams(path.split('?')[1]))
    expect(isParsedShare(parsed)).toBe(true)
    if (!isParsedShare(parsed)) return

    const fromUrl = calculateSeasonResult(reconstructLineup(parsed)!, {
      rerollSeed: String(parsed.reroll),
    })
    const direct = calculateSeasonResult(lineup, { rerollSeed: '3' })
    expect(fromUrl?.record).toBe(direct?.record)
    expect(fromUrl?.wins).toBe(direct?.wins)
  })
})
