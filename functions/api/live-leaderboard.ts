import {
  buildLiveLineupKey,
  computeLiveRank,
  fetchLiveLeaderboardEntries,
  hasLiveSubmissionForIp,
  insertLiveLeaderboardEntry,
  LIVE_LEADERBOARD_MAX,
  type LiveSubmitPayload,
} from '../_lib/live-leaderboard'
import {
  normalizeInitials,
  SUBMIT_ERROR_MESSAGES,
} from '../_lib/leaderboard'
import { createEmptyDailyLineup, type DailyLineupPosition } from '../../src/lib/daily-roster'
import { buildSimTeam, simulateBestOfThree } from '../../src/lib/pa-sim'
import { heuristicAiBattingOrder } from '../../src/lib/live-draft'
import type { DailyLineup } from '../../src/lib/daily-roster'
import type { LivePlayer } from '../../src/lib/live-types'

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

function lineupFromPayload(
  playersById: Map<string, LivePlayer>,
  playerIds: string[],
  positions: DailyLineupPosition[],
): DailyLineup {
  const lineup = createEmptyDailyLineup()
  playerIds.forEach((id, index) => {
    const player = playersById.get(id)
    const pos = positions[index]
    if (player && pos) lineup[pos] = player
  })
  return lineup
}

async function handleGet(context: PagesContext): Promise<Response> {
  const db = context.env.DB
  if (!db) {
    return jsonResponse({ error: 'Leaderboard unavailable.' }, 503)
  }

  const url = new URL(context.request.url)
  const mode = url.searchParams.get('mode')
  const challengeDate = url.searchParams.get('date')
  if (mode !== 'daily-matchup' && mode !== 'live-draft') {
    return jsonResponse({ error: 'Invalid mode.' }, 400)
  }
  if (!challengeDate) {
    return jsonResponse({ error: 'Missing date.' }, 400)
  }

  const entries = await fetchLiveLeaderboardEntries(
    db,
    mode,
    challengeDate,
    LIVE_LEADERBOARD_MAX,
  )
  return jsonResponse({ mode, challengeDate, entries })
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

  if (!body || typeof body !== 'object') {
    return jsonResponse(
      { ok: false, error: SUBMIT_ERROR_MESSAGES.invalid_json },
      400,
    )
  }

  const record = body as Record<string, unknown>
  const initials = normalizeInitials(record.initials)
  if (!initials) {
    return jsonResponse(
      { ok: false, error: SUBMIT_ERROR_MESSAGES.invalid_initials },
      400,
    )
  }

  const payload = record as Partial<LiveSubmitPayload>
  if (
    payload.mode !== 'daily-matchup' &&
    payload.mode !== 'live-draft'
  ) {
    return jsonResponse({ ok: false, error: 'Invalid mode.' }, 400)
  }

  if (
    typeof payload.challengeDate !== 'string' ||
    typeof payload.simSeed !== 'string' ||
    !Array.isArray(payload.playerIds) ||
    !Array.isArray(payload.battingOrderIds)
  ) {
    return jsonResponse({ ok: false, error: 'Invalid submission payload.' }, 400)
  }

  const snapshotResponse = await fetch(
    new URL(
      payload.mode === 'daily-matchup'
        ? `/api/daily-matchup?date=${payload.challengeDate}`
        : `/api/live-draft?date=${payload.challengeDate}`,
      context.request.url,
    ).toString(),
  )
  const snapshot = (await snapshotResponse.json()) as {
    players: LivePlayer[]
    opponent?: { lineup: Partial<Record<DailyLineupPosition, LivePlayer>>; battingOrder: LivePlayer[]; teamName: string }
    targetDate?: string
  }

  const playersById = new Map(snapshot.players.map((p) => [p.id, p]))
  const positions: DailyLineupPosition[] = [
    'C',
    '1B',
    '2B',
    '3B',
    'SS',
    'OF1',
    'OF2',
    'OF3',
    'DH',
    'SP',
    'RP',
    'CL',
  ]

  const userLineup = lineupFromPayload(playersById, payload.playerIds, positions)
  const battingOrder = payload.battingOrderIds
    .map((id) => playersById.get(id))
    .filter((p): p is LivePlayer => Boolean(p))

  let opponentLineup = createEmptyDailyLineup()
  let opponentBattingOrder: LivePlayer[] = []
  let opponentName = 'Opponent'

  if (payload.mode === 'daily-matchup' && snapshot.opponent) {
    opponentName = snapshot.opponent.teamName
    for (const [pos, player] of Object.entries(snapshot.opponent.lineup)) {
      if (player) opponentLineup[pos as DailyLineupPosition] = player
    }
    opponentBattingOrder = snapshot.opponent.battingOrder
  } else if (payload.mode === 'live-draft' && typeof record.aiPlayerIds === 'object') {
    const aiIds = record.aiPlayerIds as string[]
    opponentLineup = lineupFromPayload(playersById, aiIds, positions)
    opponentBattingOrder = heuristicAiBattingOrder(
      aiIds.map((id) => playersById.get(id)).filter((p): p is LivePlayer => Boolean(p)),
    )
    opponentName = 'AI'
  }

  const userTeam = buildSimTeam('You', userLineup, battingOrder, true)
  const opponentTeam = buildSimTeam(
    opponentName,
    opponentLineup,
    opponentBattingOrder,
    false,
  )
  const series = simulateBestOfThree(userTeam, opponentTeam, payload.simSeed)

  const submitterIp = clientIp(context.request)
  const alreadySubmitted = await hasLiveSubmissionForIp(
    db,
    submitterIp,
    payload.mode,
    payload.challengeDate,
  )
  if (alreadySubmitted) {
    return jsonResponse({
      ok: false,
      error: 'Your first submission for today is already ranked.',
      series,
      ranked: false,
    }, 409)
  }

  const lineupKey = buildLiveLineupKey(
    payload.mode,
    payload.challengeDate,
    payload.playerIds,
  )
  const createdAt = Date.now()
  const entry = {
    id: crypto.randomUUID(),
    mode: payload.mode,
    challengeDate: payload.challengeDate,
    targetDate: payload.targetDate,
    initials,
    seriesWins: series.userWins,
    seriesLosses: series.opponentWins,
    userRuns: series.userRuns,
    opponentRuns: series.opponentRuns,
    runDiff: series.userRunDiff,
    wonSeries: series.wonSeries,
    lineupKey,
    payloadJson: JSON.stringify(payload),
    submitterIp,
    createdAt,
  }

  await insertLiveLeaderboardEntry(db, entry)
  const rank = await computeLiveRank(db, {
    mode: payload.mode,
    challengeDate: payload.challengeDate,
    wonSeries: series.wonSeries,
    seriesWins: series.userWins,
    runDiff: series.userRunDiff,
    userRuns: series.userRuns,
    createdAt,
  })

  return jsonResponse({ ok: true, rank, series, ranked: true })
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
