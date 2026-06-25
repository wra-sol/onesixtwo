import {
  buildDailyMatchupSnapshot,
  buildLiveDraftSnapshot,
} from './live-snapshot'
import {
  buildFixtureDailyMatchupSnapshot,
  buildFixtureLiveDraftSnapshot,
} from '../../shared/live/live-fixtures'
import { challengeDate, targetDate } from '../../shared/live/live-dates'
import {
  getStoredSnapshot,
  storeSnapshot,
} from './live/snapshot-cache'

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

/** Bump when snapshot shape or live-vs-fixture semantics change (invalidates D1 cache). */
const SNAPSHOT_CACHE_VERSION = 'v2'

type SnapshotRequestConfig<T> = {
  keyPrefix: 'daily-matchup' | 'live-draft'
  build: (challengeDate: string, targetDate?: string) => Promise<T>
  fixture: (challengeDate: string, targetDate?: string) => T
  needsTargetDate?: boolean
}

async function handleSnapshotRequest<T>(
  context: PagesContext,
  config: SnapshotRequestConfig<T>,
): Promise<Response> {
  const challengeDateParam =
    new URL(context.request.url).searchParams.get('date') ?? challengeDate()
  const targetDateParam = targetDate()
  const key = `${config.keyPrefix}:${SNAPSHOT_CACHE_VERSION}:${challengeDateParam}`

  const db = context.env.DB
  if (db) {
    const stored = await getStoredSnapshot(db, key)
    if (stored) {
      return jsonResponse(JSON.parse(stored))
    }
  }

  try {
    const useFixtures = context.env.USE_LIVE_FIXTURES === 'true'
    const snapshot = useFixtures
      ? config.fixture(challengeDateParam, targetDateParam)
      : config.needsTargetDate
        ? await config.build(challengeDateParam, targetDateParam)
        : await config.build(challengeDateParam)

    const payload = JSON.stringify(snapshot)
    if (db) {
      await storeSnapshot(db, key, payload)
    }
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
    keyPrefix: 'daily-matchup',
    build: buildDailyMatchupSnapshot,
    fixture: buildFixtureDailyMatchupSnapshot,
    needsTargetDate: true,
  })
}

export async function onRequestLiveDraft(context: PagesContext): Promise<Response> {
  return handleSnapshotRequest(context, {
    keyPrefix: 'live-draft',
    build: (date) => buildLiveDraftSnapshot(date),
    fixture: (date) => buildFixtureLiveDraftSnapshot(date),
  })
}

export { challengeDate, targetDate }
