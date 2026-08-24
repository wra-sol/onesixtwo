import { describe, expect, it } from 'vitest'
import {
  buildRosterSimTeam,
  buildSimTeam,
  simulateBestOfThree,
  simulateGame,
  freshGameStaffContext,
  simulateGameRoster,
  type RosterSimTeam,
} from './pa-sim'
import { createEmptyDailyLineup, DAILY_HITTER_POSITIONS } from './daily-roster'
import { buildFixtureDailyMatchupSnapshot } from './live-fixtures'
import type {
  LivePlayer,
  LivePlayerGrades,
  PaEvent,
  SimulatedGame,
} from './live-types'

let synth = 0

function makePitcher(
  name: string,
  stuff: number,
  command: number,
  stamina: number,
  pitchHand: 'L' | 'R' = 'R',
): LivePlayer {
  synth += 1
  const overall = Math.round(((stuff + command + stamina) / 3) * 10) / 10
  const grades: LivePlayerGrades = {
    stuff,
    command,
    stamina,
    defense: overall,
    overall,
  }
  return {
    id: `synth-p-${synth}`,
    personId: 900000 + synth,
    name,
    teamId: 999,
    teamAbbrev: 'SYN',
    teamName: 'Synthetic',
    positions: ['SP'],
    role: 'pitcher',
    pitchHand,
    grades,
    appearedOnTargetDate: true,
    isFallback: false,
    pitcherRoles: ['SP', 'RP', 'CL'],
  }
}

function makeHitter(
  name: string,
  grades: { contact: number; power: number; speed: number; defense: number },
  batSide: 'L' | 'R' | 'S' = 'R',
): LivePlayer {
  synth += 1
  const overall = Math.round(
    ((grades.contact + grades.power + grades.speed + grades.defense) / 4) * 10,
  ) / 10
  return {
    id: `synth-h-${synth}`,
    personId: 910000 + synth,
    name,
    teamId: 999,
    teamAbbrev: 'SYN',
    teamName: 'Synthetic',
    positions: ['DH'],
    role: 'hitter',
    batSide,
    grades: { ...grades, overall },
    appearedOnTargetDate: true,
    isFallback: false,
  }
}

function buildLineup(prefix: string, boost = 0): LivePlayer[] {
  const b = (g: number) => Math.min(80, g + boost)
  return [
    makeHitter(`${prefix} C`, { contact: b(54), power: b(44), speed: b(40), defense: b(60) }, 'R'),
    makeHitter(`${prefix} 1B`, { contact: b(58), power: b(66), speed: b(30), defense: b(50) }, 'L'),
    makeHitter(`${prefix} 2B`, { contact: b(60), power: b(40), speed: b(60), defense: b(54) }, 'R'),
    makeHitter(`${prefix} 3B`, { contact: b(56), power: b(58), speed: b(45), defense: b(48) }, 'R'),
    makeHitter(`${prefix} SS`, { contact: b(58), power: b(38), speed: b(64), defense: b(62) }, 'S'),
    makeHitter(`${prefix} LF`, { contact: b(60), power: b(60), speed: b(58), defense: b(52) }, 'L'),
    makeHitter(`${prefix} CF`, { contact: b(64), power: b(48), speed: b(70), defense: b(60) }, 'R'),
    makeHitter(`${prefix} RF`, { contact: b(56), power: b(62), speed: b(50), defense: b(54) }, 'R'),
    makeHitter(`${prefix} P-Spot`, { contact: 25, power: 20, speed: 25, defense: 40 }, 'R'),
  ]
}

function buildTeam(prefix: string, isUser: boolean, boost = 0): RosterSimTeam {
  const battingOrder = buildLineup(prefix, boost)
  const bench = [
    makeHitter(`${prefix} BENCH1`, { contact: 54, power: 50, speed: 50, defense: 50 }, 'R'),
    makeHitter(`${prefix} BENCH2`, { contact: 52, power: 48, speed: 55, defense: 48 }, 'L'),
    makeHitter(`${prefix} BENCH3`, { contact: 50, power: 52, speed: 45, defense: 50 }, 'R'),
  ]
  const rotation = [
    makePitcher(`${prefix} SP1`, 64, 62, 62),
    makePitcher(`${prefix} SP2`, 62, 60, 60),
    makePitcher(`${prefix} SP3`, 60, 58, 58),
    makePitcher(`${prefix} SP4`, 58, 56, 56),
    makePitcher(`${prefix} SP5`, 56, 54, 54),
  ]
  const bullpen = [
    makePitcher(`${prefix} CL`, 72, 70, 45),
    makePitcher(`${prefix} SU1`, 66, 64, 45),
    makePitcher(`${prefix} SU2`, 60, 58, 42),
    makePitcher(`${prefix} MID`, 56, 54, 42),
    makePitcher(`${prefix} MID2`, 52, 50, 40),
    makePitcher(`${prefix} LONG2`, 48, 48, 40),
    makePitcher(`${prefix} LONG`, 44, 44, 40),
  ]
  const catcherDefense = battingOrder[0]!.grades.defense ?? 50
  return buildRosterSimTeam(
    `${prefix} Team`,
    battingOrder,
    bench,
    rotation,
    bullpen,
    catcherDefense,
    isUser,
  )
}

