import { describe, expect, it } from 'vitest'
import { buildGameBoxScore } from './box-score'
import type { PaEvent, SimulatedGame } from '@shared/live/live-types'

function ev(over: Partial<PaEvent>): PaEvent {
  return {
    inning: 1,
    half: 'top',
    batterName: 'Batter',
    pitcherName: 'Pitcher',
    type: 'out',
    description: 'Batter out',
    runsScored: 0,
    ...over,
  }
}

function game(events: PaEvent[], over: Partial<SimulatedGame> = {}): SimulatedGame {
  return {
    homeScore: 0,
    awayScore: 0,
    homeBox: { runs: 0, hits: 0, errors: 0, homeRuns: 0 },
    awayBox: { runs: 0, hits: 0, errors: 0, homeRuns: 0 },
    events,
    userWasHome: true,
    ...over,
  }
}

describe('buildGameBoxScore', () => {
  it('aggregates batting lines per player in first-appearance order', () => {
    const box = buildGameBoxScore(
      game([
        ev({ half: 'top', batterName: 'Leadoff', type: 'single' }),
        ev({ half: 'top', batterName: 'Slugger', type: 'home_run', runsScored: 2 }),
        ev({ half: 'top', batterName: 'Leadoff', type: 'strikeout' }),
        ev({ half: 'top', batterName: 'Eye', type: 'walk' }),
        ev({ half: 'top', batterName: 'Slugger', type: 'out' }),
      ]),
    )

    expect(box.away.batting.map((r) => r.name)).toEqual([
      'Leadoff',
      'Slugger',
      'Eye',
    ])
    const slugger = box.away.batting[1]!
    expect(slugger).toEqual({ name: 'Slugger', ab: 2, h: 1, hr: 1, rbi: 0, bb: 0, so: 0 })
    const leadoff = box.away.batting[0]!
    expect(leadoff.ab).toBe(2)
    expect(leadoff.h).toBe(1)
    expect(leadoff.so).toBe(1)
    const eye = box.away.batting[2]!
    expect(eye.ab).toBe(0)
    expect(eye.bb).toBe(1)
  })

  it('credits RBI from run_scored events to the driving batter', () => {
    const box = buildGameBoxScore(
      game([
        ev({ half: 'top', batterName: 'Cleanup', type: 'double', runsScored: 2 }),
        ev({
          half: 'top',
          batterName: 'Cleanup',
          type: 'run_scored',
          runsScored: 2,
          description: 'Cleanup drives in 2 run(s)',
        }),
      ]),
    )
    expect(box.away.batting[0]!.rbi).toBe(2)
  })

  it('charges PAs, runs, and outs to the opposing pitcher of record', () => {
    const box = buildGameBoxScore(
      game([
        ev({ half: 'top', batterName: 'A', type: 'strikeout', pitcherName: 'Ace', pitches: 5 }),
        ev({ half: 'top', batterName: 'B', type: 'out', pitcherName: 'Ace', pitches: 3 }),
        ev({ half: 'top', batterName: 'C', type: 'home_run', pitcherName: 'Ace', runsScored: 1, pitches: 2 }),
        ev({ half: 'top', batterName: 'D', type: 'single', pitcherName: 'Relief', runsScored: 1, pitches: 1 }),
      ]),
    )

    const ace = box.home.pitching[0]!
    expect(ace.name).toBe('Ace')
    expect(ace.bf).toBe(3)
    expect(ace.so).toBe(1)
    expect(ace.hr).toBe(1)
    expect(ace.h).toBe(1)
    expect(ace.r).toBe(1)
    expect(ace.pitches).toBe(10)
    expect(ace.ip).toBe('0.2') // K + out = 2 outs

    const relief = box.home.pitching[1]!
    expect(relief.ip).toBe('0.0')
    expect(relief.r).toBe(1)
    expect(relief.h).toBe(1)
  })

  it('splits sides by half: away bats top, home bats bottom', () => {
    const box = buildGameBoxScore(
      game([
        ev({ half: 'top', batterName: 'Away Guy', type: 'single' }),
        ev({ half: 'bottom', batterName: 'Home Guy', type: 'double' }),
      ]),
    )
    expect(box.away.batting.map((r) => r.name)).toEqual(['Away Guy'])
    expect(box.home.batting.map((r) => r.name)).toEqual(['Home Guy'])
    expect(box.home.pitching.map((r) => r.name)).toEqual(['Pitcher'])
    expect(box.away.pitching.map((r) => r.name)).toEqual(['Pitcher'])
  })

  it('ignores baserunning and pinch-hit bookkeeping events', () => {
    const box = buildGameBoxScore(
      game([
        ev({ half: 'top', batterName: 'Thief', type: 'steal' }),
        ev({ half: 'top', batterName: 'Thief', type: 'caught_stealing' }),
        ev({ half: 'top', batterName: 'Sub', type: 'pinch_hit' }),
      ]),
    )
    expect(box.away.batting).toEqual([])
    expect(box.away.pitching).toEqual([])
    expect(box.home.pitching).toEqual([])
  })

  it('formats partial innings of outs as x.1 and x.2', () => {
    const events = [
      ...Array.from({ length: 4 }, () =>
        ev({ half: 'top' as const, batterName: 'X', type: 'out' as const, pitcherName: 'Arm' }),
      ),
    ]
    const box = buildGameBoxScore(game(events))
    expect(box.home.pitching[0]!.ip).toBe('1.1')
  })

  it('reconciles with the team box: hits and runs charged', () => {
    const events: PaEvent[] = [
      ev({ half: 'top', batterName: 'A', type: 'single', pitcherName: 'H1' }),
      ev({ half: 'top', batterName: 'B', type: 'home_run', pitcherName: 'H1', runsScored: 2 }),
      ev({ half: 'bottom', batterName: 'C', type: 'double', pitcherName: 'A1' }),
      ev({ half: 'bottom', batterName: 'D', type: 'out', pitcherName: 'A1' }),
      ev({ half: 'bottom', batterName: 'E', type: 'strikeout', pitcherName: 'A1' }),
    ]
    const g = game(events, {
      awayScore: 2,
      homeScore: 0,
      awayBox: { runs: 2, hits: 2, errors: 0, homeRuns: 1 },
      homeBox: { runs: 0, hits: 1, errors: 0, homeRuns: 0 },
    })
    const box = buildGameBoxScore(g)

    const awayHits = box.away.batting.reduce((sum, r) => sum + r.h, 0)
    expect(awayHits).toBe(g.awayBox.hits)
    const homeHits = box.home.batting.reduce((sum, r) => sum + r.h, 0)
    expect(homeHits).toBe(g.homeBox.hits)

    const runsOffHomePitching = box.home.pitching.reduce((sum, r) => sum + r.r, 0)
    expect(runsOffHomePitching).toBe(g.awayScore)
    const runsOffAwayPitching = box.away.pitching.reduce((sum, r) => sum + r.r, 0)
    expect(runsOffAwayPitching).toBe(g.homeScore)
  })
})
