import type { PaEvent, SimulatedGame } from '@shared/live/live-types'

export type BoxScoreBattingRow = {
  name: string
  ab: number
  h: number
  hr: number
  rbi: number
  bb: number
  so: number
}

export type BoxScorePitchingRow = {
  name: string
  ip: string
  bf: number
  h: number
  r: number
  hr: number
  bb: number
  so: number
  pitches: number
}

export type BoxScoreSide = {
  batting: BoxScoreBattingRow[]
  pitching: BoxScorePitchingRow[]
}

export type GameBoxScore = {
  away: BoxScoreSide
  home: BoxScoreSide
}

type Side = 'away' | 'home'

const PA_TYPES = new Set([
  'out',
  'strikeout',
  'walk',
  'single',
  'double',
  'triple',
  'home_run',
])

const HIT_TYPES = new Set(['single', 'double', 'triple', 'home_run'])

function sideForEvent(event: PaEvent): Side {
  return event.half === 'top' ? 'away' : 'home'
}

/** Returns the row's list index, appending a fresh row on first sight. */
function rowIndexOf<T>(
  list: T[],
  indexByName: Map<string, number>,
  key: string,
  make: () => T,
): number {
  const existing = indexByName.get(key)
  if (existing !== undefined) return existing
  const index = list.length
  indexByName.set(key, index)
  list.push(make())
  return index
}

function emptyBattingRow(name: string): BoxScoreBattingRow {
  return { name, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, so: 0 }
}

function emptyPitchingRow(name: string): BoxScorePitchingRow {
  return { name, ip: '0.0', bf: 0, h: 0, r: 0, hr: 0, bb: 0, so: 0, pitches: 0 }
}

/**
 * Derives per-player batting and pitching lines for both sides of a simulated
 * game from its plate-appearance events. The engine does not model runner
 * identity, so batting lines omit the R column; team runs stay authoritative
 * on the game box. Pitchers are charged runs from the PAs they face.
 */
export function buildGameBoxScore(game: SimulatedGame): GameBoxScore {
  const batting: Record<Side, BoxScoreBattingRow[]> = {
    away: [],
    home: [],
  }
  const pitching: Record<Side, BoxScorePitchingRow[]> = {
    away: [],
    home: [],
  }
  const batIndex: Record<Side, Map<string, number>> = {
    away: new Map(),
    home: new Map(),
  }
  const pitchIndex: Record<Side, Map<string, number>> = {
    away: new Map(),
    home: new Map(),
  }
  const outs: Record<Side, number[]> = { away: [], home: [] }

  for (const event of game.events) {
    const batSide = sideForEvent(event)
    const fieldSide: Side = batSide === 'away' ? 'home' : 'away'
    const isPa = PA_TYPES.has(event.type)

    if (isPa) {
      const row =
        batting[batSide][
          rowIndexOf(batting[batSide], batIndex[batSide], event.batterName, () =>
            emptyBattingRow(event.batterName),
          )
        ]!
      if (event.type === 'walk') {
        row.bb += 1
      } else {
        row.ab += 1
        if (event.type === 'strikeout') row.so += 1
        if (HIT_TYPES.has(event.type)) {
          row.h += 1
          if (event.type === 'home_run') row.hr += 1
        }
      }

      const arm =
        pitching[fieldSide][
          rowIndexOf(
            pitching[fieldSide],
            pitchIndex[fieldSide],
            event.pitcherName,
            () => emptyPitchingRow(event.pitcherName),
          )
        ]!
      arm.bf += 1
      arm.pitches += event.pitches ?? 0
      arm.r += event.runsScored
      if (event.type === 'walk') arm.bb += 1
      if (event.type === 'strikeout') {
        arm.so += 1
        outs[fieldSide][pitchIndex[fieldSide].get(event.pitcherName)!] =
          (outs[fieldSide][pitchIndex[fieldSide].get(event.pitcherName)!] ?? 0) + 1
      }
      if (event.type === 'out') {
        outs[fieldSide][pitchIndex[fieldSide].get(event.pitcherName)!] =
          (outs[fieldSide][pitchIndex[fieldSide].get(event.pitcherName)!] ?? 0) + 1
      }
      if (HIT_TYPES.has(event.type)) {
        arm.h += 1
        if (event.type === 'home_run') arm.hr += 1
      }
    } else if (event.type === 'run_scored') {
      const row =
        batting[batSide][
          rowIndexOf(batting[batSide], batIndex[batSide], event.batterName, () =>
            emptyBattingRow(event.batterName),
          )
        ]!
      row.rbi += event.runsScored
    }
    // steal / caught_stealing / pinch_hit events carry no box-score lines.
  }

  for (const side of ['away', 'home'] as const) {
    pitching[side].forEach((row, i) => {
      const o = outs[side][i] ?? 0
      row.ip = `${Math.floor(o / 3)}.${o % 3}`
    })
  }

  return { away: { batting: batting.away, pitching: pitching.away }, home: { batting: batting.home, pitching: pitching.home } }
}
