import { resolveShareFromUrl } from '../_lib/resolve-share'
import {
  buildLineupKey,
  buildSharePath,
  computeDailyRank,
  countSubmissionsSince,
  fetchLeaderboardEntries,
  hasLineupInPeriod,
  insertLeaderboardEntry,
  parseLeaderboardPeriod,
  parseLimit,
  parseSubmitPayload,
  RATE_LIMIT_PER_DAY,
  startOfUtcDayMs,
  SUBMIT_ERROR_MESSAGES,
} from '../_lib/leaderboard'
import { newEntryIdentity, leaderboardGet, routeLeaderboard, submissionPost } from '../_lib/submission-pipeline'
import type { ParsedShare } from '../../src/lib/share-url'
import { jsonResponse, type PagesContext } from '../_lib/http'

type ClassicSubmitPayload = Exclude<
  ReturnType<typeof parseSubmitPayload>,
  string
>


async function handleGet(db: D1Database, context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url)
  const period = parseLeaderboardPeriod(url.searchParams.get('period'))
  if (!period) {
    return jsonResponse({ error: 'Invalid period.' }, 400)
  }

  const limit = parseLimit(url.searchParams.get('limit'))
  const entries = await fetchLeaderboardEntries(db, period, limit)

  return jsonResponse({
    period,
    entries,
  })
}

async function handlePost(
  db: D1Database,
  payload: ClassicSubmitPayload,
  submitterIp: string,
): Promise<Response> {
  const parsed: ParsedShare = {
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
  const dayStart = startOfUtcDayMs(now)

  const submissionCount = await countSubmissionsSince(db, submitterIp, dayStart)
  if (submissionCount >= RATE_LIMIT_PER_DAY) {
    return jsonResponse(
      { ok: false, error: 'Daily submission limit reached. Try again tomorrow.' },
      429,
    )
  }

  const lineupKey = buildLineupKey(parsed.playerIds, parsed.rosterFormatId)

  if (await hasLineupInPeriod(db, lineupKey, null)) {
    return jsonResponse(
      {
        ok: false,
        error: 'This lineup is already on the leaderboard.',
      },
      409,
    )
  }

  const { result } = resolved
  const entry = {
    ...newEntryIdentity(),
    initials: payload.initials,
    wins: result.wins,
    losses: result.losses,
    teamScore: result.teamScore,
    isPerfectSeason: result.isPerfectSeason,
    rosterFormatId: parsed.rosterFormatId,
    lineupKey,
    sharePath: buildSharePath(parsed),
    submitterIp,
  }

  await insertLeaderboardEntry(db, entry)

  const rank = await computeDailyRank(db, {
    wins: entry.wins,
    losses: entry.losses,
    teamScore: entry.teamScore,
    createdAt: entry.createdAt,
  }, entry.createdAt)

  return jsonResponse({
    ok: true,
    rank,
    period: 'daily' as const,
  })
}

export async function onRequest(context: PagesContext): Promise<Response> {
  return routeLeaderboard(context, {
    get: () => leaderboardGet(context, handleGet),
    post: () =>
      submissionPost(context, {
        parsePayload: (body) => {
          const parsed = parseSubmitPayload(body)
          if (typeof parsed === 'string') {
            return { ok: false as const, error: SUBMIT_ERROR_MESSAGES[parsed] }
          }
          return { ok: true as const, value: parsed }
        },
        process: async ({ db, payload, submitterIp }) =>
          handlePost(db, payload, submitterIp),
      }),
  })
}
