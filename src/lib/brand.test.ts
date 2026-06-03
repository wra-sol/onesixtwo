import { describe, expect, it } from 'vitest'
import { PLAYER_BY_ID } from '../data'
import {
  BRAND,
  formatLineupShareSummary,
  formatShareText,
  sharePlayerName,
} from './brand'
import { BENCHMARK_EXPECTATIONS } from './calibration'
import { createEmptyLineup } from './game'
import { LINEUP_POSITIONS } from './types'

describe('formatShareText', () => {
  it('includes brand, record, lineup, challenge, and domain', () => {
    const text = formatShareText({
      wins: 118,
      losses: 44,
      lineupSummary: 'C Rodriguez · P Martinez',
      mvpLine: 'MVP: Barry Bonds (LF)',
      tierLabel: 'Dynasty',
      identityLabel: 'Balanced juggernaut',
      luckDelta: 4,
    })
    expect(text).toContain(BRAND.name)
    expect(text).toContain('118-44')
    expect(text).toContain(BRAND.domain)
    expect(text).toContain(BRAND.perfectRecord)
    expect(text).toContain('C Rodriguez · P Martinez')
    expect(text).toContain('MVP: Barry Bonds (LF)')
    expect(text).toContain('Balanced juggernaut')
    expect(text).toContain('+4 wins over expectation')
  })

  it('uses perfect-season copy at 162-0', () => {
    const text = formatShareText({
      wins: 162,
      losses: 0,
      lineupSummary: 'C Bench',
      mvpLine: null,
      tierLabel: 'Perfect Season',
    })
    expect(text).toContain('Perfect Season')
    expect(text).toContain(`Can you chase ${BRAND.perfectRecord}?`)
  })

  it('includes signature moment when no luck delta', () => {
    const text = formatShareText({
      wins: 105,
      losses: 57,
      lineupSummary: 'C Bench',
      signatureMoment: 'Power powered 72 wins.',
      tierLabel: 'Contender',
      identityLabel: 'Slugger-heavy contender',
    })
    expect(text).toContain('Slugger-heavy contender')
    expect(text).toContain('Power powered 72 wins.')
  })
})

describe('sharePlayerName', () => {
  it('uses the last token of a full name', () => {
    expect(sharePlayerName('Ivan Rodriguez')).toBe('Rodriguez')
    expect(sharePlayerName('Madison')).toBe('Madison')
  })
})

describe('formatLineupShareSummary', () => {
  it('uses last names and skips empty slots', () => {
    const catcher = [...PLAYER_BY_ID.values()].find((p) =>
      p.positions.includes('C'),
    )
    const pitcher = [...PLAYER_BY_ID.values()].find((p) => p.role === 'pitcher')
    expect(catcher).toBeDefined()
    expect(pitcher).toBeDefined()

    const lineup = createEmptyLineup()
    lineup.C = catcher!
    lineup.P = pitcher!

    const summary = formatLineupShareSummary(LINEUP_POSITIONS, lineup)
    expect(summary).toContain(`C ${sharePlayerName(catcher!.name)}`)
    expect(summary).toContain(`P ${sharePlayerName(pitcher!.name)}`)
    expect(summary).not.toContain('1B')
  })
})

describe('calibration contract', () => {
  it('defines benchmark expectations for all tiers', () => {
    expect(BENCHMARK_EXPECTATIONS.mediocre.canReachPerfect).toBe(false)
    expect(BENCHMARK_EXPECTATIONS.great.canReachPerfect).toBe(false)
    expect(BENCHMARK_EXPECTATIONS.elite.canReachPerfect).toBe(false)
    expect(BENCHMARK_EXPECTATIONS.nearPerfect.canReachPerfect).toBe(true)
  })
})
