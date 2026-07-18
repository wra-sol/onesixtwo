import {
  buildSim162LineupKey,
  computeSim162Rank,
  fetchSim162LeaderboardEntries,
  hasSim162SubmissionForIp,
  insertSim162LeaderboardEntry,
  POSTSEASON_RANK,
  SIM162_LEADERBOARD_MAX,
  type Sim162Pool,
} from '../_lib/sim162-leaderboard'
import {
  normalizeInitials,
  SUBMIT_ERROR_MESSAGES,
} from '../_lib/leaderboard'
import type { PostseasonResult } from '../../shared/live/sim162-season'

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

const VALID_POSTSEASON_RESULTS: PostseasonResult[] = [
  'missed',
  'wc',
  'ds',
  'lcs',
  'ws-runner-up',
  'ws-champs',
]

type Sim162SubmitBody = {
  pool: unknown
  initials: unknown
  challengeDate: unknown
  playerIds: unknown
  battingOrderIds: unknown
  rotationOrderIds: unknown
  simSeed: unknown
  wins: unknown
  losses: unknown
  postseasonResult: unknown
  wonWorldSeries: unknown
  userQualified: unknown
}

type ParsedSim162Submit =
  | {
      ok: true
      pool: Sim162Pool
      challengeDate: string
      playerIds: string[]
      battingOrderIds: string[]
      rotationOrderIds: string[]
      simSeed: string
      wins: number
      losses: number
      postseasonResult: PostseasonResult
      wonWorldSeries: boolean
      userQualified: boolean
    }
  | { ok: false; error: string }

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
    playerIds.length !== 25 ||
    !playerIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    return { ok: false, error: 'Roster must include 25 players.' }
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
    battingOrderIds.length !== 9 ||
    !battingOrderIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    return { ok: false, error: 'Batting order must include 9 players.' }
  }

  const rotationOrderIds = record.rotationOrderIds
  if (
    !Array.isArray(rotationOrderIds) ||
    rotationOrderIds.length !== 5 ||
    !rotationOrderIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    return { ok: false, error: 'Rotation must include 5 pitchers.' }
  }

  const simSeed = record.simSeed
  if (typeof simSeed !== 'string' || !simSeed.trim()) {
    return { ok: false, error: 'Missing simulation seed.' }
  }

  const wins = typeof record.wins === 'number' ? Math.trunc(record.wins) : NaN
  const losses =
    typeof record.losses === 'number' ? Math.trunc(record.losses) : NaN
  if (!Number.isFinite(wins) || wins < 0 || wins > 162) {
    return { ok: false, error: 'Invalid win total.' }
  }
  if (!Number.isFinite(losses) || losses < 0 || losses > 162) {
    return { ok: false, error: 'Invalid loss total.' }
  }

  const postseasonResult = record.postseasonResult
  if (
    typeof postseasonResult !== 'string' ||
    !VALID_POSTSEASON_RESULTS.includes(postseasonResult as PostseasonResult)
  ) {
    return { ok: false, error: 'Invalid postseason result.' }
  }

  const wonWorldSeries = record.wonWorldSeries === true
  const userQualified = record.userQualified === true

  return {
    ok: true,
    pool,
    challengeDate,
    playerIds: playerIds as string[],
    battingOrderIds: battingOrderIds as string[],
    rotationOrderIds: rotationOrderIds as string[],
    simSeed: simSeed.trim(),
    wins,
    losses,
    postseasonResult: postseasonResult as PostseasonResult,
    wonWorldSeries,
    userQualified,
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

  const lineupKey = buildSim162LineupKey(parsed.pool, parsed.playerIds)
  const createdAt = Date.now()
  const postseasonRank = POSTSEASON_RANK[parsed.postseasonResult]

  const payloadJson = JSON.stringify({
    pool: parsed.pool,
    challengeDate: parsed.challengeDate,
    playerIds: parsed.playerIds,
    battingOrderIds: parsed.battingOrderIds,
    rotationOrderIds: parsed.rotationOrderIds,
    simSeed: parsed.simSeed,
    initials,
  })

  await insertSim162LeaderboardEntry(db, {
    id: crypto.randomUUID(),
    pool: parsed.pool,
    initials,
    wins: parsed.wins,
    losses: parsed.losses,
    postseasonResult: parsed.postseasonResult,
    postseasonRank,
    wonWorldSeries: parsed.wonWorldSeries,
    userQualified: parsed.userQualified,
    lineupKey,
    payloadJson,
    submitterIp,
    createdAt,
  })

  const rank = await computeSim162Rank(db, {
    wonWorldSeries: parsed.wonWorldSeries,
    wins: parsed.wins,
    postseasonRank,
    createdAt,
  })

  return jsonResponse({ ok: true, rank, ranked: true })
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
