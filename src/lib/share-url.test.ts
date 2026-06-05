import { describe, expect, it } from 'vitest'
import { PLAYERS } from '../data'
import { buildBenchmarkLineup } from './benchmarks'
import { calculateSeasonResult } from './game'
import { getActiveLineupPositions, createEmptyLineup } from './roster-format'
import { resolveShareFromUrl } from '../../functions/_lib/resolve-share'
import {
  decodeShareLineup,
  encodeShareLineup,
  PLAYER_INDEX_BY_ID,
} from './share-codec'
import {
  buildLegacySharePath,
  buildOgPath,
  buildSharePath,
  buildShareUrl,
  isParsedShare,
  parseShareParams,
  reconstructLineup,
} from './share-url'
import type { RosterFormatId } from './types'

function extendLineupToFormat(
  base: ReturnType<typeof buildBenchmarkLineup>,
  formatId: RosterFormatId,
) {
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

describe('share-codec', () => {
  const lineup = buildBenchmarkLineup('great')

  it('round-trips compact lineup encoding', () => {
    const ids = getActiveLineupPositions('classic').map((pos) => lineup[pos]!.id)
    const encoded = encodeShareLineup(ids, 'classic', 'all-time')
    expect(typeof encoded).toBe('string')

    const decoded = decodeShareLineup(encoded as string)
    expect(typeof decoded).toBe('object')
    if (typeof decoded === 'string') throw new Error(decoded)
    expect(decoded.playerIds).toEqual(ids)
    expect(decoded.rosterFormatId).toBe('classic')
    expect(decoded.gameModeId).toBe('all-time')
  })

  it('decodes legacy v1 all-time shares', () => {
    const ids = getActiveLineupPositions('classic').map((pos) => lineup[pos]!.id)
    const indices = ids.map((id) => PLAYER_INDEX_BY_ID.get(id)!)
    const bytes = new Uint8Array(2 + indices.length * 2)
    bytes[0] = 1
    bytes[1] = 0
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i]!
      bytes[2 + i * 2] = (index >> 8) & 0xff
      bytes[2 + i * 2 + 1] = index & 0xff
    }
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    const legacy = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')

    const decoded = decodeShareLineup(legacy)
    expect(typeof decoded).toBe('object')
    if (typeof decoded === 'string') throw new Error(decoded)
    expect(decoded.gameModeId).toBe('all-time')
    expect(decoded.playerIds).toEqual(ids)
  })

  it('uses stable player indices', () => {
    expect(PLAYER_INDEX_BY_ID.get(lineup.C!.id)).toBeTypeOf('number')
  })
})

describe('share-url', () => {
  const lineup = buildBenchmarkLineup('great')

  it('builds compact share paths', () => {
    const path = buildSharePath(lineup, 2, 'classic')
    expect(path).toMatch(/^\/share\?d=/)
    expect(path).toContain('&n=2')
    expect(path).not.toContain('&f=')
    expect(path.length).toBeLessThan(120)

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
    expect(buildOgPath(parsed)).toMatch(/^\/og\?d=/)
    expect(buildOgPath(parsed)).toContain('&n=1')
    expect(buildOgPath(parsed)).toContain('&v=5')
  })

  it('still parses legacy comma-separated player URLs', () => {
    const legacy = buildLegacySharePath(lineup, 2, 'classic')
    expect(legacy).toContain('p=')

    const parsed = parseShareParams(new URLSearchParams(legacy.split('?')[1]))
    expect(isParsedShare(parsed)).toBe(true)
    if (!isParsedShare(parsed)) return
    expect(parsed.reroll).toBe(2)
    expect(parsed.playerIds).toHaveLength(9)
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
    expect(path).toMatch(/^\/share\?d=/)

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
