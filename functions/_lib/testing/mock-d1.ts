export type MockQueryResult = {
  first?: unknown
  all?: { results?: unknown[] }
}

export type MockQueryHandler = (query: string, binds: unknown[]) => MockQueryResult

/**
 * One in-memory D1 adapter shared by every server-side test, so tests stop
 * hand-rolling wire-protocol mocks. The handler sees raw SQL + binds and
 * returns canned rows; `run` also invokes the handler so tests can observe
 * inserts.
 */
export function createMockDb(handler: MockQueryHandler): D1Database {
  const emptyMeta = () => ({
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: 0,
    last_row_id: 0,
    changed_db: false,
    changes: 0,
  })
  const ok = () => ({ results: [] as unknown[], success: true as const, meta: emptyMeta() })

  const prepare = (query: string): D1PreparedStatement => {
    let binds: unknown[] = []
    const stmt: D1PreparedStatement = {
      bind(...values: unknown[]) {
        binds = values
        return stmt
      },
      first<T = unknown>(): Promise<T | null> {
        return Promise.resolve((handler(query, binds).first ?? null) as T | null)
      },
      all<T = unknown>(): Promise<D1Result<T>> {
        const result = handler(query, binds).all
        return Promise.resolve({
          ...ok(),
          results: (result?.results ?? []) as T[],
          meta: emptyMeta(),
        })
      },
      run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        handler(query, binds)
        return Promise.resolve(ok() as D1Result<T>)
      },
      raw<T = unknown[]>(): Promise<T> {
        return Promise.resolve([] as unknown as T)
      },
    }
    return stmt
  }

  return {
    prepare,
    batch: (<T>(statements: D1PreparedStatement[]) =>
      Promise.resolve(statements.map(() => ok() as D1Result<T>))) as D1Database['batch'],
    exec: () => Promise.resolve({ count: 0, duration: 0 }),
    withSession: () => {
      throw new Error('withSession is not supported by this mock')
    },
    dump: () => Promise.resolve(new ArrayBuffer(0)),
  }
}
