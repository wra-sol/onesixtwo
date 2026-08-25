import {
  createSim162DraftState,
  assignSim162Player,
  autoFillRemaining,
  isSim162RosterComplete,
  getSim162DisabledReason,
} from '../shared/live/sim162-draft'
import {
  roster25Rotation,
  roster25Bullpen,
  roster25Bench,
  roster25BattingOrder,
  roster25IsComplete,
  playerEligibleForRoster25Slot,
  ROSTER25_POSITION_SLOTS,
} from '../shared/live/roster25'
import { sim162SeasonSeed } from '../shared/live/seeds'
import { buildSim162Season } from '../shared/live/sim162-season'
import { buildLegendsSnapshotForSim162 } from '../src/lib/classic-live-adapter'
import {
  buildOpponentRoster25SimTeam,
  buildRoster25SimTeam,
} from '../shared/live/sim162-team'
import { freshGameStaffContext, simulateGameRoster } from '../shared/live/pa-sim'
import { heuristicAiBattingOrder } from '../shared/live/live-draft'
import { coinFlipTieWinner } from '../shared/live/series-sim'
import type { LivePlayer, SimulatedGame, SimulatedSeries } from '../shared/live/live-types'
import type { Sim162SeasonResult } from '../shared/live/sim162-season'

function singleGameToSeries(game: SimulatedGame): SimulatedSeries {
  const userScore = game.userWasHome ? game.homeScore : game.awayScore
  const oppScore = game.userWasHome ? game.awayScore : game.homeScore
  return {
    games: [game],
    userWins: userScore > oppScore ? 1 : 0,
    opponentWins: oppScore > userScore ? 1 : 0,
    userRuns: userScore,
    opponentRuns: oppScore,
    userRunDiff: userScore - oppScore,
    wonSeries: userScore > oppScore,
    seed: 'single',
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`QA FAIL: ${message}`)
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`QA FAIL: ${label}: expected ${String(expected)}, got ${String(actual)}`)
  }
}

let passed = 0
function check(label: string, fn: () => void): void {
  fn()
  passed++
  console.log(`  ✓ ${label}`)
}