function expectedPitcher(
  defense: RosterSimTeam,
  inning: number,
  gameDiff: number,
  starter: LivePlayer,
): LivePlayer {
  if (inning <= 5) return starter
  if (defense.bullpen.length === 0) return starter
  if (inning >= 8) {
    const close = Math.abs(gameDiff) <= 2
    return close
      ? defense.bullpen[0]!
      : defense.bullpen[defense.bullpen.length - 1]!
  }
  const mid = Math.floor(defense.bullpen.length / 2)
  return defense.bullpen[mid]!
}

type ReplayRow = {
  event: PaEvent
  gameDiff: number
  offense: RosterSimTeam
  defense: RosterSimTeam
  starter: LivePlayer
}

function replayGame(
  game: SimulatedGame,
  user: RosterSimTeam,
  opp: RosterSimTeam,
  userIsHome: boolean,
  gameIndex: number,
): { rows: ReplayRow[]; awayRuns: number; homeRuns: number } {
  const away = userIsHome ? opp : user
  const home = userIsHome ? user : opp
  const userStarter = user.rotation[gameIndex % user.rotation.length]!
  const oppStarter = opp.rotation[gameIndex % opp.rotation.length]!
  const homeStarter = home === user ? userStarter : oppStarter
  const awayStarter = away === user ? userStarter : oppStarter

  let awayRuns = 0
  let homeRuns = 0
  let halfRuns = 0
  let currentHalf = ''
  const rows: ReplayRow[] = []

  for (const e of game.events) {
    const halfKey = `${e.inning}-${e.half}`
    if (halfKey !== currentHalf) {
      if (currentHalf) {
        const [, prevHalf] = currentHalf.split('-')
        if (prevHalf === 'top') awayRuns += halfRuns
        else homeRuns += halfRuns
      }
      currentHalf = halfKey
      halfRuns = 0
    }
    const offense = e.half === 'top' ? away : home
    const defense = e.half === 'top' ? home : away
    const starter = e.half === 'top' ? homeStarter : awayStarter
    const offTeamRuns = e.half === 'top' ? awayRuns : homeRuns
    const defTeamRuns = e.half === 'top' ? homeRuns : awayRuns
    const gameDiff = defTeamRuns - (offTeamRuns + halfRuns)
    rows.push({ event: e, gameDiff, offense, defense, starter })
    if (
      e.type === 'single' ||
      e.type === 'double' ||
      e.type === 'triple' ||
      e.type === 'home_run' ||
      e.type === 'walk'
    ) {
      halfRuns += e.runsScored
    }
  }
  if (currentHalf) {
    const [, lastHalf] = currentHalf.split('-')
    if (lastHalf === 'top') awayRuns += halfRuns
    else homeRuns += halfRuns
  }
  return { rows, awayRuns, homeRuns }
}

function inningOnePitcher(game: SimulatedGame, half: 'top' | 'bottom'): string {
  const e = game.events.find((ev) => ev.inning === 1 && ev.half === half)
  return e ? e.pitcherName : ''
}

