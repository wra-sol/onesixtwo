import { BRAND, sharePlayerName } from '../../src/lib/brand'
import { escapeHtml } from './html'
import { LINEUP_POSITIONS, type Lineup, type SeasonResult } from '../../src/lib/types'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

const COLORS = {
  background: '#06182b',
  card: '#0b2540',
  primary: '#d8b56d',
  foreground: '#fff8ea',
  muted: '#c9d1dc',
  border: '#2d5279',
  perfect: '#efe3cf',
}

function lineupCells(result: SeasonResult, lineup: Lineup): string {
  return LINEUP_POSITIONS.map((pos, index) => {
    const player = lineup[pos]
    const col = index % 3
    const row = Math.floor(index / 3)
    const x = 56 + col * 368
    const y = 340 + row * 88
    return `
      <g transform="translate(${x}, ${y})">
        <rect width="352" height="72" rx="12" fill="${COLORS.card}" stroke="${COLORS.border}" />
        <text x="16" y="28" fill="${COLORS.primary}" font-size="18" font-weight="700">${pos}</text>
        <text x="16" y="56" fill="${COLORS.foreground}" font-size="22" font-weight="600">${escapeHtml(player ? sharePlayerName(player.name) : '—')}</text>
      </g>`
  }).join('')
}

export function buildOgSvg(result: SeasonResult, lineup: Lineup): string {
  const recordColor = result.isPerfectSeason ? COLORS.perfect : COLORS.foreground
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${COLORS.background}" />
  <text x="56" y="88" fill="${COLORS.primary}" font-size="34" font-weight="700">${escapeHtml(BRAND.name)}</text>
  <text x="${OG_WIDTH - 56}" y="88" fill="${COLORS.muted}" font-size="24" text-anchor="end">${escapeHtml(BRAND.domain)}</text>
  <text x="${OG_WIDTH / 2}" y="220" fill="${recordColor}" font-size="112" font-weight="800" text-anchor="middle">${escapeHtml(result.record)}</text>
  <text x="${OG_WIDTH / 2}" y="268" fill="${COLORS.primary}" font-size="32" font-weight="600" text-anchor="middle">${escapeHtml(result.tier.label)}</text>
  <text x="${OG_WIDTH / 2}" y="304" fill="${COLORS.muted}" font-size="24" text-anchor="middle">${escapeHtml(result.identity.label)}</text>
  ${lineupCells(result, lineup)}
</svg>`
}
