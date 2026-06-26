const baseUrl = process.env.QA_BASE_URL ?? 'http://127.0.0.1:8790'

type Json = Record<string, unknown>

async function getJson(path: string): Promise<{ status: number; body: Json }> {
  const response = await fetch(`${baseUrl}${path}`)
  const body = (await response.json()) as Json
  return { status: response.status, body }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

const FIXTURE_NAME_PATTERN = / (Hitter|Starter|Reliever|Closer) \d*$/

function assertRealPlayerNames(players: unknown[], label: string): void {
  if (process.env.USE_LIVE_FIXTURES === 'true') return

  const sample = players.slice(0, 5) as Array<{ name?: string }>
  for (const player of sample) {
    assert(
      typeof player.name === 'string' && !FIXTURE_NAME_PATTERN.test(player.name),
      `${label} player "${player.name ?? ''}" looks like a fixture placeholder`,
    )
  }
}

export async function runLiveModesQa(): Promise<void> {
  const daily = await getJson('/api/daily-matchup')
  assert(daily.status === 200, `daily-matchup status ${daily.status}`)
  assert(daily.body.kind === 'daily-matchup', 'daily-matchup kind')
  assert(daily.body.available === true, 'daily-matchup available')
  assert(Array.isArray(daily.body.players), 'daily-matchup players')
  assert((daily.body.players as unknown[]).length > 0, 'daily-matchup player pool')
  assertRealPlayerNames(daily.body.players as unknown[], 'daily-matchup')

  const opponent = daily.body.opponent as { teamName?: string } | null
  assert(typeof opponent?.teamName === 'string', 'daily-matchup opponent teamName')

  const draft = await getJson('/api/live-draft')
  assert(draft.status === 200, `live-draft status ${draft.status}`)
  assert(draft.body.kind === 'live-draft', 'live-draft kind')
  assert(Array.isArray(draft.body.players), 'live-draft players')
  assert((draft.body.players as unknown[]).length > 0, 'live-draft player pool')
  assertRealPlayerNames(draft.body.players as unknown[], 'live-draft')

  const challengeDate = daily.body.challengeDate as string
  assert(typeof challengeDate === 'string', 'challengeDate')

  const board = await getJson(
    `/api/live-leaderboard?mode=daily-matchup&date=${encodeURIComponent(challengeDate)}`,
  )
  assert(board.status === 200, `leaderboard status ${board.status}`)
  assert(Array.isArray(board.body.entries), 'leaderboard entries')

  console.log(
    JSON.stringify({
      ok: true,
      baseUrl,
      challengeDate,
      opponentTeam: opponent?.teamName,
      dailyPlayers: (daily.body.players as unknown[]).length,
      draftPlayers: (draft.body.players as unknown[]).length,
      leaderboardEntries: (board.body.entries as unknown[]).length,
    }),
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runLiveModesQa().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