describe('buildRosterSimTeam', () => {
  it('produces a valid RosterSimTeam with rotation, bullpen, bench', () => {
    const team = buildTeam('USR', true)
    expect(team.battingOrder).toHaveLength(9)
    expect(team.rotation).toHaveLength(5)
    expect(team.bench).toHaveLength(3)
    expect(team.bullpen).toHaveLength(7)
    expect(team.catcherDefense).toBe(team.battingOrder[0]!.grades.defense)
    expect(team.isUser).toBe(true)
  })

  it('sorts bullpen best-first by overall', () => {
    const team = buildTeam('USR', true)
    const overalls = team.bullpen.map((p) => p.grades.overall)
    const sorted = [...overalls].sort((a, b) => b - a)
    expect(overalls).toEqual(sorted)
    expect(team.bullpen[0]!.name).toBe('USR CL')
    expect(team.bullpen[team.bullpen.length - 1]!.name).toBe('USR LONG')
  })

  it('rejects a battingOrder without exactly 9 hitters', () => {
    const order = buildLineup('X', 0).slice(0, 8)
    expect(() =>
      buildRosterSimTeam('X', order, [], [makePitcher('SP1', 60, 60, 60)], [], 50, true),
    ).toThrow()
  })

  it('rejects an empty rotation', () => {
    const order = buildLineup('X', 0)
    expect(() =>
      buildRosterSimTeam('X', order, [], [], [], 50, true),
    ).toThrow()
  })
})

describe('simulateGameRoster — rotation cycling', () => {
  const user = buildTeam('USR', true)
  const opp = buildTeam('OPP', false)
  const seed = 'rot-cycle'

  it('game 0 uses rotation[0] (SP1)', () => {
    const game = simulateGameRoster(user, opp, seed, true, 0, freshGameStaffContext())
    expect(inningOnePitcher(game, 'top')).toBe('USR SP1')
  })

  it('game 4 uses rotation[4] (SP5)', () => {
    const game = simulateGameRoster(user, opp, seed, true, 4, freshGameStaffContext())
    expect(inningOnePitcher(game, 'top')).toBe('USR SP5')
  })

  it('game 5 wraps to rotation[0] (SP1)', () => {
    const game = simulateGameRoster(user, opp, seed, true, 5, freshGameStaffContext())
    expect(inningOnePitcher(game, 'top')).toBe('USR SP1')
  })
})

describe('simulateGameRoster — starter is the defense\'s starter', () => {
  const user = buildTeam('USR', true)
  const opp = buildTeam('OPP', false)

  it('user is home: user SP pitches TOP (opp bats), opp SP pitches BOTTOM (user bats)', () => {
    const game = simulateGameRoster(user, opp, 'defense', true, 0, freshGameStaffContext())
    expect(inningOnePitcher(game, 'top')).toBe('USR SP1')
    expect(inningOnePitcher(game, 'bottom')).toBe('OPP SP1')
  })

  it('user is away: user SP pitches BOTTOM (opp bats), opp SP pitches TOP (user bats)', () => {
    const game = simulateGameRoster(user, opp, 'defense', false, 0, freshGameStaffContext())
    expect(inningOnePitcher(game, 'top')).toBe('OPP SP1')
    expect(inningOnePitcher(game, 'bottom')).toBe('USR SP1')
  })
})

describe('simulateGameRoster — score + pitcher invariants', () => {
  const user = buildTeam('USR', true)
  const opp = buildTeam('OPP', false)

  for (let g = 0; g < 10; g += 1) {
    const userIsHome = g % 2 === 1
    it(`game ${g} (userIsHome=${userIsHome}): reconstructed score matches box, pitcher rule holds, outs <= 3`, () => {
      const game = simulateGameRoster(user, opp, `inv-${g}`, userIsHome, g, freshGameStaffContext())
      const { rows, awayRuns, homeRuns } = replayGame(game, user, opp, userIsHome, g)

      expect(awayRuns).toBe(game.awayScore)
      expect(homeRuns).toBe(game.homeScore)
      expect(game.awayBox.runs).toBe(game.awayScore)
      expect(game.homeBox.runs).toBe(game.homeScore)

      let awayHits = 0
      let awayHr = 0
      let homeHits = 0
      let homeHr = 0
      const halfOuts = new Map<string, number>()
      for (const { event: e, gameDiff, defense, starter } of rows) {
        expect(e.pitcherName).toBe(expectedPitcher(defense, e.inning, gameDiff, starter).name)
        if (e.type === 'single' || e.type === 'double' || e.type === 'triple') {
          if (e.half === 'top') awayHits += 1
          else homeHits += 1
        }
        if (e.type === 'home_run') {
          if (e.half === 'top') {
            awayHits += 1
            awayHr += 1
          } else {
            homeHits += 1
            homeHr += 1
          }
        }
        if (e.type === 'strikeout' || e.type === 'out' || e.type === 'caught_stealing') {
          const key = `${e.inning}-${e.half}`
          halfOuts.set(key, (halfOuts.get(key) ?? 0) + 1)
        }
      }
      expect(game.awayBox.hits).toBe(awayHits)
      expect(game.homeBox.hits).toBe(homeHits)
      expect(game.awayBox.homeRuns).toBe(awayHr)
      expect(game.homeBox.homeRuns).toBe(homeHr)

      const playedHalves = new Set(game.events.map((e) => `${e.inning}-${e.half}`))
      for (const outs of halfOuts.values()) {
        expect(outs).toBeLessThanOrEqual(3)
      }
      for (const key of playedHalves) {
        expect(halfOuts.get(key) ?? 0).toBe(3)
      }
    })
  }
})

