import type { DailyLineup } from './daily-roster'
import { dailyLineupPlayers } from './daily-roster'
import type { LiveModeId, LiveShareInput } from './live-types'

export type LiveShareValidationError = { ok: false; error: string }

const MODE_PARAM = 'mode'
const DATE_PARAM = 'date'
const TARGET_PARAM = 'target'
const PLAYERS_PARAM = 'p'
const BATTING_ORDER_PARAM = 'bo'
const AI_PARAM = 'ai'
const SEED_PARAM = 'seed'

function parseIdList(raw: string | null): string[] | null {
  if (!raw?.trim()) return null
  const ids = raw.split(',').map((id) => id.trim()).filter(Boolean)
  return ids.length > 0 ? ids : null
}

export function buildLiveSharePath(input: LiveShareInput): string {
  const params = new URLSearchParams()
  params.set(MODE_PARAM, input.mode)
  params.set(DATE_PARAM, input.challengeDate)
  if (input.targetDate) {
    params.set(TARGET_PARAM, input.targetDate)
  }
  params.set(PLAYERS_PARAM, input.playerIds.join(','))
  params.set(BATTING_ORDER_PARAM, input.battingOrderIds.join(','))
  if (input.aiPlayerIds?.length) {
    params.set(AI_PARAM, input.aiPlayerIds.join(','))
  }
  params.set(SEED_PARAM, input.simSeed)
  return `/live-share?${params.toString()}`
}

export function parseLiveShareParams(
  searchParams: URLSearchParams,
): LiveShareInput | LiveShareValidationError {
  const mode = searchParams.get(MODE_PARAM)
  if (mode !== 'daily-matchup' && mode !== 'live-draft') {
    return { ok: false, error: 'Invalid or missing mode.' }
  }

  const challengeDate = searchParams.get(DATE_PARAM)
  if (!challengeDate) {
    return { ok: false, error: 'Missing challenge date.' }
  }

  const playerIds = parseIdList(searchParams.get(PLAYERS_PARAM))
  const battingOrderIds = parseIdList(searchParams.get(BATTING_ORDER_PARAM))
  const simSeed = searchParams.get(SEED_PARAM)
  if (!playerIds || playerIds.length !== 12) {
    return { ok: false, error: 'Invalid lineup in share link.' }
  }
  if (!battingOrderIds || battingOrderIds.length === 0) {
    return { ok: false, error: 'Invalid batting order in share link.' }
  }
  if (!simSeed) {
    return { ok: false, error: 'Missing simulation seed.' }
  }

  const targetDate = searchParams.get(TARGET_PARAM) ?? undefined
  if (mode === 'daily-matchup' && !targetDate) {
    return { ok: false, error: 'Daily Matchup share links require a target date.' }
  }

  const aiPlayerIds = parseIdList(searchParams.get(AI_PARAM)) ?? undefined
  if (mode === 'live-draft') {
    if (!aiPlayerIds || aiPlayerIds.length !== 12) {
      return { ok: false, error: 'Live Draft share links require an AI lineup.' }
    }
  }

  return {
    mode,
    challengeDate,
    targetDate,
    playerIds,
    battingOrderIds,
    aiPlayerIds,
    simSeed,
  }
}

export function isParsedLiveShare(
  value: LiveShareInput | LiveShareValidationError,
): value is LiveShareInput {
  return !('ok' in value)
}

export function liveShareValidationMessage(
  error: LiveShareValidationError,
): string {
  return error.error
}

export function formatLiveLineupSummary(
  lineup: DailyLineup,
  options?: { opponentName?: string; maxNames?: number },
): string {
  const players = dailyLineupPlayers(lineup)
  const maxNames = options?.maxNames ?? 3
  const preview = players.slice(0, maxNames).map((player) => player.name)
  const remaining = players.length - preview.length
  const roster =
    remaining > 0
      ? `${preview.join(', ')} +${remaining}`
      : preview.join(', ')
  if (options?.opponentName) {
    return `${roster} vs ${options.opponentName}`
  }
  return roster
}

export function liveSharePageTitle(
  mode: LiveModeId,
  series: { userWins: number; opponentWins: number; wonSeries: boolean },
  opponentName: string,
): string {
  const modeLabel = mode === 'daily-matchup' ? 'Daily Matchup' : 'Live Draft'
  return `${modeLabel}: ${series.userWins}-${series.opponentWins} vs ${opponentName}`
}
