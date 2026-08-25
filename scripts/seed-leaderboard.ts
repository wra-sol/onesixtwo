/**
 * Daily leaderboard seeder: plays the current Daily Matchup and Live Draft
 * against production snapshots with today's official sim seeds, then submits
 * one ranked row per mode.
 *
 * The server re-verifies every submission by re-simming from its own snapshot
 * seed, so only the lineup/order we choose matters — exhibitions can't fake a
 * scoreline.
 *
 * Env:
 *   SEED_BASE_URL  production base (default https://onesixtytwo.win)
 *   SEED_INITIALS  initials for rows (default BOT)
 */
import {
  createDailyMatchupDraftState,
  draftDailyMatchupPlayer,
  getDailyMatchupDisabledReason,
  setDailyMatchupBattingOrder,
  startLiveDraft,
  advanceLiveDraftTurns,
  isUserTurn,
  draftLiveUserPlayer,
  getLiveDraftUserDisabledReason,
  setLiveDraftBattingOrder,
  filterRoundPool,
} from '../shared/live/live-draft'
import { defaultBattingOrderFromLineup, type DailyLineup } from '../shared/live/daily-roster'
import { heuristicAiBattingOrder } from '../shared/live/live-draft'
import { lineupPlayerIdsFromDailyLineup } from '../shared/live/live-lineup-ids'
import {
  resolveLiveShareOpponent,
  simulateLineupSeries,
} from '../shared/live/live-share-sim'
import {
  validateDailyMatchupSubmission,
  validateLiveDraftSubmission,
} from '../shared/live/live-submit-validation'
import type {
  DailyMatchupSnapshot,
  LiveDraftSnapshot,
  LivePlayer,
} from '../shared/live/live-types'

const BASE_URL = process.env.SEED_BASE_URL ?? 'https://onesixtytwo.win'
const INITIALS = process.env.SEED_INITIALS ?? 'BOT'

function die(message: string): never {
  console.error(`SEED FAIL: ${message}`)
  process.exit(1)
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`)
  if (!response.ok) die(`GET ${path} -> ${response.status}`)
  return (await response.json()) as T
}

async function postJson(path: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  if (process.env.DRY_RUN === '1') {
    console.log(`[dry-run] would POST ${path}: ${JSON.stringify(body).slice(0, 160)}…`)
    return { status: 200, body: { ok: true, rank: 'dry-run' } }
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, unknown> }
}

function greedyHitterOrder(lineup: DailyLineup): LivePlayer[] {
  return defaultBattingOrderFromLineup(lineup)
}

type Candidate = {
  label: string
  playerIds: string[]
  battingOrderIds: string[]
  series: ReturnType<typeof simulateLineupSeries>
}

/** Plays the official-seed series under several legal batting orders. */
function dailyCandidates(
  snap: DailyMatchupSnapshot,
  lineup: DailyLineup,
  roster: LivePlayer[],
): Candidate[] {
  const opponent = resolveLiveShareOpponent(snap, { mode: 'daily-matchup' })!
  const orders: Array<[string, LivePlayer[]]> = [
    ['overall-desc', greedyHitterOrder(lineup)],
    ['ai-heuristic', heuristicAiBattingOrder(roster)],
  ]
  return orders.map(([label, order]) => ({
    label,
    playerIds: lineupPlayerIdsFromDailyLineup(lineup),
    battingOrderIds: order.map((p) => p.id),
    series: simulateLineupSeries(
      { name: INITIALS, lineup, battingOrder: order },
      opponent,
      snap.simSeed,
    ),
  }))
}

function better(a: Candidate, b: Candidate): Candidate {
  const rank = (c: Candidate) => [c.series.userWins, c.series.userRunDiff]
  const ra = rank(a)
  const rb = rank(b)
  return ra[0]! > rb[0]! || (ra[0] === rb[0] && ra[1]! > rb[1]!) ? a : b
}

async function seedDailyMatchup(): Promise<void> {
  const snap = await getJson<DailyMatchupSnapshot>('/api/daily-matchup')
  if (!snap.available || !snap.opponent) die('daily matchup unavailable today')

  // Draft a legal roster: best overall first, respecting locks/budget.
  let state = createDailyMatchupDraftState(snap.challengeDate, snap.targetDate, snap.opponent)
  const pool = [...snap.players].sort((a, b) => b.grades.overall - a.grades.overall)
  while (state.status === 'drafting') {
    const pick = pool.find((p) => getDailyMatchupDisabledReason(p, state, snap.players) === null)
    if (!pick) die('daily draft stuck')
    state = draftDailyMatchupPlayer(state, pick, undefined, snap.players)
  }
  const ordered = setDailyMatchupBattingOrder(state, defaultBattingOrderFromLineup(state.lineup))
  const roster = ordered.battingOrder

  const candidates = dailyCandidates(snap, ordered.lineup, roster)
  const best = candidates.reduce(better)

  const validation = validateDailyMatchupSubmission(snap, {
    challengeDate: snap.challengeDate,
    targetDate: snap.targetDate,
    playerIds: best.playerIds,
    battingOrderIds: best.battingOrderIds,
  })
  if (!validation.ok) die(`daily validation rejected: ${validation.error}`)

  console.log(
    `daily: ${best.label} order -> ${best.series.userWins}-${best.series.opponentWins} vs ${snap.opponent.teamName} (runs ${best.series.userRuns}-${best.series.opponentRuns})`,
  )
  const { status, body } = await postJson('/api/live-leaderboard', {
    mode: 'daily-matchup',
    challengeDate: snap.challengeDate,
    targetDate: snap.targetDate,
    playerIds: best.playerIds,
    battingOrderIds: best.battingOrderIds,
    simSeed: snap.simSeed,
    initials: INITIALS,
  })
  if (status === 409) {
    console.log('daily: already seeded/ranked for today (409), skipping.')
  } else if (status !== 200 || body.ok !== true) {
    die(`daily submit failed (${status}): ${JSON.stringify(body)}`)
  } else {
    console.log(`daily: ranked at #${String(body.rank)} under "${INITIALS}"`)
  }
}

