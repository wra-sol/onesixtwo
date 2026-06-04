import type { Player, PlayerRatings } from './types'

export function getBattingRatings(player: Player): PlayerRatings {
  if (player.battingRatings) return player.battingRatings
  if (player.role === 'pitcher') {
    return {
      contact: 0,
      power: 0,
      speed: 0,
      runProduction: 0,
      ops: 0,
      era: 0,
      whip: 0,
      strikeouts: 0,
      wins: 0,
      saves: 0,
      workload: 0,
      overall: 0,
    }
  }
  return player.ratings
}

export function getPitchingRatings(player: Player): PlayerRatings {
  if (player.pitchingRatings) return player.pitchingRatings
  if (player.role === 'hitter') {
    return {
      contact: 0,
      power: 0,
      speed: 0,
      runProduction: 0,
      ops: 0,
      era: 0,
      whip: 0,
      strikeouts: 0,
      wins: 0,
      saves: 0,
      workload: 0,
      overall: 0,
    }
  }
  return player.ratings
}
