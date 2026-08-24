import {
  buildLiveLineupKey,
  computeLiveRank,
  fetchEnrichedLiveLeaderboardEntries,
  hasLiveSubmissionForIp,
  insertLiveLeaderboardEntry,
  LIVE_LEADERBOARD_MAX,
} from '../_lib/live-leaderboard'
import {
  assertDailyMatchupSnapshot,
  assertLiveDraftSnapshot,
  parseLiveSubmitPayload,
} from '../_lib/live/leaderboard-orchestration'
import { resolveAndCacheSnapshot } from '../_lib/live/resolve-snapshot'
import { newEntryIdentity, leaderboardGet, routeLeaderboard, submissionPost } from '../_lib/submission-pipeline'
import { simulateLineupSeries, resolveLiveShareOpponent } from '../../shared/live/live-share-sim'
import type { LiveSubmitPayload } from '../../shared/live/live-types'
import {
  validateDailyMatchupSubmission,
  validateLiveDraftSubmission,
} from '../../shared/live/live-submit-validation'
import { jsonResponse, type PagesContext } from '../_lib/http'


async function handleGet(db: D1Database, context: PagesContext): Promise<Response> {
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
    snapshot = await resolveAndCacheSnapshot(mode, challengeDate, {
      ...context.env,
      DB: db,
    })
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

async function handlePost(
  db: D1Database,
  context: PagesContext,
  payload: LiveSubmitPayload,
  initials: string,
  submitterIp: string,
): Promise<Response> {
  let snapshot
  try {
    snapshot = await resolveAndCacheSnapshot(payload.mode, payload.challengeDate, {
      ...context.env,
      DB: db,
    })
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
  const entry = {
    ...newEntryIdentity(),
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
  }

  await insertLiveLeaderboardEntry(db, entry)
  const rank = await computeLiveRank(db, {
    mode: payload.mode,
    challengeDate: payload.challengeDate,
    wonSeries: series.wonSeries,
    seriesWins: series.userWins,
    runDiff: series.userRunDiff,
    userRuns: series.userRuns,
    createdAt: entry.createdAt,
  })

  return jsonResponse({ ok: true, rank, series, ranked: true })
}

export async function onRequest(context: PagesContext): Promise<Response> {
  return routeLeaderboard(context, {
    get: () => leaderboardGet(context, handleGet),
    post: () =>
      submissionPost(context, {
        parsePayload: (body) => {
          const parsed = parseLiveSubmitPayload(body)
          return 'error' in parsed
            ? { ok: false as const, error: parsed.error }
            : { ok: true as const, value: parsed }
        },
        initialsOf: (payload) => payload.initials,
        process: ({ db, context, payload, initials, submitterIp }) =>
          handlePost(db, context, payload, initials, submitterIp),
      }),
  })
}