async function seedLiveDraft(): Promise<void> {
  const snap = await getJson<LiveDraftSnapshot>('/api/live-draft')

  let state = startLiveDraft(snap)
  state = advanceLiveDraftTurns(state, snap.players, snap.simSeed)
  let safety = 0
  while (state.status === 'drafting') {
    if (++safety > 400) die('live draft stalled')
    if (!isUserTurn(state)) {
      state = advanceLiveDraftTurns(state, snap.players, snap.simSeed)
      continue
    }
    const pool = filterRoundPool(snap.players, state, 'user')
    const pick = [...pool]
      .sort((a, b) => b.grades.overall - a.grades.overall)
      .find((p) => getLiveDraftUserDisabledReason(p, state, snap.players) === null)
    if (!pick) die('no eligible live-draft pick')
    state = draftLiveUserPlayer(state, pick, snap.players, snap.simSeed)
    state = advanceLiveDraftTurns(state, snap.players, snap.simSeed)
  }
  if (state.status !== 'lineup') die(`live draft ended in status ${state.status}`)
  const ordered = setLiveDraftBattingOrder(state, defaultBattingOrderFromLineup(state.userLineup))

  const playerIds = lineupPlayerIdsFromDailyLineup(ordered.userLineup)
  const aiPlayerIds = lineupPlayerIdsFromDailyLineup(ordered.aiLineup)
  const battingOrderIds = ordered.userBattingOrder.map((p) => p.id)

  const validation = validateLiveDraftSubmission(snap, {
    challengeDate: snap.challengeDate,
    playerIds,
    aiPlayerIds,
    battingOrderIds,
  })
  if (!validation.ok) die(`live draft validation rejected: ${validation.error}`)

  const aiOpponent = resolveLiveShareOpponent(snap, { mode: 'live-draft', aiPlayerIds })!
  const series = simulateLineupSeries(
    { name: INITIALS, lineup: ordered.userLineup, battingOrder: ordered.userBattingOrder },
    aiOpponent,
    snap.simSeed,
  )
  console.log(
    `draft: ${series.userWins}-${series.opponentWins} vs AI (runs ${series.userRuns}-${series.opponentRuns})`,
  )

  const { status, body } = await postJson('/api/live-leaderboard', {
    mode: 'live-draft',
    challengeDate: snap.challengeDate,
    playerIds,
    aiPlayerIds,
    battingOrderIds,
    simSeed: snap.simSeed,
    initials: INITIALS,
  })
  if (status === 409) {
    console.log('draft: already seeded/ranked for today (409), skipping.')
  } else if (status !== 200 || body.ok !== true) {
    die(`draft submit failed (${status}): ${JSON.stringify(body)}`)
  } else {
    console.log(`draft: ranked at #${String(body.rank)} under "${INITIALS}"`)
  }
}

async function main(): Promise<void> {
  await seedDailyMatchup()
  await seedLiveDraft()
  console.log('Leaderboard seeding complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
