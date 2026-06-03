import type { Era, TeamId } from '../lib/types'

/** Full decade list (types / Lahman import). */
export const ERAS: Era[] = [
  '1910s',
  '1920s',
  '1930s',
  '1940s',
  '1950s',
  '1960s',
  '1970s',
  '1980s',
  '1990s',
  '2000s',
  '2010s',
  '2020s',
]

/** First playable decade in 162-0 (1960s expansion / modern alignment era). */
export const FIRST_PLAYABLE_ERA: Era = '1960s'

/**
 * Playable decades — 1960s onward (spins and bucket generation).
 */
export const MODERN_ERAS: Era[] = ERAS.slice(ERAS.indexOf(FIRST_PLAYABLE_ERA))

export function isModernEra(era: Era): boolean {
  return MODERN_ERAS.includes(era)
}

export type FranchiseConfig = {
  id: TeamId
  name: string
  displayByEra: Partial<Record<Era, string>>
}

/** All 30 MLB franchises with stable IDs */
export const FRANCHISES: FranchiseConfig[] = [
  { id: 'yankees', name: 'Yankees', displayByEra: {} },
  { id: 'red-sox', name: 'Red Sox', displayByEra: {} },
  { id: 'rays', name: 'Rays', displayByEra: { '1990s': 'Devil Rays', '2000s': 'Devil Rays' } },
  { id: 'blue-jays', name: 'Blue Jays', displayByEra: {} },
  { id: 'orioles', name: 'Orioles', displayByEra: { '1950s': 'Orioles', '1960s': 'Orioles' } },
  {
    id: 'white-sox',
    name: 'White Sox',
    displayByEra: {},
  },
  { id: 'guardians', name: 'Guardians', displayByEra: { '1990s': 'Indians', '2000s': 'Indians', '2010s': 'Indians' } },
  { id: 'tigers', name: 'Tigers', displayByEra: {} },
  { id: 'royals', name: 'Royals', displayByEra: {} },
  { id: 'twins', name: 'Twins', displayByEra: { '1960s': 'Twins', '1970s': 'Twins' } },
  { id: 'astros', name: 'Astros', displayByEra: { '1960s': 'Colt .45s', '1970s': 'Astros' } },
  { id: 'angels', name: 'Angels', displayByEra: { '1960s': 'Angels', '2000s': 'Angels' } },
  {
    id: 'athletics',
    name: 'Athletics',
    displayByEra: {
      '1910s': 'Philadelphia Athletics',
      '1950s': 'Philadelphia Athletics',
      '1970s': 'Oakland Athletics',
      '1980s': 'Oakland Athletics',
    },
  },
  { id: 'mariners', name: 'Mariners', displayByEra: {} },
  { id: 'rangers', name: 'Rangers', displayByEra: { '1960s': 'Senators', '1970s': 'Rangers' } },
  { id: 'braves', name: 'Braves', displayByEra: { '1950s': 'Braves', '1960s': 'Milwaukee Braves' } },
  { id: 'marlins', name: 'Marlins', displayByEra: { '1990s': 'Marlins' } },
  { id: 'mets', name: 'Mets', displayByEra: {} },
  { id: 'phillies', name: 'Phillies', displayByEra: {} },
  {
    id: 'nationals',
    name: 'Nationals',
    displayByEra: { '1960s': 'Expos', '1970s': 'Expos', '1980s': 'Expos', '1990s': 'Expos', '2000s': 'Expos' },
  },
  { id: 'cubs', name: 'Cubs', displayByEra: {} },
  { id: 'reds', name: 'Reds', displayByEra: {} },
  { id: 'brewers', name: 'Brewers', displayByEra: { '1970s': 'Brewers' } },
  { id: 'pirates', name: 'Pirates', displayByEra: {} },
  { id: 'cardinals', name: 'Cardinals', displayByEra: {} },
  {
    id: 'dodgers',
    name: 'Dodgers',
    displayByEra: {
      '1940s': 'Brooklyn Dodgers',
      '1950s': 'Brooklyn Dodgers',
      '1960s': 'Los Angeles Dodgers',
    },
  },
  {
    id: 'giants',
    name: 'Giants',
    displayByEra: {
      '1910s': 'New York Giants',
      '1950s': 'New York Giants',
      '1960s': 'San Francisco Giants',
    },
  },
  { id: 'padres', name: 'Padres', displayByEra: {} },
  { id: 'rockies', name: 'Rockies', displayByEra: { '1990s': 'Rockies' } },
  { id: 'diamondbacks', name: 'Diamondbacks', displayByEra: { '2000s': 'Diamondbacks' } },
]

export function franchiseDisplayName(franchiseId: TeamId, era: Era): string {
  const f = FRANCHISES.find((x) => x.id === franchiseId)
  if (!f) return franchiseId
  return f.displayByEra[era] ?? f.name
}

export function eraIndex(era: Era): number {
  return ERAS.indexOf(era)
}
