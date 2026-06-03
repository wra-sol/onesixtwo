import { BRAND } from './brand'
import type {
  CategoryScore,
  LineupIdentity,
  SeasonMoment,
  SeasonNoteSource,
  SeasonSimulation,
  SeasonTier,
} from './types'

export function getSeasonTier(wins: number, losses: number): SeasonTier {
  if (wins === 162 && losses === 0) {
    return {
      label: 'Perfect Season',
      description: `You hit ${BRAND.perfectRecord}.`,
      tone: 'perfect',
    }
  }
  if (wins >= 120) {
    return {
      label: 'Dynasty',
      description: 'A dominant season that owned the league.',
      tone: 'dynasty',
    }
  }
  if (wins >= 100) {
    return {
      label: 'Contender',
      description: 'Strong roster, strong season — just not perfect.',
      tone: 'contender',
    }
  }
  if (wins >= 85) {
    return {
      label: 'Playoff push',
      description: `Close to the chase, but ${BRAND.perfectRecord} stayed out of reach.`,
      tone: 'playoff',
    }
  }
  return {
    label: 'Rebuild',
    description: 'The roster needs more firepower. Draft again.',
    tone: 'rebuild',
  }
}

function noteToMoment(
  note: SeasonNoteSource,
  simulation: SeasonSimulation,
  identity: LineupIdentity,
  strengths: CategoryScore[],
): SeasonMoment | null {
  switch (note.type) {
    case 'streak':
      return {
        text: `A ${simulation.longestWinStreak}-game win streak carried the middle of the schedule.`,
        importance: note.importance,
      }
    case 'slump':
      return {
        text: `A ${simulation.longestLosingStreak}-game skid tested the roster's depth.`,
        importance: note.importance,
      }
    case 'closeGames':
      return {
        text: `Close games defined the season (${simulation.closeGameRecord} in one-run margins).`,
        importance: note.importance,
      }
    case 'blowouts':
      return {
        text: `The lineup ran up the score in blowouts (${simulation.blowoutRecord}).`,
        importance: note.importance,
      }
    case 'offense':
      return {
        text: `${strengths[0]?.label ?? 'Offense'} powered ${simulation.offenseDrivenWins} wins.`,
        importance: note.importance,
      }
    case 'pitching':
      return {
        text: `Run prevention delivered ${simulation.pitchingDrivenWins} wins from the mound.`,
        importance: note.importance,
      }
    case 'starPlayer':
      return {
        text: 'A franchise star carried the heaviest innings.',
        importance: note.importance,
      }
    case 'weakness':
      return {
        text: `${identity.label} lived on variance — highs and lows all year.`,
        importance: note.importance,
      }
    case 'expectation': {
      const delta = simulation.luckDelta
      if (delta > 0) {
        return {
          text: `Outperformed the roster baseline by ${delta} wins.`,
          importance: note.importance,
        }
      }
      if (delta < 0) {
        return {
          text: `Fell ${Math.abs(delta)} wins short of the roster baseline.`,
          importance: note.importance,
        }
      }
      return null
    }
    default:
      return null
  }
}

export function buildSeasonMoments(
  simulation: SeasonSimulation,
  identity: LineupIdentity,
  strengths: CategoryScore[],
  maxMoments = 4,
): SeasonMoment[] {
  const moments = simulation.noteSources
    .map((note) => noteToMoment(note, simulation, identity, strengths))
    .filter((m): m is SeasonMoment => m !== null)
    .sort((a, b) => b.importance - a.importance)

  if (moments.length === 0) {
    return [
      {
        text: `${identity.label} finished ${simulation.record}.`,
        importance: 5,
      },
    ]
  }

  return moments.slice(0, maxMoments)
}

export function formatLuckDelta(luckDelta: number): string {
  if (luckDelta === 0) return 'Right on expectation'
  if (luckDelta > 0) return `+${luckDelta} wins over expectation`
  return `${luckDelta} wins below expectation`
}

export function getHeadline(wins: number, losses: number): string {
  if (wins === 162 && losses === 0) {
    return `PERFECT SEASON! You went ${BRAND.perfectRecord}!`
  }
  if (wins >= 120) {
    return 'Dynasty! Your lineup dominated the league.'
  }
  if (wins >= 100) {
    return 'Contender! A strong season, but not perfect.'
  }
  if (wins >= 85) {
    return `Playoff push — close, but ${BRAND.perfectRecord} slipped away.`
  }
  return 'Rebuild season. Try another draft!'
}

export function getSignatureMoment(moments: SeasonMoment[]): string | null {
  return moments[0]?.text ?? null
}
