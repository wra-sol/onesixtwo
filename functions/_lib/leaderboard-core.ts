/**
 * The deep Leaderboards core: one definition of "what ranks higher" per
 * board, from which every SQL encoding is generated. Before this module,
 * ranking semantics lived twice-plus per board (TS comparator, ORDER BY,
 * rank cascade) and drifted independently.
 */

export type RankKey<T> = {
  /** SQL column this key sorts by. */
  column: string
  /** Numeric comparison value for one entry (booleans normalized by caller). */
  value: (entry: T) => number
  /** true (default) = higher value ranks ahead. */
  desc?: boolean
}

export type ScopeColumn = {
  column: string
  value: number | string
}

/** Generated `ORDER BY` clause from the same keys that drive rank computation. */
export function orderBySql<T>(keys: Array<RankKey<T>>): string {
  return keys
    .map((k) => `${k.column} ${k.desc === false ? 'ASC' : 'DESC'}`)
    .join(', ')
}

type Cascade = { sql: string; binds: number[] }

/**
 * Generated WHERE fragment matching rows strictly ahead of `entry` under the
 * key priority order. Ties break by created_at ascending (earlier ranks
 * ahead), mirroring every board's historical behaviour.
 */
export function rankAheadCascade<T>(
  keys: Array<RankKey<T>>,
  entry: T,
  createdAt: number,
): Cascade {
  const sqlParts: string[] = []
  const binds: number[] = []

  keys.forEach((key, depth) => {
    const op = key.desc === false ? '<' : '>'
    const equalities: string[] = []
    for (let shallower = 0; shallower < depth; shallower += 1) {
      const prev = keys[shallower]!
      equalities.push(`${prev.column} = ?`)
      binds.push(prev.value(entry))
    }
    equalities.push(`${key.column} ${op} ?`)
    binds.push(key.value(entry))
    sqlParts.push(`(${equalities.join(' AND ')})`)
  })

  const allEqual = keys.map((k) => `${k.column} = ?`).join(' AND ')
  keys.forEach((k) => binds.push(k.value(entry)))
  sqlParts.push(`(${allEqual} AND created_at < ?)`)
  binds.push(createdAt)

  return { sql: `(${sqlParts.join(' OR ')})`, binds }
}

/** Count rows strictly ahead of the entry; rank = ahead + 1. */
export async function computeRank<T>(
  db: D1Database,
  options: {
    table: string
    keys: Array<RankKey<T>>
    entry: T
    createdAt: number
    /** Extra equality scope (e.g. mode + challenge_date) applied outside the cascade. */
    scope?: Array<ScopeColumn>
    /** Optional lower bound on created_at (rolling windows). */
    createdSince?: number
  },
): Promise<number> {
  const conditions: string[] = []
  const binds: Array<number | string> = []

  if (options.scope) {
    for (const s of options.scope) {
      conditions.push(`${s.column} = ?`)
      binds.push(s.value)
    }
  }
  if (options.createdSince !== undefined) {
    conditions.push('created_at >= ?')
    binds.push(options.createdSince)
  }

  const cascade = rankAheadCascade(options.keys, options.entry, options.createdAt)
  conditions.push(cascade.sql)
  binds.push(...cascade.binds)

  const result = await db
    .prepare(
      `SELECT COUNT(*) AS ahead FROM ${options.table} WHERE ${conditions.join(' AND ')}`,
    )
    .bind(...binds)
    .first<{ ahead: number }>()

  return (result?.ahead ?? 0) + 1
}

/** True when this IP already has a row in the given scope. */
export async function hasSubmissionForIp(
  db: D1Database,
  options: {
    table: string
    submitterIp: string
    scope?: Array<ScopeColumn>
  },
): Promise<boolean> {
  const conditions = ['submitter_ip = ?']
  const binds: Array<number | string> = [options.submitterIp]
  if (options.scope) {
    for (const s of options.scope) {
      conditions.push(`${s.column} = ?`)
      binds.push(s.value)
    }
  }
  const row = await db
    .prepare(
      `SELECT 1 AS found FROM ${options.table} WHERE ${conditions.join(' AND ')} LIMIT 1`,
    )
    .bind(...binds)
    .first<{ found: number }>()
  return Boolean(row)
}

/** Sorted-id lineup key shared by every board (`scope:sortedIds`). */
export function buildLineupKey(scope: string, playerIds: readonly string[]): string {
  return `${scope}:${[...playerIds].sort().join(',')}`
}
