import {
  buildSim162LineupKey,
  computeSim162Rank,
  fetchSim162LeaderboardEntries,
  hasSim162SubmissionForIp,
  insertSim162LeaderboardEntry,
  SIM162_LEADERBOARD_MAX,
  type Sim162Pool,
} from '../_lib/sim162-leaderboard'
import {
  normalizeInitials,
  SUBMIT_ERROR_MESSAGES,
} from '../_lib/leaderboard'
import { verifySim162Submission } from '../_lib/sim162-verify'
import {
  SIM162_BATTING_ORDER_SIZE,
  SIM162_ROTATION_SIZE,
  SIM162_ROSTER_SIZE,
} from '../../src/lib/sim162-share-url'
import { jsonResponse, clientIp, type PagesContext } from '../_lib/http'


type Sim162SubmitBody = {
  pool: unknown
  initials: unknown
  challengeDate: unknown
  playerIds: unknown
  battingOrderIds: unknown
  rotationOrderIds: unknown
}

type ParsedSim162Submit =
  | {
      ok: true
      pool: Sim162Pool
      challengeDate: string
      playerIds: string[]
      battingOrderIds: string[]
      rotationOrderIds: string[]
    }
  | { ok: false; error: string }

/**
 * Structural validation only. Claimed results (wins/losses/postseason) are
 * not part of the submission contract — the server derives them by re-sim.
 */
function parseSim162SubmitPayload(body: unknown): ParsedSim162Submit {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: SUBMIT_ERROR_MESSAGES.invalid_json }
  }

  const record = body as Sim162SubmitBody

  const pool = record.pool
  if (pool !== 'live' && pool !== 'legends') {
    return { ok: false, error: 'Invalid pool.' }
  }

  const challengeDate =
    typeof record.challengeDate === 'string' ? record.challengeDate.trim() : ''
  if (!challengeDate) {
    return { ok: false, error: 'Missing challenge date.' }
  }

  const playerIds = record.playerIds
  if (
    !Array.isArray(playerIds) ||
    playerIds.length !== SIM162_ROSTER_SIZE ||
    !playerIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    return { ok: false, error: `Roster must include ${SIM162_ROSTER_SIZE} players.` }
  }

  const seen = new Set<string>()
  for (const id of playerIds) {
    if (seen.has(id)) {
      return { ok: false, error: 'Roster has duplicate players.' }
    }
    seen.add(id)
  }

  const battingOrderIds = record.battingOrderIds
  if (
    !Array.isArray(battingOrderIds) ||
    battingOrderIds.length !== SIM162_BATTING_ORDER_SIZE ||
    !battingOrderIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    return {
      ok: false,
      error: `Batting order must include ${SIM162_BATTING_ORDER_SIZE} players.`,
    }
  }

  const rotationOrderIds = record.rotationOrderIds
  if (
    !Array.isArray(rotationOrderIds) ||
    rotationOrderIds.length !== SIM162_ROTATION_SIZE ||
    !rotationOrderIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    return {
      ok: false,
      error: `Rotation must include ${SIM162_ROTATION_SIZE} pitchers.`,
    }
  }

  return {
    ok: true,
    pool,
    challengeDate,
    playerIds: playerIds as string[],
    battingOrderIds: battingOrderIds as string[],
    rotationOrderIds: rotationOrderIds as string[],
  }
}

async function handleGet(context: PagesContext): Promise<Response> {
  const db = context.env.DB
  if (!db) {
    return jsonResponse({ error: 'Leaderboard unavailable.' }, 503)
  }

  const entries = await fetchSim162LeaderboardEntries(
    db,
    SIM162_LEADERBOARD_MAX,
  )
  return jsonResponse({ entries })
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

  const parsed = parseSim162SubmitPayload(body)
  if (!parsed.ok) {
    return jsonResponse({ ok: false, error: parsed.error }, 400)
  }

  const initials = normalizeInitials(
    (body as { initials?: unknown }).initials,
  )
  if (!initials) {
    return jsonResponse(
      { ok: false, error: SUBMIT_ERROR_MESSAGES.invalid_initials },
      400,
    )
  }

  const submitterIp = clientIp(context.request)
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
      pool: parsed.pool,
      challengeDate: parsed.challengeDate,
      playerIds: parsed.playerIds,
      battingOrderIds: parsed.battingOrderIds,
      rotationOrderIds: parsed.rotationOrderIds,
    },
    context.env,
  )
  if (!verified.ok) {
    return jsonResponse({ ok: false, error: verified.error }, 400)
  }

  const lineupKey = buildSim162LineupKey(parsed.pool, parsed.playerIds)
  const createdAt = Date.now()

  const payloadJson = JSON.stringify({
    pool: parsed.pool,
    challengeDate: parsed.challengeDate,
    playerIds: parsed.playerIds,
    battingOrderIds: parsed.battingOrderIds,
    rotationOrderIds: parsed.rotationOrderIds,
    simSeed: verified.seasonSeed.slice(verified.seasonSeed.indexOf('::') + 2),
    initials,
  })

  await insertSim162LeaderboardEntry(db, {
    id: crypto.randomUUID(),
    pool: parsed.pool,
    initials,
    wins: verified.wins,
    losses: verified.losses,
    postseasonResult: verified.postseasonResult,
    postseasonRank: verified.postseasonRank,
    wonWorldSeries: verified.wonWorldSeries,
    userQualified: verified.userQualified,
    lineupKey,
    payloadJson,
    submitterIp,
    createdAt,
  })

  const rank = await computeSim162Rank(db, {
    wonWorldSeries: verified.wonWorldSeries,
    wins: verified.wins,
    postseasonRank: verified.postseasonRank,
    createdAt,
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
  if (context.request.method === 'GET') {
    return handleGet(context)
  }
  if (context.request.method === 'POST') {
    return handlePost(context)
  }
  return new Response('Method not allowed', { status: 405 })
}
