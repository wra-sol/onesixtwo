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
import { simulateLineupSeries, resolveLiveShareOpponent } from '../../shared/live/live-share-sim'
import {
  validateDailyMatchupSubmission,
  validateLiveDraftSubmission,
} from '../../shared/live/live-submit-validation'
import { jsonResponse, clientIp, type PagesContext } from '../_lib/http'




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
  if ('error' in parsed) {
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

  const simSeed = snapshot.simSeed

  const outcome = (() => {
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
    }
  })()

  if (!outcome.ok) {
    return jsonResponse({ ok: false, error: outcome.error }, 400)
  }

  // Opponent resolution goes through the same interface as share rendering
  // and leaderboard enrichment, so a stored row re-sims identically to the
  // submission that created it.
  const opponent = resolveLiveShareOpponent(snapshot, {
    mode: payload.mode,
    aiPlayerIds: payload.aiPlayerIds,
  })
  if (!opponent) {
    return jsonResponse(
      { ok: false, error: 'Daily Matchup is unavailable today.' },
      400,
    )
  }

  const series = simulateLineupSeries(
    {
      name: 'You',
      lineup: outcome.userLineup,
      battingOrder: outcome.battingOrder,
    },
    opponent,
    simSeed,
  )

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