describe('simulateGameRoster — bullpen by leverage', () => {
  it('uses the best arm in close late innings and the worst arm in blowouts', () => {
    const evenUser = buildTeam('USR', true, 0)
    const evenOpp = buildTeam('OPP', false, 0)
    const strongUser = buildTeam('STR', true, 15)
    const weakOpp = buildTeam('WK', false, -10)

    let foundCloseLate = false
    let foundBlowoutLate = false

    for (let g = 0; g < 30; g += 1) {
      const game = simulateGameRoster(evenUser, evenOpp, `lev-even-${g}`, g % 2 === 1, g, freshGameStaffContext())
      const { rows } = replayGame(game, evenUser, evenOpp, g % 2 === 1, g)
      for (const { event: e, gameDiff, defense } of rows) {
        if (e.inning < 8) continue
        if (Math.abs(gameDiff) <= 2) {
          foundCloseLate = true
          expect(e.pitcherName).toBe(defense.bullpen[0]!.name)
        }
      }
    }

    for (let g = 0; g < 30; g += 1) {
      const game = simulateGameRoster(strongUser, weakOpp, `lev-blow-${g}`, g % 2 === 1, g, freshGameStaffContext())
      const { rows } = replayGame(game, strongUser, weakOpp, g % 2 === 1, g)
      for (const { event: e, gameDiff, defense } of rows) {
        if (e.inning < 8) continue
        if (Math.abs(gameDiff) > 2) {
          foundBlowoutLate = true
          expect(e.pitcherName).toBe(defense.bullpen[defense.bullpen.length - 1]!.name)
        }
      }
    }

    expect(foundCloseLate).toBe(true)
    expect(foundBlowoutLate).toBe(true)
  })

  it('uses a middle reliever in innings 6-7', () => {
    const user = buildTeam('USR', true, 0)
    const opp = buildTeam('OPP', false, 0)
    let foundMiddle = false
    for (let g = 0; g < 20; g += 1) {
      const game = simulateGameRoster(user, opp, `mid-${g}`, g % 2 === 1, g, freshGameStaffContext())
      const { rows } = replayGame(game, user, opp, g % 2 === 1, g)
      for (const { event: e, defense } of rows) {
        if (e.inning === 6 || e.inning === 7) {
          foundMiddle = true
          const mid = Math.floor(defense.bullpen.length / 2)
          expect(e.pitcherName).toBe(defense.bullpen[mid]!.name)
        }
      }
    }
    expect(foundMiddle).toBe(true)
  })
})

describe('simulateGameRoster — bench pinch-hitting', () => {
  it('emits a pinch_hit event in inning 7+ for the last batting-order slot', () => {
    const user = buildTeam('USR', true)
    const opp = buildTeam('OPP', false)
    const userBenchIds = new Set(user.bench.map((p) => p.id))
    const userBenchNames = new Set(user.bench.map((p) => p.name))
    const lastSlotName = user.battingOrder[user.battingOrder.length - 1]!.name

    let phCount = 0
    for (let g = 0; g < 40; g += 1) {
      const game = simulateGameRoster(user, opp, `ph-${g}`, true, g, freshGameStaffContext())
      for (const e of game.events) {
        if (e.type !== 'pinch_hit') continue
        expect(e.inning).toBeGreaterThanOrEqual(7)
        expect(userBenchNames.has(e.batterName) || opp.bench.some((p) => p.name === e.batterName)).toBe(true)
        if (userBenchNames.has(e.batterName)) {
          expect(e.description).toContain(`pinch-hits for ${lastSlotName}`)
        }
        phCount += 1
      }
    }
    expect(phCount).toBeGreaterThan(0)
    expect(userBenchIds.size).toBe(3)
  })

  it('does not reuse a bench player within a single game', () => {
    const user = buildTeam('USR', true)
    const opp = buildTeam('OPP', false)
    for (let g = 0; g < 20; g += 1) {
      const game = simulateGameRoster(user, opp, `ph-unique-${g}`, true, g, freshGameStaffContext())
      const perGame = new Map<string, Set<string>>()
      for (const e of game.events) {
        if (e.type !== 'pinch_hit') continue
        const key = e.half
        const set = perGame.get(key) ?? new Set<string>()
        expect(set.has(e.batterName)).toBe(false)
        set.add(e.batterName)
        perGame.set(key, set)
      }
    }
  })

  it('does not pinch-hit before inning 7', () => {
    const user = buildTeam('USR', true)
    const opp = buildTeam('OPP', false)
    for (let g = 0; g < 20; g += 1) {
      const game = simulateGameRoster(user, opp, `ph-late-${g}`, true, g, freshGameStaffContext())
      for (const e of game.events) {
        if (e.type === 'pinch_hit') {
          expect(e.inning).toBeGreaterThanOrEqual(7)
        }
      }
    }
  })
})

