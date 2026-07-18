import { FRANCHISES, franchiseDisplayName } from '../data/franchises'
import { PLAYERS } from '../data'
import { getBattingRatings, getPitchingRatings } from './player-ratings'
import { errorsPer162 } from './rating-anchors'
import type { HitterStats, LineupPosition, Player, TeamId } from './types'
import type {
  LivePlayer,
  LivePlayerGrades,
  LivePlayerPosition,
  LivePlayerRole,
  PitcherRoleSlot,
} from '@shared/live/live-types'
import type { Sim162Snapshot } from '@shared/live/sim162-snapshot'

/**
 * Classic `Player` (Lahman legends) → `LivePlayer` adapter.
 *
 * Production adapter for the Sim 162 legends pool (promoted from the W0b spike).
 *
 * Known simplifications (documented):
 * - `batSide` / `pitchHand` are not present on `Player` → default `'R'`. Platoon
 *   modifiers in `paProbabilities` therefore treat every matchup as same-handed
 *   (0.97); no batter ever gets the platoon advantage. Acceptable for a spike;
 *   W4 should source real handedness from Lahman (throws/bats columns).
 * - Two-way players are emitted as `role: 'hitter'` using their batting ratings;
 *   their pitching profile is dropped. W4 may split a two-way into two entries.
 * - Catcher `defense` is derived from fielding error rate (errors per 162,
 *   inverted: `70 - 2×errors/162`, clamped); non-catchers default to 50.
 *   PA-sim only reads the catcher's defense grade.
 *
 * Critical finding — `command` mapping:
 * The plan specified `command = 100 - whip` ("low whip ⇒ high command"), assuming
 * `PlayerRatings.whip` is a lower-is-better grade. It is not: `whip` is a 50–100
 * percentile-anchored rating where **higher = better** (`PITCHER_WHIP_ANCHORS`:
 * 0.95 → 100, 1.41 → 50; e.g. Randy Johnson whip=98). Inverting it would hand
 * elite aces ~2 command and break PA-sim (huge walk rates). So `command` maps
 * **directly** from the whip rating, then soft-clamps to 20–80. The spec formula
 * should be revised for W4. See `scripts/spike-legends-adapter.ts` for evidence.
 *
 * Critical finding — pitcher role / stamina source:
 * `PitcherStats.gs` / `reliefGames` are unreliable on decade cards — 771 cards
 * have `gs === g` (career games mislabeled as starts), which makes
 * `isStarterEligible` classify closers (Mariano, Gossage, Lyle) as starters. The
 * one clean signal is `PlayerRatings.saves`: the type documents "50 for
 * starters", and the data confirms it (`===50` → 3948 starters, `>50` → 352
 * relievers, `>=60` → 125 closers). Role slots and starter `stamina` are
 * therefore derived from `saves`, not from `gs`/`reliefGames`.
 */
export function classicPlayerToLive(player: Player): LivePlayer {
  const isHitter = player.role === 'hitter' || player.role === 'two-way'
  const role: LivePlayerRole = isHitter ? 'hitter' : 'pitcher'
  const teamIdNumber = teamIdToNumber(player.teamId)
  const franchise = FRANCHISES.find((f) => f.id === player.teamId)
  const teamName = franchise
    ? franchiseDisplayName(franchise.id, player.era)
    : player.teamName
  const teamAbbrev = TEAM_ABBREV[player.teamId] ?? '???'
  const pitcherRoles = isHitter ? undefined : legendPitcherRoles(player)
  const isStarterPitcher = !isHitter && pitcherRoles?.includes('SP') === true

  return {
    id: player.id,
    personId: parsePersonId(player.personId),
    name: player.name,
    teamId: teamIdNumber,
    teamAbbrev,
    teamName,
    positions: buildPositions(player, isHitter, pitcherRoles),
    role,
    batSide: isHitter ? 'R' : undefined,
    pitchHand: isHitter ? undefined : 'R',
    grades: buildGrades(player, isHitter, isStarterPitcher),
    appearedOnTargetDate: false,
    isFallback: false,
    pitcherRoles,
  }
}

export function buildLegendsSnapshot(): LivePlayer[] {
  return PLAYERS.map(classicPlayerToLive)
}

