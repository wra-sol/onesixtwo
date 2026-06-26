import {
  buildFixtureDailyMatchupSnapshot,
  buildFixtureLiveDraftSnapshot,
} from '../../shared/live/live-fixtures'
import { challengeDate, targetDate } from '../../shared/live/live-dates'
import { resolveAndCacheSnapshot } from './live/resolve-snapshot'
import { buildSim162LiveSnapshot } from './live/sim162-live-snapshot'
import type { LiveModeId } from '../../shared/live/live-types'

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
      'Cache-Control': 'public, max-age=300',
    },
  })
}

type SnapshotRequestConfig = {
  mode: LiveModeId
  fixture: (challengeDate: string, targetDate?: string) => unknown
}

async function handleSnapshotRequest(
  context: PagesContext,
  config: SnapshotRequestConfig,
): Promise<Response> {
  const challengeDateParam =
    new URL(context.request.url).searchParams.get('date') ?? challengeDate()
  const targetDateParam = targetDate()

  try {
    const snapshot = await resolveAndCacheSnapshot(
      config.mode,
      challengeDateParam,
      context.env,
    )
    return jsonResponse(snapshot)
  } catch (error) {
    if (context.env.USE_LIVE_FIXTURES === 'true') {
      const snapshot = config.fixture(challengeDateParam, targetDateParam)
      return jsonResponse({
        ...snapshot,
        fallback: true,
        error: error instanceof Error ? error.message : 'Snapshot build failed',
      })
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
  return handleSnapshotRequest(context, {
    mode: 'daily-matchup',
    fixture: buildFixtureDailyMatchupSnapshot,
  })
}

export async function onRequestLiveDraft(context: PagesContext): Promise<Response> {
  return handleSnapshotRequest(context, {
    mode: 'live-draft',
    fixture: buildFixtureLiveDraftSnapshot,
  })
}

export async function onRequestSim162Live(context: PagesContext): Promise<Response> {
  const challengeDateParam =
    new URL(context.request.url).searchParams.get('date') ?? challengeDate()

  try {
    const snapshot = await buildSim162LiveSnapshot(challengeDateParam)
    return jsonResponse(snapshot)
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Snapshot build failed',
      },
      503,
    )
  }
}

export { challengeDate, targetDate }