describe('simulateGameRoster — determinism', () => {
  it('same seed + teams + gameIndex produce identical SimulatedGame', () => {
    const user = buildTeam('USR', true)
    const opp = buildTeam('OPP', false)
    const a = simulateGameRoster(user, opp, 'determ', true, 3, freshGameStaffContext())
    const b = simulateGameRoster(user, opp, 'determ', true, 3, freshGameStaffContext())
    expect(a).toEqual(b)
  })

  it('different gameIndex produces a different game (different starter + RNG)', () => {
    const user = buildTeam('USR', true)
    const opp = buildTeam('OPP', false)
    const a = simulateGameRoster(user, opp, 'determ', true, 0, freshGameStaffContext())
    const b = simulateGameRoster(user, opp, 'determ', true, 1, freshGameStaffContext())
    expect(inningOnePitcher(a, 'top')).toBe('USR SP1')
    expect(inningOnePitcher(b, 'top')).toBe('USR SP2')
    expect(a).not.toEqual(b)
  })
})

describe('simulateGameRoster — extra innings', () => {
  it('can extend past 9 and stops by inning 20', () => {
    const user = buildTeam('USR', true, 0)
    const opp = buildTeam('OPP', false, 0)
    let reached = 0
    for (let g = 0; g < 40; g += 1) {
      const game = simulateGameRoster(user, opp, `extra-${g}`, g % 2 === 1, g, freshGameStaffContext())
      const maxInning = game.events.reduce((m, e) => Math.max(m, e.inning), 0)
      expect(maxInning).toBeLessThanOrEqual(20)
      if (maxInning > 9) reached += 1
    }
    expect(reached).toBeGreaterThan(0)
  })
})

describe('backward compatibility — existing daily/live sim', () => {
  it('buildSimTeam + simulateGame + simulateBestOfThree still work', () => {
    const snapshot = buildFixtureDailyMatchupSnapshot('2026-06-26', '2026-06-25')
    const hitters = snapshot.players.filter((p) => p.role === 'hitter')
    const pitchers = snapshot.players.filter((p) => p.role === 'pitcher')
    const lineup = createEmptyDailyLineup()
    DAILY_HITTER_POSITIONS.forEach((pos, i) => {
      lineup[pos] = hitters[i] ?? null
    })
    lineup.SP = pitchers[0] ?? null
    lineup.RP = pitchers[1] ?? null
    lineup.CL = pitchers[2] ?? null
    const userTeam = buildSimTeam('You', lineup, hitters.slice(0, 9), true)

    const oppLineup = createEmptyDailyLineup()
    for (const [pos, player] of Object.entries(snapshot.opponent!.lineup)) {
      if (player) {
        oppLineup[pos as keyof typeof oppLineup] = player
      }
    }
    const oppTeam = buildSimTeam(
      snapshot.opponent!.teamName,
      oppLineup,
      snapshot.opponent!.battingOrder,
      false,
    )

    const game = simulateGame(userTeam, oppTeam, 'compat', true)
    expect(game.events.length).toBeGreaterThan(0)
    expect(game.homeScore + game.awayScore).toBeGreaterThanOrEqual(0)
    expect(game.homeBox.runs).toBe(game.homeScore)
    expect(game.awayBox.runs).toBe(game.awayScore)

    const series = simulateBestOfThree(userTeam, oppTeam, 'compat-series')
    expect(series.games.length).toBeGreaterThan(0)
    expect(series.games.length).toBeLessThanOrEqual(3)
  })
})
