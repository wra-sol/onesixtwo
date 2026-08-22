import { describe, expect, it } from 'vitest'
import { buildLegendsSnapshotForSim162 } from '../../src/lib/classic-live-adapter'
import { buildOpponentRoster25SimTeam, buildRoster25SimTeam } from './sim162-team'
import {
  createSim162DraftState,
  autoFillRemaining,
} from './sim162-draft'
import { simulateGameRoster } from './pa-sim'
import type { PaEvent } from './live-types'

/**
 * Calibration contract for the count-based pitch engine. These bands pin
 * the league environment: if an engine change moves runs or outcome rates
 * outside them, that is a conscious recalibration, never an accident.
 */
const BANDS = {
  kRate: [0.22, 0.26],
  bbRate: [0.075, 0.105],
  /** Team runs per game, both sides pooled. */
  runsPerTeamGame: [4.35, 5.05],
  pitchesPerPlateAppearance: [3.3, 3.55],
}

const GAMES = 250

describe('count-engine league calibration', () => {
  it('reproduces league marginals over many games', () => {
    const snapshot = buildLegendsSnapshotForSim162()
    let state = createSim162DraftState(snapshot.players)
    state = autoFillRemaining(state)
    const user = buildRoster25SimTeam(state.roster, { name: 'User' })
    const opponents = Array.from({ length: 6 }, (_, i) =>
      buildOpponentRoster25SimTeam(`opp-${i}`, `Opp ${i}`, snapshot.players, i + 1),
    )

    const tally: Partial<Record<PaEvent['type'], number>> = {}
    let totalPitches = 0
    let totalRuns = 0

    for (let i = 0; i < GAMES; i++) {
      const opp = opponents[i % opponents.length]!
      const game = simulateGameRoster(user, opp, `calib-${i}`, i % 2 === 0, i)
      totalRuns += game.homeScore + game.awayScore
      for (const event of game.events) {
        if (
          event.type === 'steal' ||
          event.type === 'caught_stealing' ||
          event.type === 'run_scored' ||
          event.type === 'pinch_hit'
        ) {
          continue
        }
        tally[event.type] = (tally[event.type] ?? 0) + 1
        totalPitches += event.pitches ?? 0
      }
    }

    const outcomes = ['strikeout', 'walk', 'single', 'double', 'triple', 'home_run', 'out'] as const
    const paTotal = outcomes.reduce((s, k) => s + (tally[k] ?? 0), 0)
    const kRate = (tally.strikeout ?? 0) / paTotal
    const bbRate = (tally.walk ?? 0) / paTotal
    const runsPerTeamGame = totalRuns / (GAMES * 2)
    const pitchesPerPa = totalPitches / paTotal

    // Surface the actuals for tuning runs.
    console.log(
      `calibration: K=${(kRate * 100).toFixed(1)}% BB=${(bbRate * 100).toFixed(1)}% ` +
        `R/team/game=${runsPerTeamGame.toFixed(2)} pitches/PA=${pitchesPerPa.toFixed(2)} ` +
        `hits=${(((tally.single ?? 0) + (tally.double ?? 0) + (tally.triple ?? 0) + (tally.home_run ?? 0)) / paTotal * 100).toFixed(1)}%`,
    )

    expect(kRate).toBeGreaterThanOrEqual(BANDS.kRate[0])
    expect(kRate).toBeLessThanOrEqual(BANDS.kRate[1])
    expect(bbRate).toBeGreaterThanOrEqual(BANDS.bbRate[0])
    expect(bbRate).toBeLessThanOrEqual(BANDS.bbRate[1])
    expect(runsPerTeamGame).toBeGreaterThanOrEqual(BANDS.runsPerTeamGame[0])
    expect(runsPerTeamGame).toBeLessThanOrEqual(BANDS.runsPerTeamGame[1])
    expect(pitchesPerPa).toBeGreaterThanOrEqual(BANDS.pitchesPerPlateAppearance[0])
    expect(pitchesPerPa).toBeLessThanOrEqual(BANDS.pitchesPerPlateAppearance[1])

  }, 60_000)
})
