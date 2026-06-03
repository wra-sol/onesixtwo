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

export function formatShareText(wins: number, losses: number): string {
  return `${BRAND.name} (${BRAND.domain}): I drafted an all-time lineup and projected ${wins}-${losses}. Can you chase ${BRAND.perfectRecord}?`
}
