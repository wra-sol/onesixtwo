import {
  buildLineupKey,
  buildSharePath,
  computeDailyRank,
  countSubmissionsSince,
  fetchLeaderboardEntries,
  hasLineupInPeriod,
  insertLeaderboardEntry,
  parseLeaderboardMode,
  parseLeaderboardPeriod,
  parseLimit,
  parseSubmitPayload,
  RATE_LIMIT_PER_DAY,
  startOfUtcDayMs,
  SUBMIT_ERROR_MESSAGES,
} from '../_lib/leaderboard'
import { resolveShareFromUrl } from '../_lib/resolve-share'
import type { ParsedShare } from '../../src/lib/share-url'

type Env = {
  DB?: D1Database
}

type PagesContext = {
  request: Request
  env: Env
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

async function handleGet(context: PagesContext): Promise<Response> {
  const db = context.env.DB
  if (!db) {
    return jsonResponse({ error: 'Leaderboard unavailable.' }, 503)
  }

  const url = new URL(context.request.url)
  const period = parseLeaderboardPeriod(url.searchParams.get('period'))
  if (!period) {
    return jsonResponse({ error: 'Invalid period.' }, 400)
  }

  const gameModeId = parseLeaderboardMode(url.searchParams.get('mode'))
  if (!gameModeId) {
    return jsonResponse({ error: 'Invalid mode.' }, 400)
  }

  const limit = parseLimit(url.searchParams.get('limit'))
  const entries = await fetchLeaderboardEntries(db, period, limit, gameModeId)

  return jsonResponse({
    period,
    mode: gameModeId,
    entries,
  })
}

async function handlePost(context: PagesContext): Promise<Response> {
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

  const payload = parseSubmitPayload(body)
  if (typeof payload === 'string') {
    return jsonResponse(
      { ok: false, error: SUBMIT_ERROR_MESSAGES[payload] },
      400,
    )
  }

  const parsed: ParsedShare = {
    gameModeId: payload.gameModeId,
    playerIds: payload.playerIds,
    rosterFormatId: payload.rosterFormatId,
    reroll: payload.reroll,
  }

  const sharePath = buildSharePath(parsed)
  const shareUrl = new URL(sharePath, 'https://onesixtytwo.win')
  const resolved = resolveShareFromUrl(shareUrl)
  if ('kind' in resolved) {
    return jsonResponse(
      { ok: false, error: SUBMIT_ERROR_MESSAGES.invalid_share },
      400,
    )
  }

  const now = Date.now()
  const submitterIp = clientIp(context.request)
  const dayStart = startOfUtcDayMs(now)

  const submissionCount = await countSubmissionsSince(db, submitterIp, dayStart)
  if (submissionCount >= RATE_LIMIT_PER_DAY) {
    return jsonResponse(
      { ok: false, error: 'Daily submission limit reached. Try again tomorrow.' },
      429,
    )
  }

  const lineupKey = buildLineupKey(
    parsed.playerIds,
    parsed.rosterFormatId,
    parsed.gameModeId,
  )

  if (await hasLineupInPeriod(db, lineupKey, parsed.gameModeId, null)) {
    return jsonResponse(
      {
        ok: false,
        error: 'This lineup is already on the leaderboard.',
      },
      409,
    )
  }

  const { result } = resolved
  const createdAt = now
  const entry = {
    id: crypto.randomUUID(),
    initials: payload.initials,
    wins: result.wins,
    losses: result.losses,
    teamScore: result.teamScore,
    isPerfectSeason: result.isPerfectSeason,
    rosterFormatId: parsed.rosterFormatId,
    gameModeId: parsed.gameModeId,
    lineupKey,
    sharePath: buildSharePath(parsed),
    submitterIp,
    createdAt,
  }

  await insertLeaderboardEntry(db, entry)

  const rank = await computeDailyRank(
    db,
    {
      wins: entry.wins,
      losses: entry.losses,
      teamScore: entry.teamScore,
      createdAt: entry.createdAt,
    },
    parsed.gameModeId,
    now,
  )

  return jsonResponse({
    ok: true,
    rank,
    period: 'daily' as const,
    mode: parsed.gameModeId,
  })
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === 'GET') {
    return handleGet(context)
  }
  if (context.request.method === 'POST') {
    return handlePost(context)
  }
  return new Response('Method not allowed', { status: 405 })
}
