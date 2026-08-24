import { normalizeInitials, SUBMIT_ERROR_MESSAGES } from './leaderboard'
import { jsonResponse, clientIp, type Env, type PagesContext } from './http'

/**
 * The one submission shell every leaderboard POST runs: DB guard → JSON
 * parse → payload validation → initials → board process. Boards supply two
 * adapters — a payload parser and a processor that owns verification,
 * duplicate gates, insert, and rank — and inherit identical error shapes.
 */
export type PayloadParse<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export type SubmissionBoard<TPayload> = {
  parsePayload: (body: unknown) => PayloadParse<TPayload>
  /** Return normalized raw initials from the body; omit for boards that validate initials in their parser. */
  initialsOf?: (payload: TPayload, body: unknown) => string
  process: (input: {
    db: D1Database
    context: PagesContext
    payload: TPayload
    initials: string
    submitterIp: string
  }) => Promise<Response>
}

export async function submissionPost<T>(
  context: PagesContext,
  board: SubmissionBoard<T>,
): Promise<Response> {
  const db = context.env.DB
  if (!db) {
    return jsonResponse({ ok: false, error: 'Leaderboard unavailable.' }, 503)
  }

  let body: unknown
  try {
    body = await context.request.json()
  } catch {
    return jsonResponse(
      { ok: false, error: SUBMIT_ERROR_MESSAGES.invalid_json },
      400,
    )
  }

  const parsed = board.parsePayload(body)
  if (!parsed.ok) {
    return jsonResponse({ ok: false, error: parsed.error }, 400)
  }

  let initials = ''
  if (board.initialsOf) {
    const normalized = normalizeInitials(board.initialsOf(parsed.value, body))
    if (!normalized) {
      return jsonResponse(
        { ok: false, error: SUBMIT_ERROR_MESSAGES.invalid_initials },
        400,
      )
    }
    initials = normalized
  }

  return board.process({
    db,
    context,
    payload: parsed.value,
    initials,
    submitterIp: clientIp(context.request),
  })
}

/** GET shell: same DB guard policy as submissions, with a read-shaped body. */
export async function leaderboardGet(
  context: PagesContext,
  run: (db: D1Database, context: PagesContext) => Promise<Response>,
): Promise<Response> {
  const db = context.env.DB
  if (!db) {
    return jsonResponse({ error: 'Leaderboard unavailable.' }, 503)
  }
  return run(db, context)
}

export async function routeLeaderboard(
  context: PagesContext,
  handlers: {
    get?: () => Promise<Response>
    post?: () => Promise<Response>
  },
): Promise<Response> {
  if (context.request.method === 'GET' && handlers.get) {
    return handlers.get()
  }
  if (context.request.method === 'POST' && handlers.post) {
    return handlers.post()
  }
  return new Response('Method not allowed', { status: 405 })
}

/** Fresh stored-row identity shared by every insert path. */
export function newEntryIdentity(): { id: string; createdAt: number } {
  return { id: crypto.randomUUID(), createdAt: Date.now() }
}

export type { Env, PagesContext }
