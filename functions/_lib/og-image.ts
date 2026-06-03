import { BRAND } from '../../src/lib/brand'
import { escapeHtml } from './html'
import type { SeasonResult } from '../../src/lib/types'
import primaryOgImageBin from './primary-og.bin'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

const COLORS = {
  background: '#06182b',
  primary: '#d8b56d',
  foreground: '#fff8ea',
  muted: '#c9d1dc',
  perfect: '#efe3cf',
}

const RIGHT_X = OG_WIDTH - 56
const DISPLAY_FONT = 'Georgia, "Times New Roman", serif'
const SANS_FONT = '"Geist Variable", Geist, sans-serif'

function base64Encode(bytes: ArrayBuffer): string {
  const chunkSize = 0x8000
  const chunks: string[] = []
  const data = new Uint8Array(bytes)
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...data.subarray(i, i + chunkSize)))
  }
  return btoa(chunks.join(''))
}

const primaryOgImage = `data:image/jpeg;base64,${base64Encode(primaryOgImageBin)}`

function teamTagline(result: SeasonResult): string {
  return `${result.tier.label} — ${result.identity.label}`
}

export function buildOgSvg(result: SeasonResult): string {
  const recordColor = result.isPerfectSeason ? COLORS.perfect : COLORS.foreground
  const tagline = teamTagline(result)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <image href="${primaryOgImage}" width="${OG_WIDTH}" height="${OG_HEIGHT}" preserveAspectRatio="xMidYMid slice" />
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${COLORS.background}" opacity="0.28" />
  <text x="56" y="88" fill="${COLORS.primary}" font-family='${DISPLAY_FONT}' font-size="38" font-weight="700">${escapeHtml(BRAND.name)}</text>
  <text x="${RIGHT_X}" y="280" fill="${recordColor}" font-family='${DISPLAY_FONT}' font-size="122" font-weight="700" text-anchor="end">${escapeHtml(result.record)}</text>
  <text x="${RIGHT_X}" y="340" fill="${COLORS.primary}" font-family='${SANS_FONT}' font-size="32" font-weight="600" text-anchor="end">${escapeHtml(tagline)}</text>
  <text x="${RIGHT_X}" y="392" fill="${COLORS.muted}" font-family='${SANS_FONT}' font-size="28" text-anchor="end">${escapeHtml(BRAND.url)}</text>
</svg>`
}