export function buildLegendsSnapshotForSim162(): Sim162Snapshot {
  return {
    kind: 'sim162-legends',
    players: buildLegendsSnapshot(),
    simSeed: 'sim162-legends',
  }
}

export function filterLegendsByTeam(
  players: LivePlayer[],
  teamId: TeamId,
): LivePlayer[] {
  const teamIdNumber = teamIdToNumber(teamId)
  return players.filter((p) => p.teamId === teamIdNumber)
}

const TEAM_ABBREV: Record<TeamId, string> = {
  yankees: 'NYY',
  'red-sox': 'BOS',
  rays: 'TB',
  'blue-jays': 'TOR',
  orioles: 'BAL',
  'white-sox': 'CWS',
  guardians: 'CLE',
  tigers: 'DET',
  royals: 'KC',
  twins: 'MIN',
  astros: 'HOU',
  angels: 'LAA',
  athletics: 'OAK',
  mariners: 'SEA',
  rangers: 'TEX',
  braves: 'ATL',
  marlins: 'MIA',
  mets: 'NYM',
  phillies: 'PHI',
  nationals: 'WSH',
  cubs: 'CHC',
  reds: 'CIN',
  brewers: 'MIL',
  pirates: 'PIT',
  cardinals: 'STL',
  dodgers: 'LAD',
  giants: 'SF',
  padres: 'SD',
  rockies: 'COL',
  diamondbacks: 'ARI',
}

function teamIdToNumber(teamId: TeamId): number {
  const idx = FRANCHISES.findIndex((f) => f.id === teamId)
  return idx >= 0 ? idx + 1 : 0
}

function clampGrade(value: number): number {
  return Math.max(20, Math.min(80, value))
}

function hashStringToNumber(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function parsePersonId(personId: string): number {
  return /^\d+$/.test(personId) ? Number(personId) : hashStringToNumber(personId)
}

function mapPosition(pos: LineupPosition): LivePlayerPosition | null {
  switch (pos) {
    case 'LF':
    case 'CF':
    case 'RF':
      return 'OF'
    case 'C':
    case '1B':
    case '2B':
    case '3B':
    case 'SS':
    case 'DH':
    case 'SP':
    case 'RP':
      return pos
    default:
      return null
  }
}

function catcherDefenseGrade(player: Player): number {
  if (player.role === 'pitcher') return 50
  if (!player.positions.includes('C')) return 50
  const stats = player.stats as HitterStats
  const errors = stats.errors ?? 0
  const fieldingGames = stats.fieldingGames ?? stats.g ?? 0
  if (fieldingGames <= 0) return 50
  const per162 = errorsPer162(errors, fieldingGames)
  return clampGrade(70 - per162 * 2)
}

function buildGrades(
  player: Player,
  isHitter: boolean,
  isStarterPitcher: boolean,
): LivePlayerGrades {
  const overall = clampGrade(player.ratings.overall)
  if (isHitter) {
    const bat = getBattingRatings(player)
    return {
      contact: clampGrade(bat.contact),
      power: clampGrade(bat.power),
      speed: clampGrade(bat.speed),
      defense: catcherDefenseGrade(player),
      overall,
    }
  }
  const pitch = getPitchingRatings(player)
  return {
    stuff: clampGrade(pitch.strikeouts),
    command: clampGrade(pitch.whip),
    stamina: isStarterPitcher ? clampGrade(pitch.workload) : 50,
    defense: 50,
    overall,
  }
}

function buildPositions(
  player: Player,
  isHitter: boolean,
  pitcherRoles: PitcherRoleSlot[] | undefined,
): LivePlayerPosition[] {
  if (!isHitter) {
    return pitcherRoles && pitcherRoles.length > 0 ? pitcherRoles : ['SP']
  }
  const out = new Set<LivePlayerPosition>()
  for (const pos of player.positions) {
    const mapped = mapPosition(pos)
    if (mapped && mapped !== 'SP' && mapped !== 'RP') out.add(mapped)
  }
  if (out.size === 0) out.add('DH')
  return [...out]
}

function legendPitcherRoles(player: Player): PitcherRoleSlot[] {
  const saves = player.ratings.saves
  if (saves >= 60) return ['RP', 'CL']
  if (saves > 50) return ['RP']
  return ['SP']
}