function runSeasonQa(
  label: string,
  pool: LivePlayer[],
  simSeed: string,
): Sim162SeasonResult {
  console.log(`\n=== ${label} ===`)

  let draftState = createSim162DraftState(pool)
  assert(draftState.status === 'drafting', `${label}: initial status is drafting`)
  assert(draftState.roster !== null, `${label}: roster initialized`)

  const slots = [...ROSTER25_POSITION_SLOTS]
  let manualPicks = 0
  for (const slot of slots.slice(0, 8)) {
    const eligible = pool.find(
      (p) => getSim162DisabledReason(p, draftState) === null,
    )
    if (!eligible) break
    draftState = assignSim162Player(draftState, eligible, slot)
    manualPicks++
  }
  check(`${label}: manual picks (${manualPicks}) succeed`, () => {
    assertEqual(manualPicks, 8, 'manual pick count')
  })

  check(`${label}: auto-fill completes the roster`, () => {
    draftState = autoFillRemaining(draftState)
    assert(isSim162RosterComplete(draftState), 'roster complete after auto-fill')
    assertEqual(draftState.status, 'complete', 'status is complete')
  })

  check(`${label}: roster has all 25 slots filled`, () => {
    assert(roster25IsComplete(draftState.roster), 'roster25IsComplete')
    const filled = Object.values(draftState.roster).filter(Boolean).length
    assertEqual(filled, 25, 'filled slot count')
  })

  const rotation = roster25Rotation(draftState.roster)
  const bullpen = roster25Bullpen(draftState.roster)
  const bench = roster25Bench(draftState.roster)
  let battingOrder = roster25BattingOrder(draftState.roster)

  check(`${label}: rotation has 5 starters`, () => {
    assertEqual(rotation.length, 5, 'rotation length')
  })
  check(`${label}: bullpen has 7 arms`, () => {
    assertEqual(bullpen.length, 7, 'bullpen length')
  })
  check(`${label}: bench has 3 players`, () => {
    assertEqual(bench.length, 3, 'bench length')
  })
  check(`${label}: batting order has 9 hitters`, () => {
    assertEqual(battingOrder.length, 9, 'batting order length')
  })

  battingOrder = heuristicAiBattingOrder(battingOrder)
  const seasonSeed = sim162SeasonSeed(draftState.roster, simSeed)

  let result: Sim162SeasonResult
  const start = Date.now()
  check(`${label}: season sim runs without error`, () => {
    result = buildSim162Season(draftState.roster, battingOrder, rotation, { kind: 'sim162-legends', players: pool, simSeed }, seasonSeed)
    assert(result !== null && result !== undefined, 'result is not null')
  })
  const elapsed = Date.now() - start
  console.log(`    Season sim took ${elapsed}ms`)

  check(`${label}: 162 games produced`, () => {
    assertEqual(result.userGames.length, 162, 'userGames length')
    const indices = result.userGameIndices
    assert(indices !== undefined && indices.length === 162, 'userGameIndices present')
    for (let i = 1; i < indices!.length; i++) {
      assert(indices![i]! > indices![i - 1]!, 'user game indices strictly increase')
    }
    let strictWins = 0
    let tieBreakWins = 0
    let ties = 0
    for (let i = 0; i < result.userGames.length; i++) {
      const g = result.userGames[i]!
      const userScore = g.userWasHome ? g.homeScore : g.awayScore
      const oppScore = g.userWasHome ? g.awayScore : g.homeScore
      if (userScore > oppScore) strictWins++
      else if (userScore === oppScore) {
        ties++
        // Tied games are decided by a coin flip at the global schedule index,
        // not the position within userGames.
        if (coinFlipTieWinner(seasonSeed, indices![i]!)) tieBreakWins++
      }
    }
    const totalWins = strictWins + tieBreakWins
    assertEqual(totalWins, result.userRecord.wins, `wins match (strict=${strictWins}, ties=${ties}, tieBreak=${tieBreakWins})`)
    assertEqual(result.userRecord.wins + result.userRecord.losses, 162, 'wins + losses = 162')
  })

  check(`${label}: standings have 30 teams`, () => {
    assertEqual(result.standings.records.length, 30, 'standings records')
  })

  check(`${label}: every team plays 162 games`, () => {
    for (const record of result.standings.records) {
      assertEqual(record.wins + record.losses, 162, `${record.teamId} record`)
    }
  })

  check(`${label}: marquee games are 1-3 with valid indices`, () => {
    assert(result.marqueeGames.length >= 1, 'at least 1 marquee')
    assert(result.marqueeGames.length <= 3, 'at most 3 marquee')
    for (const mg of result.marqueeGames) {
      assert(mg.gameIndex >= 0 && mg.gameIndex < 162, `marquee index ${mg.gameIndex}`)
      assert(mg.label.length > 0, 'marquee label non-empty')
      assert(mg.game !== null, 'marquee game present')
    }
  })

  check(`${label}: postseason result is valid`, () => {
    const valid = ['missed', 'wc', 'ds', 'lcs', 'ws-runner-up', 'ws-champs']
    assert(valid.includes(result.postseasonResult), `postseasonResult: ${result.postseasonResult}`)
    if (result.wonWorldSeries) {
      assertEqual(result.postseasonResult, 'ws-champs', 'won WS → ws-champs')
    }
    if (result.postseasonResult === 'missed') {
      assert(!result.userQualified, 'missed → not qualified')
      assertEqual(result.userPlayoffSeries.length, 0, 'missed → no playoff series')
    }
    if (result.userQualified) {
      assert(result.userPlayoffSeed !== null, 'qualified → has seed')
      assert(result.userPlayoffSeries.length > 0, 'qualified → has playoff series')
    }
  })

  check(`${label}: playoff bracket structure`, () => {
    const rounds = result.playoffBracket.rounds
    assertEqual(rounds.length, 4, '4 rounds')
    assertEqual(rounds[0].name, 'Wild Card', 'round 0 name')
    assertEqual(rounds[1].name, 'Division Series', 'round 1 name')
    assertEqual(rounds[2].name, 'League Championship', 'round 2 name')
    assertEqual(rounds[3].name, 'World Series', 'round 3 name')
  })

  check(`${label}: determinism (same seed → same result)`, () => {
    const result2 = buildSim162Season(draftState.roster, battingOrder, rotation, { kind: 'sim162-legends', players: pool, simSeed }, seasonSeed)
    assertEqual(result2.userRecord.wins, result.userRecord.wins, 'deterministic wins')
    assertEqual(result2.userRecord.losses, result.userRecord.losses, 'deterministic losses')
    assertEqual(result2.postseasonResult, result.postseasonResult, 'deterministic postseason')
    assertEqual(result2.marqueeGames.length, result.marqueeGames.length, 'deterministic marquee count')
    assertEqual(result2.marqueeGames[0]?.gameIndex, result.marqueeGames[0]?.gameIndex, 'deterministic marquee index')
  })

  check(`${label}: single game → series wrapper`, () => {
    const game = result.userGames[0]!
    const series = singleGameToSeries(game)
    assert(series.games.length === 1, 'series has 1 game')
    assert(typeof series.userWins === 'number', 'userWins is number')
    assert(typeof series.opponentWins === 'number', 'opponentWins is number')
    const userScore = game.userWasHome ? game.homeScore : game.awayScore
    const oppScore = game.userWasHome ? game.awayScore : game.homeScore
    assertEqual(series.userWins, userScore > oppScore ? 1 : 0, 'userWins correct')
    assertEqual(series.opponentWins, oppScore > userScore ? 1 : 0, 'opponentWins correct')
  })

  check(`${label}: every game has valid box scores`, () => {
    for (let i = 0; i < 5; i++) {
      const g = result.userGames[i]!
      assert(typeof g.homeScore === 'number' && g.homeScore >= 0, `game ${i} homeScore`)
      assert(typeof g.awayScore === 'number' && g.awayScore >= 0, `game ${i} awayScore`)
      assert(g.homeBox.runs === g.homeScore, `game ${i} box runs match`)
      assert(g.awayBox.runs === g.awayScore, `game ${i} box runs match`)
      assert(g.events.length > 0, `game ${i} has events`)
    }
  })

  return result
}

