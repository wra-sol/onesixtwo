import {
  createEmptyDailyLineup,
  DAILY_LINEUP_POSITIONS,
  type DailyLineup,
  type DailyLineupPosition,
} from './daily-roster'
import { heuristicAiBattingOrder } from './live-draft'
import { buildLiveSharePath, formatLiveLineupSummary } from './live-share-url'
import { buildSimTeam, simulateBestOfThree } from './pa-sim'
import type {
  LiveLeaderboardEntryRow,
  LivePlayer,
  LiveShareInput,
  LiveSnapshot,
  LiveSubmitPayload,
  SimulatedSeries,
} from './live-types'

export function lineupFromPlayerIds(
  playersById: Map<string, LivePlayer>,
  playerIds: string[],
): DailyLineup {
  const lineup = createEmptyDailyLineup()
  playerIds.forEach((id, index) => {
    const player = playersById.get(id)
    const position = DAILY_LINEUP_POSITIONS[index]
    if (player && position) {
      lineup[position] = player
    }
  })
  return lineup
}

export type LineupTeam = {
  name: string
  lineup: DailyLineup
  battingOrder: LivePlayer[]
}

/**
 * Single owner of the opponent batting-order rule: use the provided order
 * when present, otherwise derive heuristically from the lineup.
 */
export function opponentBattingOrder(
  lineup: DailyLineup,
  battingOrder: LivePlayer[] | undefined | null,
): LivePlayer[] {
  return battingOrder && battingOrder.length > 0
    ? battingOrder
    : heuristicAiBattingOrder(
        Object.values(lineup).filter(
          (player): player is LivePlayer => Boolean(player),
        ),
      )
}

/**
 * Assembles both SimTeams from lineups and plays the best-of-3 series.
 * Submission verification, share rendering, and draft completion all resolve
 * through this one interface so they can never diverge.
 */
export function simulateLineupSeries(
  user: LineupTeam,
  opponent: LineupTeam,
  simSeed: string,
): SimulatedSeries {
  const userTeam = buildSimTeam(user.name, user.lineup, user.battingOrder, true)
  const opponentTeam = buildSimTeam(
    opponent.name,
    opponent.lineup,
    opponent.battingOrder,
    false,
  )
  return simulateBestOfThree(userTeam, opponentTeam, simSeed)
}

export function resolveLiveShareOpponent(
  snapshot: LiveSnapshot,
  input: Pick<LiveShareInput, 'mode' | 'aiPlayerIds'>,
): LineupTeam | null {
  const playersById = new Map(snapshot.players.map((player) => [player.id, player]))

  switch (input.mode) {
    case 'daily-matchup': {
      if (snapshot.kind !== 'daily-matchup' || !snapshot.opponent) {
        return null
      }
      const lineup = createEmptyDailyLineup()
      for (const [position, player] of Object.entries(snapshot.opponent.lineup)) {
        if (player) {
          lineup[position as DailyLineupPosition] = player
        }
      }
      return {
        name: snapshot.opponent.teamName,
        lineup,
        battingOrder: opponentBattingOrder(lineup, snapshot.opponent.battingOrder),
      }
    }
    case 'live-draft': {
      if (snapshot.kind !== 'live-draft' || !input.aiPlayerIds) {
        return null
      }
      const lineup = lineupFromPlayerIds(playersById, input.aiPlayerIds)
      const battingOrder = heuristicAiBattingOrder(
        input.aiPlayerIds
          .map((id) => playersById.get(id))
          .filter((player): player is LivePlayer => Boolean(player)),
      )
      return { name: 'AI', lineup, battingOrder }
    }
    default: {
      const _exhaustive: never = input.mode
      return _exhaustive
    }
  }
}

type LiveShareContext = {
  opponent: LineupTeam
  opponentName: string
  userLineup: DailyLineup
  battingOrder: LivePlayer[]
  sharePath: string
}

/**
 * Everything a stored submission needs resolved against its pool snapshot:
 * opponent, user lineup, and share path. No simulation — display-only
 * consumers (leaderboard rows) stop here; full replays continue below.
 */
export function resolveLiveShareContext(
  input: LiveShareInput,
  snapshot: LiveSnapshot,
): LiveShareContext | null {
  const playersById = new Map(snapshot.players.map((player) => [player.id, player]))
  const userLineup = lineupFromPlayerIds(playersById, input.playerIds)
  const battingOrder = input.battingOrderIds
    .map((id) => playersById.get(id))
    .filter((player): player is LivePlayer => Boolean(player))
  const opponent = resolveLiveShareOpponent(snapshot, input)
  if (!opponent) {
    return null
  }

  return {
    opponent,
    opponentName: opponent.name,
    userLineup,
    battingOrder,
    sharePath: buildLiveSharePath(input),
  }
}

/** Display fields for a leaderboard row: pure derivation, no series re-sim. */
export function describeLiveShare(
  input: LiveShareInput,
  snapshot: LiveSnapshot,
): {
  sharePath: string
  lineupSummary: string
  opponentName: string
} | null {
  const context = resolveLiveShareContext(input, snapshot)
  if (!context) return null
  return {
    sharePath: context.sharePath,
    lineupSummary: formatLiveLineupSummary(context.userLineup, {
      opponentName: context.opponentName,
    }),
    opponentName: context.opponentName,
  }
}

export function simulateLiveShare(
  input: LiveShareInput,
  snapshot: LiveSnapshot,
): {
  series: SimulatedSeries
  opponentName: string
  userLineup: DailyLineup
  sharePath: string
  lineupSummary: string
} | null {
  const context = resolveLiveShareContext(input, snapshot)
  if (!context) {
    return null
  }

  const series = simulateLineupSeries(
    { name: 'You', lineup: context.userLineup, battingOrder: context.battingOrder },
    context.opponent,
    input.simSeed,
  )

  return {
    series,
    opponentName: context.opponentName,
    userLineup: context.userLineup,
    sharePath: context.sharePath,
    lineupSummary: formatLiveLineupSummary(context.userLineup, {
      opponentName: context.opponentName,
    }),
  }
}

type StoredLiveLeaderboardRow = Omit<
  LiveLeaderboardEntryRow,
  'sharePath' | 'lineupSummary' | 'opponentName'
> & {
  payloadJson: string
}

export function enrichLiveLeaderboardRow(
  row: StoredLiveLeaderboardRow,
  snapshot: LiveSnapshot,
): LiveLeaderboardEntryRow {
  const { payloadJson, ...base } = row

  try {
    const payload = JSON.parse(payloadJson) as LiveSubmitPayload
    const shareInput: LiveShareInput = {
      mode: payload.mode,
      challengeDate: payload.challengeDate,
      targetDate: payload.targetDate,
      playerIds: payload.playerIds,
      battingOrderIds: payload.battingOrderIds,
      aiPlayerIds: payload.aiPlayerIds,
      simSeed: payload.simSeed,
    }
    // Display fields only — the stored row already carries the verified
    // series result, so board rendering never re-sims.
    const described = describeLiveShare(shareInput, snapshot)
    if (described) {
      return {
        ...base,
        sharePath: described.sharePath,
        lineupSummary: described.lineupSummary,
        opponentName: described.opponentName,
      }
    }
  } catch {
    // Fall through to empty share fields.
  }

  return {
    ...base,
    sharePath: '',
    lineupSummary: '—',
    opponentName: undefined,
  }
}
