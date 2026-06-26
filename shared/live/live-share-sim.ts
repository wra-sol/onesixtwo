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

export function resolveLiveShareOpponent(
  snapshot: LiveSnapshot,
  input: LiveShareInput,
): { name: string; lineup: DailyLineup; battingOrder: LivePlayer[] } | null {
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
      const battingOrder =
        snapshot.opponent.battingOrder.length > 0
          ? snapshot.opponent.battingOrder
          : heuristicAiBattingOrder(
              Object.values(snapshot.opponent.lineup).filter(
                (player): player is LivePlayer => Boolean(player),
              ),
            )
      return {
        name: snapshot.opponent.teamName,
        lineup,
        battingOrder,
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
  const playersById = new Map(snapshot.players.map((player) => [player.id, player]))
  const userLineup = lineupFromPlayerIds(playersById, input.playerIds)
  const battingOrder = input.battingOrderIds
    .map((id) => playersById.get(id))
    .filter((player): player is LivePlayer => Boolean(player))
  const opponent = resolveLiveShareOpponent(snapshot, input)
  if (!opponent) {
    return null
  }

  const userTeam = buildSimTeam('You', userLineup, battingOrder, true)
  const opponentTeam = buildSimTeam(
    opponent.name,
    opponent.lineup,
    opponent.battingOrder,
    false,
  )
  const series = simulateBestOfThree(userTeam, opponentTeam, input.simSeed)

  return {
    series,
    opponentName: opponent.name,
    userLineup,
    sharePath: buildLiveSharePath(input),
    lineupSummary: formatLiveLineupSummary(userLineup, {
      opponentName: opponent.name,
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
    const resolved = simulateLiveShare(shareInput, snapshot)
    if (resolved) {
      return {
        ...base,
        sharePath: resolved.sharePath,
        lineupSummary: resolved.lineupSummary,
        opponentName: resolved.opponentName,
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
