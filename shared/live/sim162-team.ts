import { hashSeed } from './rng'
import { buildRosterSimTeam, type RosterSimTeam } from './pa-sim'
import {
  roster25Bench,
  roster25Bullpen,
  roster25BattingOrder,
  roster25Rotation,
  type Roster25,
} from './roster25'
import { filterSim162PlayersByTeam } from './sim162-snapshot'
import { heuristicAiBattingOrder } from './live-draft'
import type {
  LivePlayer,
  LivePlayerPosition,
  PitcherRoleSlot,
} from './live-types'

/**
 * Defense grade used for catcher effects when no catcher can be located.
 */
const DEFAULT_CATCHER_DEFENSE = 50

/**
 * Catcher defense for a team whose batting order is known: the first player
 * slotted at C provides the grade. This is the single owner of that rule.
 */
export function catcherDefenseForBattingOrder(
  battingOrder: readonly LivePlayer[],
): number {
  const catcher = battingOrder.find((p) => p.positions.includes('C'))
  return catcher?.grades.defense ?? DEFAULT_CATCHER_DEFENSE
}

export type Roster25SimTeamOptions = {
  name?: string
  /** Explicit batting order; defaults to the roster's positional order. */
  battingOrder?: LivePlayer[]
  /** Explicit rotation order (SP1..SP5); defaults to roster slot order. */
  rotationOrder?: LivePlayer[]
}

/**
 * Assembles a sim team from a drafted 25-man roster. This module owns every
 * derived-value rule — batting-order defaulting, bench/bullpen derivation,
 * rotation defaulting, and catcher defense from the roster's C slot — so
 * callers never re-derive them.
 */
export function buildRoster25SimTeam(
  roster: Roster25,
  options: Roster25SimTeamOptions = {},
): RosterSimTeam {
  const battingOrder =
    options.battingOrder && options.battingOrder.length === 9
      ? options.battingOrder
      : roster25BattingOrder(roster)
  const rotation =
    options.rotationOrder && options.rotationOrder.length > 0
      ? options.rotationOrder
      : roster25Rotation(roster)

  return buildRosterSimTeam(
    options.name ?? 'You',
    battingOrder,
    roster25Bench(roster),
    rotation,
    roster25Bullpen(roster),
    roster.C1?.grades.defense ?? DEFAULT_CATCHER_DEFENSE,
    true,
  )
}

function makeFallbackHitter(
  id: string,
  name: string,
  pos: LivePlayerPosition,
): LivePlayer {
  return {
    id,
    personId: (Math.abs(hashSeed(id)) % 900000) + 100000,
    name,
    teamId: 0,
    teamAbbrev: 'FB',
    teamName: 'Fallback',
    positions: [pos],
    role: 'hitter',
    batSide: 'R',
    grades: { contact: 50, power: 50, speed: 50, defense: 50, overall: 50 },
    appearedOnTargetDate: true,
    isFallback: true,
  }
}

function makeFallbackPitcher(
  id: string,
  name: string,
  roles: PitcherRoleSlot[],
): LivePlayer {
  return {
    id,
    personId: (Math.abs(hashSeed(id)) % 900000) + 100000,
    name,
    teamId: 0,
    teamAbbrev: 'FB',
    teamName: 'Fallback',
    positions: ['SP'],
    role: 'pitcher',
    pitchHand: 'R',
    grades: { stuff: 50, command: 50, stamina: 50, defense: 50, overall: 50 },
    appearedOnTargetDate: true,
    isFallback: true,
    pitcherRoles: roles,
  }
}

/**
 * Assembles the sim team a franchise fields against the user in Sim 162:
 * best-overall hitters ordered heuristically, SP/RP/CL split from pitcher
 * roles, and fallback players padding thin franchises. Owns those rules so
 * opponents are built identically everywhere.
 */
export function buildOpponentRoster25SimTeam(
  franchiseId: string,
  franchiseName: string,
  pool: LivePlayer[],
  poolTeamId: number | null,
): RosterSimTeam {
  const teamPlayers =
    poolTeamId == null ? [] : filterSim162PlayersByTeam(pool, poolTeamId)
  const hitters = teamPlayers
    .filter((p) => p.role === 'hitter')
    .sort((a, b) => b.grades.overall - a.grades.overall)
  const pitchers = teamPlayers
    .filter((p) => p.role === 'pitcher')
    .sort((a, b) => b.grades.overall - a.grades.overall)

  let battingOrder = heuristicAiBattingOrder(hitters.slice(0, 9))
  let bench = hitters.slice(9, 12)

  const sps = pitchers.filter((p) => p.pitcherRoles?.includes('SP') ?? false)
  const rotation = sps.slice(0, 5)
  const usedRotIds = new Set(rotation.map((p) => p.id))
  const rps = pitchers.filter(
    (p) =>
      !usedRotIds.has(p.id) &&
      ((p.pitcherRoles?.includes('RP') ?? false) ||
        (p.pitcherRoles?.includes('CL') ?? false)),
  )
  const bullpen = rps.slice(0, 7)

  const fbHitterSlots: LivePlayerPosition[] = [
    'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH',
  ]
  while (battingOrder.length < 9) {
    const pos = fbHitterSlots[battingOrder.length % fbHitterSlots.length]!
    battingOrder = [
      ...battingOrder,
      makeFallbackHitter(
        `fb-h-${franchiseId}-${battingOrder.length}`,
        `${franchiseName} Hitter ${battingOrder.length}`,
        pos,
      ),
    ]
  }
  while (bench.length < 3) {
    bench = [
      ...bench,
      makeFallbackHitter(
        `fb-bench-${franchiseId}-${bench.length}`,
        `${franchiseName} Bench ${bench.length}`,
        'DH',
      ),
    ]
  }

  const rotationPadded = [...rotation]
  while (rotationPadded.length < 5) {
    rotationPadded.push(
      makeFallbackPitcher(
        `fb-sp-${franchiseId}-${rotationPadded.length}`,
        `${franchiseName} SP ${rotationPadded.length}`,
        ['SP'],
      ),
    )
  }
  const bullpenPadded = [...bullpen]
  while (bullpenPadded.length < 7) {
    bullpenPadded.push(
      makeFallbackPitcher(
        `fb-rp-${franchiseId}-${bullpenPadded.length}`,
        `${franchiseName} RP ${bullpenPadded.length}`,
        ['RP'],
      ),
    )
  }

  return buildRosterSimTeam(
    franchiseName,
    battingOrder,
    bench,
    rotationPadded,
    bullpenPadded,
    catcherDefenseForBattingOrder(battingOrder),
    false,
  )
}
