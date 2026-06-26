import type {
  DailyMatchupSnapshot,
  LiveDraftSnapshot,
  LiveModeId,
  LiveSnapshot,
  LiveSubmitPayload,
} from '../../../shared/live/live-types'
import { resolveAndCacheSnapshot } from './resolve-snapshot'

type SnapshotEnv = {
  DB?: D1Database
  USE_LIVE_FIXTURES?: string
}

export async function resolveSnapshot(
  mode: LiveModeId,
  challengeDate: string,
  db: D1Database | undefined,
  env: SnapshotEnv,
): Promise<LiveSnapshot> {
  return resolveAndCacheSnapshot(mode, challengeDate, { ...env, DB: db })
}

export type LiveSubmitValidationError = { ok: false; error: string }

export function parseLiveSubmitPayload(
  raw: unknown,
): LiveSubmitPayload | LiveSubmitValidationError {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid submission payload.' }
  }

  const record = raw as Record<string, unknown>
  const mode = record.mode
  if (mode !== 'daily-matchup' && mode !== 'live-draft') {
    return { ok: false, error: 'Invalid mode.' }
  }

  if (
    typeof record.challengeDate !== 'string' ||
    typeof record.simSeed !== 'string' ||
    !Array.isArray(record.playerIds) ||
    !Array.isArray(record.battingOrderIds)
  ) {
    return { ok: false, error: 'Invalid submission payload.' }
  }

  const playerIds = record.playerIds
  const battingOrderIds = record.battingOrderIds
  if (
    !playerIds.every((id) => typeof id === 'string') ||
    !battingOrderIds.every((id) => typeof id === 'string')
  ) {
    return { ok: false, error: 'Invalid submission payload.' }
  }

  const base = {
    mode,
    challengeDate: record.challengeDate,
    simSeed: record.simSeed,
    initials: typeof record.initials === 'string' ? record.initials : '',
    playerIds,
    battingOrderIds,
    draftTranscript:
      typeof record.draftTranscript === 'string' ? record.draftTranscript : undefined,
  }

  switch (mode) {
    case 'daily-matchup': {
      if (typeof record.targetDate !== 'string') {
        return { ok: false, error: 'Daily Matchup requires targetDate.' }
      }
      return {
        ...base,
        targetDate: record.targetDate,
      }
    }
    case 'live-draft': {
      if (!Array.isArray(record.aiPlayerIds)) {
        return { ok: false, error: 'Live Draft requires aiPlayerIds.' }
      }
      if (!record.aiPlayerIds.every((id) => typeof id === 'string')) {
        return { ok: false, error: 'Invalid aiPlayerIds.' }
      }
      return {
        ...base,
        aiPlayerIds: record.aiPlayerIds,
      }
    }
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

export type ResolvedDailyMatchupSnapshot = DailyMatchupSnapshot & { available: true; opponent: NonNullable<DailyMatchupSnapshot['opponent']> }

export function assertDailyMatchupSnapshot(
  snapshot: LiveSnapshot,
): snapshot is ResolvedDailyMatchupSnapshot {
  return (
    snapshot.kind === 'daily-matchup' &&
    snapshot.available === true &&
    snapshot.opponent !== null
  )
}

export type ResolvedLiveDraftSnapshot = LiveDraftSnapshot

export function assertLiveDraftSnapshot(
  snapshot: LiveSnapshot,
): snapshot is ResolvedLiveDraftSnapshot {
  return snapshot.kind === 'live-draft'
}
