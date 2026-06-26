import {
  buildLiveLineupKey,
  computeLiveRank,
  fetchEnrichedLiveLeaderboardEntries,
  hasLiveSubmissionForIp,
  insertLiveLeaderboardEntry,
  LIVE_LEADERBOARD_MAX,
} from '../_lib/live-leaderboard'
import {
  normalizeInitials,
  SUBMIT_ERROR_MESSAGES,
} from '../_lib/leaderboard'
import {
  assertDailyMatchupSnapshot,
  assertLiveDraftSnapshot,
  parseLiveSubmitPayload,
  resolveSnapshot,
} from '../_lib/live/leaderboard-orchestration'
import { createEmptyDailyLineup, type DailyLineupPosition } from '../../shared/live/daily-roster'
import { buildSimTeam, simulateBestOfThree } from '../../shared/live/pa-sim'
import { heuristicAiBattingOrder } from '../../shared/live/live-draft'
import {
  resolveLeaderboardSimSeed,
  validateDailyMatchupSubmission,
  validateLiveDraftSubmission,
} from '../../shared/live/live-submit-validation'
import type { LivePlayer } from '../../shared/live/live-types'

type Env = {
  DB?: D1Database
  USE_LIVE_FIXTURES?: string
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
  const mode = url.searchParams.get('mode')
  const challengeDate = url.searchParams.get('date')
  if (mode !== 'daily-matchup' && mode !== 'live-draft') {
    return jsonResponse({ error: 'Invalid mode.' }, 400)
  }
  if (!challengeDate) {
    return jsonResponse({ error: 'Missing date.' }, 400)
  }

  let snapshot
  try {
    snapshot = await resolveSnapshot(mode, challengeDate, db, context.env)
  } catch {
    return jsonResponse({ error: 'Could not load snapshot.' }, 503)
  }

  const entries = await fetchEnrichedLiveLeaderboardEntries(
    db,
    mode,
    challengeDate,
    LIVE_LEADERBOARD_MAX,
    snapshot,
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

  const parsed = parseLiveSubmitPayload(body)
  if ('ok' in parsed && parsed.ok === false) {
    return jsonResponse({ ok: false, error: parsed.error }, 400)
  }

  const payload = parsed
  const initials = normalizeInitials(payload.initials)
  if (!initials) {
    return jsonResponse(
      { ok: false, error: SUBMIT_ERROR_MESSAGES.invalid_initials },
      400,
    )
  }

  let snapshot
  try {
    snapshot = await resolveSnapshot(
      payload.mode,
      payload.challengeDate,
      db,
      context.env,
    )
  } catch {
    return jsonResponse(
      { ok: false, error: 'Could not load snapshot for validation.' },
      503,
    )
  }

  const simSeed = resolveLeaderboardSimSeed(snapshot)

  const validated = (() => {
    switch (payload.mode) {
      case 'daily-matchup': {
        if (!assertDailyMatchupSnapshot(snapshot)) {
          return { ok: false as const, error: 'Daily Matchup is unavailable today.' }
        }
        return validateDailyMatchupSubmission(snapshot, payload)
      }
      case 'live-draft': {
        if (!assertLiveDraftSnapshot(snapshot)) {
          return { ok: false as const, error: 'Invalid submission payload.' }
        }
        return validateLiveDraftSubmission(snapshot, payload)
      }
      default: {
        const _exhaustive: never = payload.mode
        return _exhaustive
      }
    }
  })()

  if (!validated.ok) {
    return jsonResponse({ ok: false, error: validated.error }, 400)
  }

  const opponent = (() => {
    switch (payload.mode) {
      case 'daily-matchup': {
        if (!assertDailyMatchupSnapshot(snapshot)) {
          return null
        }
        const lineup = createEmptyDailyLineup()
        for (const [pos, player] of Object.entries(snapshot.opponent.lineup)) {
          if (player) lineup[pos as DailyLineupPosition] = player
        }
        return {
          name: snapshot.opponent.teamName,
          lineup,
          battingOrder: snapshot.opponent.battingOrder,
        }
      }
      case 'live-draft': {
        return {
          name: 'AI',
          lineup: validated.aiLineup,
          battingOrder: heuristicAiBattingOrder(
            Object.values(validated.aiLineup).filter(
              (player): player is LivePlayer => Boolean(player),
            ),
          ),
        }
      }
      default: {
        const _exhaustive: never = payload.mode
        return _exhaustive
      }
    }
  })()

  if (!opponent) {
    return jsonResponse(
      { ok: false, error: 'Daily Matchup is unavailable today.' },
      400,
    )
  }

  const userTeam = buildSimTeam('You', validated.userLineup, validated.battingOrder, true)
  const opponentTeam = buildSimTeam(
    opponent.name,
    opponent.lineup,
    opponent.battingOrder,
    false,
  )
  const series = simulateBestOfThree(userTeam, opponentTeam, simSeed)

  const submitterIp = clientIp(context.request)
  const alreadySubmitted = await hasLiveSubmissionForIp(
    db,
    submitterIp,
    payload.mode,
    payload.challengeDate,
  )
  if (alreadySubmitted) {
    return jsonResponse(
      {
        ok: false,
        error: 'Your first submission for today is already ranked.',
        ranked: false,
      },
      409,
    )
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
    payloadJson: JSON.stringify({ ...payload, initials, simSeed }),
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
