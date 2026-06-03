import type { Lineup, LineupPosition } from './types'

/** Public site brand — keep in sync with index.html meta tags. */
export const BRAND = {
  name: 'Perfect Season',
  shortName: 'Perfect Season',
  domain: 'onesixtytwo.win',
  url: 'https://onesixtytwo.win',
  logoPath: '/perfect-season-logo.png',
  ogImagePath: '/og.png',
  contactEmail: 'privacy@onesixtytwo.win',
  legalLastUpdated: '2026-06-03',
  governingLaw: 'Canada',
  /** The perfect projected season (game goal). */
  perfectRecord: '162-0',
  tagline: 'Draft the perfect 162-game season.',
  description:
    'Draft an all-time MLB lineup, chase a perfect 162-0 projection, and see whether your roster earns a Perfect Season.',
  inspiredByUrl: 'https://www.82-0.com/',
  inspiredByName: '82-0',
} as const

export type ShareTextInput = {
  wins: number
  losses: number
  lineupSummary: string
  mvpLine?: string | null
  tierLabel?: string
  identityLabel?: string
  luckDelta?: number
  signatureMoment?: string | null
}

function shareTierLabel(wins: number, losses: number): string {
  if (wins === 162 && losses === 0) return 'Perfect Season'
  if (wins >= 120) return 'Dynasty'
  if (wins >= 100) return 'Contender'
  if (wins >= 85) return 'Playoff push'
  return 'Rebuild'
}

function gapFromPerfect(wins: number, losses: number): string {
  if (wins === 162 && losses === 0) {
    return `Hit ${BRAND.perfectRecord}`
  }
  const short = 162 - wins
  return `${short} win${short === 1 ? '' : 's'} from ${BRAND.perfectRecord}`
}

/** Last name (or full name) for compact share lines. */
export function sharePlayerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1]! : fullName
}

export function formatLineupShareSummary(
  positions: readonly LineupPosition[],
  lineup: Lineup,
): string {
  return positions
    .map((pos) => {
      const player = lineup[pos]
      if (!player) return null
      return `${pos} ${sharePlayerName(player.name)}`
    })
    .filter((entry): entry is string => entry !== null)
    .join(' · ')
}

export function formatShareText({
  wins,
  losses,
  lineupSummary,
  mvpLine,
  tierLabel,
  identityLabel,
  luckDelta,
  signatureMoment,
}: ShareTextInput): string {
  const record = `${wins}-${losses}`
  const tier = tierLabel ?? shareTierLabel(wins, losses)
  const recapParts: string[] = []
  if (identityLabel) recapParts.push(identityLabel)
  if (luckDelta !== undefined && luckDelta !== 0) {
    recapParts.push(
      luckDelta > 0
        ? `+${luckDelta} wins over expectation`
        : `${luckDelta} wins below expectation`,
    )
  } else if (signatureMoment) {
    recapParts.push(signatureMoment)
  }
  const recapLine =
    recapParts.length > 0 ? recapParts.join(', ') : gapFromPerfect(wins, losses)

  const lines = [
    `${BRAND.name} · ${record}`,
    `${tier} — ${recapLine}`,
    BRAND.url,
    '',
    lineupSummary,
  ]
  if (mvpLine) {
    lines.push('', mvpLine)
  }
  lines.push('', `Can you chase ${BRAND.perfectRecord}? ${BRAND.url}`)
  return lines.join('\n')
}
