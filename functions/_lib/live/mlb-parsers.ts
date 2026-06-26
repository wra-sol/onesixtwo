import type { RawPlayerInput } from '../../../shared/live/live-mlb-mapper'

type BatSide = 'L' | 'R' | 'S'
type PitchHand = 'L' | 'R'

const POSITION_MAP: Record<string, RawPlayerInput['positions'][number]> = {
  '1': 'P',
  '2': 'C',
  '3': '1B',
  '4': '2B',
  '5': '3B',
  '6': 'SS',
  '7': 'LF',
  '8': 'CF',
  '9': 'RF',
  '10': 'DH',
  O: 'OF',
}

export function mapPosition(code: string): RawPlayerInput['positions'] {
  const pos = POSITION_MAP[code]
  return pos ? [pos] : ['OF']
}

export function parseBatSide(code: string | undefined): BatSide | undefined {
  if (code === 'L' || code === 'R' || code === 'S') return code
  return undefined
}

export function parsePitchHand(code: string | undefined): PitchHand | undefined {
  if (code === 'L' || code === 'R') return code
  return undefined
}

export function parseHitterStats(
  split: Record<string, unknown> | undefined,
): RawPlayerInput['hitterStats'] | null {
  if (!split) return null
  const avg = Number(split.avg)
  const obp = Number(split.obp)
  const slg = Number(split.slg)
  if (!Number.isFinite(avg) || !Number.isFinite(obp) || !Number.isFinite(slg)) {
    return null
  }
  const ops = Number.isFinite(Number(split.ops)) ? Number(split.ops) : obp + slg
  const sb = Number(split.stolenBases ?? split.sb ?? 0)
  const pa = Number(split.plateAppearances ?? split.pa ?? 0)
  if (!Number.isFinite(sb) || !Number.isFinite(pa)) return null
  return { avg, obp, slg, ops, sb, pa }
}

export function parsePitcherStats(
  split: Record<string, unknown> | undefined,
): RawPlayerInput['pitcherStats'] | null {
  if (!split) return null
  const ip = Number(split.inningsPitched ?? split.ip ?? 0)
  const era = Number(split.era)
  const whip = Number(split.whip)
  if (!Number.isFinite(era) || !Number.isFinite(whip)) return null
  const k = Number(split.strikeOuts ?? split.so ?? 0)
  const bb = Number(split.baseOnBalls ?? split.bb ?? 0)
  if (!Number.isFinite(k) || !Number.isFinite(bb)) return null
  const k9 = ip > 0 ? (k / ip) * 9 : null
  const bb9 = ip > 0 ? (bb / ip) * 9 : null
  if (k9 === null || bb9 === null) return null
  const gs = Number(split.gamesStarted ?? split.gs ?? 0)
  const saves = Number(split.saves ?? 0)
  const g = Number(split.gamesPlayed ?? split.g ?? 0)
  if (!Number.isFinite(gs) || !Number.isFinite(saves) || !Number.isFinite(g)) return null
  return { era, whip, k9, bb9, ip, gs, saves, g }
}
