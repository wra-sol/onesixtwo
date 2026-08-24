/**
 * The classic mode's team-strength → win curve. Single owner: game.ts
 * (result assembly) and simulation.ts (season model) both derive from this,
 * so the curve can never drift between them.
 */
export function projectWins(teamScore: number): { wins: number; losses: number } {
  let wins: number
  if (teamScore < 50) {
    wins = Math.round(teamScore * 1.62)
  } else if (teamScore < 75) {
    wins = Math.round(81 + ((teamScore - 50) / 25) * 24)
  } else if (teamScore < 90) {
    wins = Math.round(105 + ((teamScore - 75) / 15) * 20)
  } else if (teamScore < 100) {
    wins = Math.round(128 + ((teamScore - 90) / 10) * 44)
  } else {
    wins = 162
  }
  wins = Math.min(162, Math.max(0, wins))
  return { wins, losses: 162 - wins }
}
