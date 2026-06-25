import {
  buildDailyMatchupSnapshot,
  buildLiveDraftSnapshot,
  challengeDateFromNow,
  targetDateFromNow,
} from './live-snapshot'
import {
  buildFixtureDailyMatchupSnapshot,
  buildFixtureLiveDraftSnapshot,
} from '../../src/lib/live-fixtures'

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

async function getStoredSnapshot(
  db: D1Database,
  key: string,
): Promise<string | null> {
  const row = await db
    .prepare('SELECT payload FROM live_snapshots WHERE snapshot_key = ?')
    .bind(key)
    .first<{ payload: string }>()
  return row?.payload ?? null
}

async function storeSnapshot(
  db: D1Database,
  key: string,
  payload: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO live_snapshots (snapshot_key, payload, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(snapshot_key) DO NOTHING`,
    )
    .bind(key, payload, Date.now())
    .run()
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const challengeDate =
    new URL(context.request.url).searchParams.get('date') ??
    challengeDateFromNow()
  const targetDate = targetDateFromNow()
  const key = `daily-matchup:${challengeDate}`

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
      ? buildFixtureDailyMatchupSnapshot(challengeDate, targetDate)
      : await buildDailyMatchupSnapshot(challengeDate, targetDate)

    const payload = JSON.stringify(snapshot)
    if (db) {
      await storeSnapshot(db, key, payload)
    }
    return jsonResponse(snapshot)
  } catch (error) {
    const snapshot = buildFixtureDailyMatchupSnapshot(challengeDate, targetDate)
    return jsonResponse({
      ...snapshot,
      fallback: true,
      error: error instanceof Error ? error.message : 'Snapshot build failed',
    })
  }
}

export async function onRequestLiveDraft(context: PagesContext): Promise<Response> {
  const challengeDate =
    new URL(context.request.url).searchParams.get('date') ??
    challengeDateFromNow()
  const key = `live-draft:${challengeDate}`

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
      ? buildFixtureLiveDraftSnapshot(challengeDate)
      : await buildLiveDraftSnapshot(challengeDate)

    const payload = JSON.stringify(snapshot)
    if (db) {
      await storeSnapshot(db, key, payload)
    }
    return jsonResponse(snapshot)
  } catch (error) {
    const snapshot = buildFixtureLiveDraftSnapshot(challengeDate)
    return jsonResponse({
      ...snapshot,
      fallback: true,
      error: error instanceof Error ? error.message : 'Snapshot build failed',
    })
  }
}