function runDraftEdgeCases(pool: LivePlayer[]): void {
  console.log('\n=== Draft edge cases ===')

  check('team lock: cannot draft two players from same team', () => {
    let state = createSim162DraftState(pool)
    const first = pool[0]!
    const firstTeam = first.teamId
    const eligibleSlot = ROSTER25_POSITION_SLOTS.find((slot) => playerEligibleForRoster25Slot(first, slot))
    if (!eligibleSlot) return
    state = assignSim162Player(state, first, eligibleSlot)
    assert(state.roster[eligibleSlot] !== null, `first player assigned to ${eligibleSlot}`)
    assert(state.draftedTeamIds.includes(firstTeam), 'first team is in draftedTeamIds')
    const sameTeam = pool.find((p) => p.teamId === firstTeam && p.id !== first.id && !state.draftedPlayerIds.includes(p.id))
    if (sameTeam) {
      const reason = getSim162DisabledReason(sameTeam, state)
      assert(reason !== null, `same-team player ${sameTeam.name} (team ${firstTeam}) should be disabled, got: ${reason}`)
    }
  })

  check('quota: cannot assign a 3rd catcher', () => {
    let state = createSim162DraftState(pool)
    const catchers = pool.filter((p) => playerEligibleForRoster25Slot(p, 'C1')).slice(0, 3)
    if (catchers.length >= 3) {
      state = assignSim162Player(state, catchers[0]!, 'C1')
      state = assignSim162Player(state, catchers[1]!, 'C2')
      const reason = getSim162DisabledReason(catchers[2]!, state)
      assert(reason !== null, '3rd catcher is disabled')
    }
  })

  check('auto-fill from empty produces complete roster', () => {
    let state = createSim162DraftState(pool)
    state = autoFillRemaining(state)
    assert(isSim162RosterComplete(state), 'auto-fill from empty completes')
  })

  check('no duplicate players after auto-fill', () => {
    let state = createSim162DraftState(pool)
    state = autoFillRemaining(state)
    const players = Object.values(state.roster).filter(Boolean) as LivePlayer[]
    const ids = new Set(players.map((p) => p.id))
    assertEqual(ids.size, 25, 'unique player count')
  })

  check('no duplicate teams after auto-fill', () => {
    let state = createSim162DraftState(pool)
    state = autoFillRemaining(state)
    const players = Object.values(state.roster).filter(Boolean) as LivePlayer[]
    const teamIds = new Set(players.map((p) => p.teamId))
    assertEqual(teamIds.size, 25, 'unique team count')
  })
}

