import type { TeamId } from '../../src/lib/types.ts'

/**
 * Lahman Teams.franchID → stable 162-0 franchise id.
 * Names come from Lahman People (bbrefID matches Baseball Reference).
 */
export const LAHMAN_FRANCH_TO_TEAM: Record<string, TeamId> = {
  NYY: 'yankees',
  BOS: 'red-sox',
  TBD: 'rays',
  TBA: 'rays',
  TOR: 'blue-jays',
  BAL: 'orioles',
  SLA: 'orioles',
  SLB: 'orioles',
  BLA: 'orioles',
  CHW: 'white-sox',
  CLE: 'guardians',
  CLV: 'guardians',
  DET: 'tigers',
  KCR: 'royals',
  MIN: 'twins',
  WS1: 'twins',
  HOU: 'astros',
  ANA: 'angels',
  CAL: 'angels',
  OAK: 'athletics',
  ATH: 'athletics',
  PHA: 'athletics',
  SEA: 'mariners',
  TEX: 'rangers',
  ATL: 'braves',
  MLN: 'braves',
  BSN: 'braves',
  FLA: 'marlins',
  NYM: 'mets',
  PHI: 'phillies',
  WSN: 'nationals',
  MON: 'nationals',
  CHC: 'cubs',
  CIN: 'reds',
  MIL: 'brewers',
  SE1: 'brewers',
  PIT: 'pirates',
  STL: 'cardinals',
  LAD: 'dodgers',
  BRO: 'dodgers',
  SFG: 'giants',
  NYG: 'giants',
  SDP: 'padres',
  COL: 'rockies',
  ARI: 'diamondbacks',
}

export function lahmanFranchToTeam(franchID: string): TeamId | null {
  return LAHMAN_FRANCH_TO_TEAM[franchID] ?? null
}
