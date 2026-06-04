import { describe, expect, it } from 'vitest'
import { buildBucket } from './build-player-data.ts'
import { lahmanDataAvailable } from './lib/lahman.ts'
import { canonicalPersonId } from './lib/person-id.ts'
import { SEED_PLAYERS_BACKUP } from '../src/data/seed-players.backup.ts'
import type { HitterStats, PitcherStats } from '../src/lib/types.ts'

const hasLahman = lahmanDataAvailable()

describe.skipIf(!hasLahman)('buildBucket team-scoped stats', () => {
  it('uses Pirates 1990s Lahman totals for Barry Bonds, not archived career stats', () => {
    const archivedBonds = SEED_PLAYERS_BACKUP.find(
      (player) => player.name === 'Barry Bonds' && player.teamId === 'pirates',
    )
    expect(archivedBonds).toBeDefined()
    expect((archivedBonds!.stats as HitterStats).hr).toBe(762)

    const { players } = buildBucket('pirates', '1990s')
    const personId = canonicalPersonId(archivedBonds!)
    const card = players.find((player) => player.personId === personId)

    expect(card).toBeDefined()
    expect(card!.teamId).toBe('pirates')
    expect(card!.era).toBe('1990s')
    expect((card!.stats as HitterStats).hr).toBeLessThan(200)
    expect((card!.stats as HitterStats).hr).not.toBe(762)
  })

  it('uses Astros 1980s Lahman totals for Nolan Ryan, not archived career stats', () => {
    const archivedRyan = SEED_PLAYERS_BACKUP.find(
      (player) => player.name === 'Nolan Ryan' && player.teamId === 'astros',
    )
    expect(archivedRyan).toBeDefined()
    expect((archivedRyan!.stats as PitcherStats).so).toBe(5714)

    const { players } = buildBucket('astros', '1980s')
    const personId = canonicalPersonId(archivedRyan!)
    const card = players.find((player) => player.personId === personId)

    expect(card).toBeDefined()
    expect(card!.teamId).toBe('astros')
    expect(card!.era).toBe('1980s')
    expect((card!.stats as PitcherStats).so).toBeLessThan(2000)
    expect((card!.stats as PitcherStats).so).not.toBe(5714)
  })

  it('keeps Giants 2000s Bonds distinct from Pirates 1990s Bonds', () => {
    const pirates = buildBucket('pirates', '1990s').players.find(
      (player) => player.name === 'Barry Bonds',
    )
    const giants = buildBucket('giants', '2000s').players.find(
      (player) => player.name === 'Barry Bonds',
    )

    expect(pirates).toBeDefined()
    expect(giants).toBeDefined()
    expect((pirates!.stats as HitterStats).hr).not.toBe(
      (giants!.stats as HitterStats).hr,
    )
  })

  it('builds Shohei Ohtani as two-way for Angels 2010s', () => {
    const { players } = buildBucket('angels', '2010s')
    const ohtani = players.find((player) => player.personId === 'ohtansh01')
    expect(ohtani).toBeDefined()
    expect(ohtani!.role).toBe('two-way')
    expect(ohtani!.battingStats).toBeDefined()
    expect(ohtani!.pitchingStats).toBeDefined()
    expect(ohtani!.positions).toContain('DH')
    expect(ohtani!.positions).toContain('SP')
  })

  it('classifies NL-style aces as pitcher-only, not two-way', () => {
    const dodgers2010s = buildBucket('dodgers', '2010s').players
    const kershaw = dodgers2010s.find((player) => player.name === 'Clayton Kershaw')
    expect(kershaw).toBeDefined()
    expect(kershaw!.role).toBe('pitcher')
    expect(kershaw!.battingStats).toBeUndefined()

    const braves1990s = buildBucket('braves', '1990s').players
    const maddux = braves1990s.find((player) => player.name === 'Greg Maddux')
    expect(maddux).toBeDefined()
    expect(maddux!.role).toBe('pitcher')
    expect(maddux!.battingStats).toBeUndefined()
  })

  it('does not place Bonds in Pirates 2000s with archived career totals', () => {
    const { players } = buildBucket('pirates', '2000s')
    const bonds = players.find((player) => player.name === 'Barry Bonds')
    if (bonds) {
      expect((bonds.stats as HitterStats).hr).not.toBe(762)
    }
  })

  it('includes at least two starter-profile and two dedicated reliever-profile pitchers', () => {
    const { players } = buildBucket('yankees', '1990s')
    const starters = players.filter(
      (player) => player.role !== 'hitter' && (player.pitchingStats ?? player.stats),
    ).filter((player) => {
      const stats = player.pitchingStats ?? player.stats
      if (!('gs' in stats)) return false
      const gs = stats.gs ?? 0
      const g = stats.g ?? gs
      const relief = stats.reliefGames ?? Math.max(0, g - gs)
      return gs >= 20 || gs > relief
    })
    const relievers = players.filter((player) => {
      const stats = player.pitchingStats ?? player.stats
      if (!('gs' in stats)) return false
      const gs = stats.gs ?? 0
      const g = stats.g ?? gs
      const relief = stats.reliefGames ?? Math.max(0, g - gs)
      return relief >= 20 && relief > gs
    })
    expect(starters.length).toBeGreaterThanOrEqual(2)
    expect(relievers.length).toBeGreaterThanOrEqual(2)
  })

  it('guarantees the best dedicated relievers from the era, not starter swingmen', () => {
    const { players } = buildBucket('nationals', '2020s')
    const relievers = players
      .filter((player) => {
        const stats = player.pitchingStats ?? player.stats
        if (!('gs' in stats)) return false
        const gs = stats.gs ?? 0
        const g = stats.g ?? gs
        const relief = stats.reliefGames ?? Math.max(0, g - gs)
        return relief >= 20 && relief > gs
      })
      .map((player) => player.name)
    expect(relievers).toContain('Erasmo Ramirez')
    expect(relievers).toContain('Joe Ross')
    expect(relievers).not.toContain('Mitchell Parker')
  })
})
