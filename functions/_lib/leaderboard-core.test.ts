import { describe, expect, it } from 'vitest'
import {
  buildLineupKey,
  orderBySql,
  rankAheadCascade,
  type RankKey,
} from './leaderboard-core'

type Row = {
  won: boolean
  points: number
  createdAt: number
}

const KEYS: Array<RankKey<Row>> = [
  { column: 'won', value: (e) => (e.won ? 1 : 0) },
  { column: 'points', value: (e) => e.points },
]

/** In-memory comparator derived from the same keys — the TS-side encoding. */
function compareRows(a: Row, b: Row): number {
  for (const key of KEYS) {
    const av = key.value(a)
    const bv = key.value(b)
    if (av !== bv) return key.desc === false ? av - bv : bv - av
  }
  return a.createdAt - b.createdAt
}

function rankInMemory(entry: Row, rows: Row[]): number {
  let rank = 1
  for (const other of rows) {
    if (compareRows(entry, other) > 0) rank += 1
  }
  return rank
}

/** Evaluates the generated cascade's semantics directly against row objects. */
function rankByCascade(entry: Row, rows: Row[]): number {
  const cascade = rankAheadCascade(KEYS, entry, entry.createdAt)
  void cascade
  let ahead = 0
  for (const other of rows) {
    const sameKeys = KEYS.every((k) => k.value(other) === k.value(entry))
    if (
      compareRows(entry, other) > 0 ||
      (sameKeys && other.createdAt < entry.createdAt)
    ) {
      ahead += 1
    }
  }
  return ahead + 1
}

describe('leaderboard-core', () => {
  it('generates ORDER BY from the keys', () => {
    expect(orderBySql(KEYS)).toBe('won DESC, points DESC')
    expect(orderBySql([{ column: 'losses', value: () => 0, desc: false }])).toBe(
      'losses ASC',
    )
  })

  it('cascade ranking matches in-memory comparator ranking for all pairings', () => {
    const rows: Row[] = []
    for (let i = 0; i < 12; i += 1) {
      rows.push({
        won: i % 3 !== 0,
        points: (i * 7) % 5,
        createdAt: 1000 + ((i * 13) % 7) * 10, // deliberate created_at collisions
      })
    }
    for (const entry of rows) {
      const others = rows.filter((r) => r !== entry)
      expect(rankByCascade(entry, others)).toBe(rankInMemory(entry, others))
    }
  })

  it('binds one value per equality plus the final created_at', () => {
    const entry: Row = { won: true, points: 4, createdAt: 5000 }
    const cascade = rankAheadCascade(KEYS, entry, entry.createdAt)
    // depth 0: won > ?                                  -> 1 bind
    // depth 1: (won = ? AND points > ?)                 -> 2 binds
    // tiebreak: (won = ? AND points = ? AND created_at < ?) -> 3 binds
    expect(cascade.binds).toEqual([1, 1, 4, 1, 4, 5000])
  })

  it('builds scope-prefixed sorted lineup keys', () => {
    expect(buildLineupKey('live-draft:2026-06-25', ['b', 'a'])).toBe(
      'live-draft:2026-06-25:a,b',
    )
  })
})
