/**
 * Minimal ambient D1 declarations for programs that don't load
 * @cloudflare/workers-types (the app/vite program compiles a few
 * shared server modules transitively). The functions program uses
 * the full workers-types package instead.
 */
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName?: string): Promise<T | null>
  all<T = unknown>(): Promise<{ results?: T[] }>
  run(): Promise<unknown>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
}