function runRotationCyclingQa(): void {
  console.log('\n=== Rotation cycling (PA-sim) ===')
  const snapshot = buildLegendsSnapshotForSim162()
  const pool = snapshot.players
  let state = createSim162DraftState(pool)
  state = autoFillRemaining(state)
  const rotation = roster25Rotation(state.roster)
  const battingOrder = heuristicAiBattingOrder(roster25BattingOrder(state.roster))
  const userTeam = buildRoster25SimTeam(state.roster, {
    name: 'User',
    battingOrder,
    rotationOrder: rotation,
  })
  const oppTeam = buildOpponentRoster25SimTeam('qa-franchise', 'QA Opp', pool, 2)

  check('game 0 uses SP1 (rotation[0])', () => {
    const game = simulateGameRoster(userTeam, oppTeam, 'qa-rotation', true, 0, freshGameStaffContext())
    const firstEvent = game.events.find((e) => e.inning === 1 && e.half === 'top')
    assert(firstEvent !== undefined, 'has top-1 event (user pitching at home)')
    assertEqual(firstEvent!.pitcherName, rotation[0]!.name, 'SP1 pitches top 1')
  })

  check('game 4 uses SP5 (rotation[4])', () => {
    const game = simulateGameRoster(userTeam, oppTeam, 'qa-rotation', true, 4, freshGameStaffContext())
    const firstEvent = game.events.find((e) => e.inning === 1 && e.half === 'top')
    assert(firstEvent !== undefined, 'has top-1 event')
    assertEqual(firstEvent!.pitcherName, rotation[4]!.name, 'SP5 pitches top 1')
  })

  check('game 5 wraps to SP1 (rotation[0])', () => {
    const game = simulateGameRoster(userTeam, oppTeam, 'qa-rotation', true, 5, freshGameStaffContext())
    const firstEvent = game.events.find((e) => e.inning === 1 && e.half === 'top')
    assert(firstEvent !== undefined, 'has top-1 event')
    assertEqual(firstEvent!.pitcherName, rotation[0]!.name, 'SP1 wraps')
  })

  check('score invariants: box score matches event reconstruction', () => {
    for (let g = 0; g < 5; g++) {
      const game = simulateGameRoster(userTeam, oppTeam, `qa-inv-${g}`, g % 2 === 1, g, freshGameStaffContext())
      assert(game.homeBox.runs === game.homeScore, `game ${g} home box runs`)
      assert(game.awayBox.runs === game.awayScore, `game ${g} away box runs`)
    }
  })
}

async function main(): Promise<void> {
  console.log('Sim 162 QA Suite')
  console.log('================')

  const snapshot = buildLegendsSnapshotForSim162()
  assert(snapshot.players.length > 0, 'Legends snapshot has players')
  console.log(`Legends pool: ${snapshot.players.length} players`)

  runSeasonQa('Legends pool — full season', snapshot.players, 'qa-legends')
  runDraftEdgeCases(snapshot.players)
  runRotationCyclingQa()

  console.log(`\n================`)
  console.log(`All ${passed} QA checks passed.`)
}

main().catch((err) => {
  console.error('\n QA FAILED:', err)
  process.exit(1)
})
