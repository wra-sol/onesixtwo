import type { TeamId } from '../../src/lib/types.ts'

/** MLB Stats API teamId → internal franchise id */
export const MLB_TEAM_ID_TO_TEAM: Record<number, TeamId> = {
  108: 'angels',
  109: 'diamondbacks',
  110: 'orioles',
  111: 'red-sox',
  112: 'cubs',
  113: 'reds',
  114: 'guardians',
  115: 'rockies',
  116: 'tigers',
  117: 'astros',
  118: 'royals',
  119: 'dodgers',
  120: 'nationals',
  121: 'mets',
  133: 'athletics',
  134: 'pirates',
  135: 'padres',
  136: 'mariners',
  137: 'giants',
  138: 'cardinals',
  139: 'rays',
  140: 'rangers',
  141: 'blue-jays',
  142: 'twins',
  143: 'phillies',
  144: 'braves',
  145: 'white-sox',
  146: 'marlins',
  147: 'yankees',
  158: 'brewers',
}

export function teamIdFromMlbApi(mlbTeamId: number): TeamId | null {
  return MLB_TEAM_ID_TO_TEAM[mlbTeamId] ?? null
}

export const TEAM_TO_MLB_ID = Object.fromEntries(
  Object.entries(MLB_TEAM_ID_TO_TEAM).map(([mlbId, teamId]) => [
    teamId,
    Number(mlbId),
  ]),
) as Record<TeamId, number>
