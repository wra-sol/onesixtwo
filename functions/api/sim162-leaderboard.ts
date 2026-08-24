import {
  buildSim162LineupKey,
  computeSim162Rank,
  fetchSim162LeaderboardEntries,
  hasSim162SubmissionForIp,
  insertSim162LeaderboardEntry,
  parseSim162SubmitPayload,
  SIM162_LEADERBOARD_MAX,
} from '../_lib/sim162-leaderboard'
import { newEntryIdentity, leaderboardGet, routeLeaderboard, submissionPost } from '../_lib/submission-pipeline'
import { verifySim162Submission } from '../_lib/sim162-verify'
import { seasonSeedSimSeed } from '../../shared/live/seeds'
import { jsonResponse, type PagesContext } from '../_lib/http'


async function handleGet(db: D1Database): Promise<Response> {
  const entries = await fetchSim162LeaderboardEntries(
    db,
    SIM162_LEADERBOARD_MAX,
  )
  return jsonResponse({ entries })
}

async function handlePost(
  db: D1Database,
  context: PagesContext,
  payload: {
    pool: 'live' | 'legends'
    challengeDate: string
    playerIds: string[]
    battingOrderIds: string[]
    rotationOrderIds: string[]
  },
  initials: string,
  submitterIp: string,
): Promise<Response> {
  const alreadySubmitted = await hasSim162SubmissionForIp(db, submitterIp)
  if (alreadySubmitted) {
    return jsonResponse(
      {
        ok: false,
        error: 'You have already submitted a Sim 162 result.',
        ranked: false,
      },
      409,
    )
  }

  // Server-side verification: rebuild the season deterministically from the
  // submitted ids and the server-owned pool seed. Client-claimed results are
  // never stored.
  const verified = await verifySim162Submission(
    {
      pool: payload.pool,
      challengeDate: payload.challengeDate,
      playerIds: payload.playerIds,
      battingOrderIds: payload.battingOrderIds,
      rotationOrderIds: payload.rotationOrderIds,
    },
    context.env,
  )
  if (!verified.ok) {
    return jsonResponse({ ok: false, error: verified.error }, 400)
  }

  const lineupKey = buildSim162LineupKey(payload.pool, payload.playerIds)
  const identity = newEntryIdentity()

  const storedPayload = JSON.stringify({
    pool: payload.pool,
    challengeDate: payload.challengeDate,
    playerIds: payload.playerIds,
    battingOrderIds: payload.battingOrderIds,
    rotationOrderIds: payload.rotationOrderIds,
    simSeed: seasonSeedSimSeed(verified.seasonSeed),
    initials,
  })

  await insertSim162LeaderboardEntry(db, {
    id: identity.id,
    pool: payload.pool,
    initials,
    wins: verified.wins,
    losses: verified.losses,
    postseasonResult: verified.postseasonResult,
    postseasonRank: verified.postseasonRank,
    wonWorldSeries: verified.wonWorldSeries,
    userQualified: verified.userQualified,
    lineupKey,
    payloadJson: storedPayload,
    submitterIp,
    createdAt: identity.createdAt,
  })

  const rank = await computeSim162Rank(db, {
    wonWorldSeries: verified.wonWorldSeries,
    wins: verified.wins,
    postseasonRank: verified.postseasonRank,
    createdAt: identity.createdAt,
  })

  return jsonResponse({
    ok: true,
    rank,
    ranked: true,
    record: {
      wins: verified.wins,
      losses: verified.losses,
      postseasonResult: verified.postseasonResult,
    },
  })
}

export async function onRequest(context: PagesContext): Promise<Response> {
  return routeLeaderboard(context, {
    get: () => leaderboardGet(context, handleGet),
    post: () =>
      submissionPost(context, {
        parsePayload: (body) => {
          const parsed = parseSim162SubmitPayload(body)
          return parsed.ok
            ? { ok: true as const, value: parsed }
            : { ok: false as const, error: parsed.error }
        },
        initialsOf: (_, body) =>
          typeof (body as { initials?: unknown }).initials === 'string'
            ? ((body as { initials: string }).initials)
            : '',
        process: ({ db, context, payload, initials, submitterIp }) =>
          handlePost(db, context, payload, initials, submitterIp),
      }),
  })
}
