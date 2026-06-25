export async function getStoredSnapshot(
  db: D1Database,
  key: string,
): Promise<string | null> {
  try {
    const row = await db
      .prepare('SELECT payload FROM live_snapshots WHERE snapshot_key = ?')
      .bind(key)
      .first<{ payload: string }>()
    return row?.payload ?? null
  } catch {
    return null
  }
}

export async function storeSnapshot(
  db: D1Database,
  key: string,
  payload: string,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO live_snapshots (snapshot_key, payload, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(snapshot_key) DO UPDATE SET
           payload = excluded.payload,
           created_at = excluded.created_at`,
      )
      .bind(key, payload, Date.now())
      .run()
  } catch {
    // Cache write is best-effort; snapshot response still succeeds.
  }
}
