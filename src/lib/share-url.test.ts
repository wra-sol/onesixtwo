import { describe, expect, it } from 'vitest'
import { PLAYERS } from '../data'
import { buildBenchmarkLineup } from './benchmarks'
import { getActiveLineupPositions } from './roster-format'
import { createEmptyLineup } from './roster-format'
import { calculateSeasonResult } from './game'
import { resolveShareFromUrl } from '../../functions/_lib/resolve-share'
import {
  buildOgPath,
  buildSharePath,
  buildShareUrl,
  isParsedShare,
  parseShareParams,
  reconstructLineup,
} from './share-url'
import type { Lineup, RosterFormatId } from './types'

function extendLineupToFormat(
  base: Lineup,
  formatId: RosterFormatId,
): Lineup {
  const lineup = createEmptyLineup()
  const positions = getActiveLineupPositions(formatId)
  const used = new Set<string>()

  for (const pos of positions) {
    const fromBase = base[pos]
    if (fromBase) {
      lineup[pos] = fromBase
      used.add(fromBase.personId)
    }
  }

  for (const pos of positions) {
    if (lineup[pos]) continue
    const pick = PLAYERS.find(
      (p) => !used.has(p.personId) && p.positions.includes(pos),
    )
    if (pick) {
      lineup[pos] = pick
      used.add(pick.personId)
    }
  }

  return lineup
}

describe('share-url', () => {
  const lineup = buildBenchmarkLineup('great')

  it('round-trips encode and decode classic', () => {
    const path = buildSharePath(lineup, 2, 'classic')
    expect(path).toMatch(/^\/share\?p=/)
    expect(path).toContain('&n=2')
    expect(path).not.toContain('&f=')

    const parsed = parseShareParams(new URLSearchParams(path.split('?')[1]))
    expect(isParsedShare(parsed)).toBe(true)
    if (!isParsedShare(parsed)) return

    expect(parsed.reroll).toBe(2)
    expect(parsed.rosterFormatId).toBe('classic')
    const reconstructed = reconstructLineup(parsed)!
    for (const pos of getActiveLineupPositions(parsed.rosterFormatId)) {
      expect(reconstructed[pos]?.id).toBe(lineup[pos]?.id)
    }
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
    expect(buildOgPath(parsed)).toContain('&v=5')
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
      rosterFormatId: parsed.rosterFormatId,
    })
    const direct = calculateSeasonResult(lineup, { rerollSeed: '3' })
    expect(fromUrl?.record).toBe(direct?.record)
    expect(fromUrl?.wins).toBe(direct?.wins)
  })

  it('parsed dh-rp URL produces same record as direct calculation', () => {
    const dhRpLineup = extendLineupToFormat(lineup, 'dh-rp')
    const path = buildSharePath(dhRpLineup, 2, 'dh-rp')
    expect(path).toContain('&f=dh-rp')

    const parsed = parseShareParams(new URLSearchParams(path.split('?')[1]))
    expect(isParsedShare(parsed)).toBe(true)
    if (!isParsedShare(parsed)) return

    const fromUrl = calculateSeasonResult(reconstructLineup(parsed)!, {
      rerollSeed: String(parsed.reroll),
      rosterFormatId: parsed.rosterFormatId,
    })
    const direct = calculateSeasonResult(dhRpLineup, {
      rerollSeed: '2',
      rosterFormatId: 'dh-rp',
    })
    expect(fromUrl?.record).toBe(direct?.record)
    expect(fromUrl?.wins).toBe(direct?.wins)
  })

  it('resolveShareFromUrl uses roster format from share URL', () => {
    const dhRpLineup = extendLineupToFormat(lineup, 'dh-rp')
    const path = buildSharePath(dhRpLineup, 2, 'dh-rp')
    const url = new URL(`https://onesixtytwo.win${path}`)
    const resolved = resolveShareFromUrl(url)
    expect('kind' in resolved).toBe(false)
    if ('kind' in resolved) return

    const direct = calculateSeasonResult(dhRpLineup, {
      rerollSeed: '2',
      rosterFormatId: 'dh-rp',
    })
    expect(resolved.result.record).toBe(direct?.record)
    expect(resolved.result.wins).toBe(direct?.wins)
  })
})
