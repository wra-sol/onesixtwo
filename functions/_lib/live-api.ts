import { challengeDate, targetDate } from '../../shared/live/live-dates'
import {
  buildFixtureDailyMatchupSnapshot,
  buildFixtureLiveDraftSnapshot,
} from '../../shared/live/live-fixtures'
import {
  fixturesEnabled,
  resolveAndCacheSnapshot,
  resolveSim162LiveSnapshot,
} from './live/resolve-snapshot'
import { jsonResponse } from './http'

type Env = {
  DB?: D1Database
  USE_LIVE_FIXTURES?: string
}

type PagesContext = {
  request: Request
  env: Env
}

async function handleSnapshotRequest(
  context: PagesContext,
  resolve: (challengeDate: string) => Promise<unknown>,
  errorFixture?: (challengeDate: string) => object,
): Promise<Response> {
  const challengeDateParam =
    new URL(context.request.url).searchParams.get('date') ?? challengeDate()

  try {
    return jsonResponse(await resolve(challengeDateParam))
  } catch (error) {
    if (fixturesEnabled(context.env) && errorFixture) {
      return jsonResponse(
        Object.assign({}, errorFixture(challengeDateParam), {
          fallback: true,
          error: error instanceof Error ? error.message : 'Snapshot build failed',
        }),
      )
    }
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Snapshot build failed',
      },
      503,
    )
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  return handleSnapshotRequest(
    context,
    (date) => resolveAndCacheSnapshot('daily-matchup', date, context.env),
    (date) => buildFixtureDailyMatchupSnapshot(date, targetDate()),
  )
}

export async function onRequestLiveDraft(context: PagesContext): Promise<Response> {
  return handleSnapshotRequest(
    context,
    (date) => resolveAndCacheSnapshot('live-draft', date, context.env),
    (date) => buildFixtureLiveDraftSnapshot(date),
  )
}

export async function onRequestSim162Live(context: PagesContext): Promise<Response> {
  return handleSnapshotRequest(context, (date) =>
    resolveSim162LiveSnapshot(date, context.env),
  )
}
