import { describe, expect, it } from 'vitest'

import { familyForPitch, toPlayerArsenal } from './mlb-parsers'

describe('familyForPitch', () => {
  it('maps MLB pitch codes to sim families', () => {
    expect(familyForPitch('FF')).toBe('fastball')
    expect(familyForPitch('SI')).toBe('fastball')
    expect(familyForPitch('FC')).toBe('fastball')
    expect(familyForPitch('SL')).toBe('breaking')
    expect(familyForPitch('ST')).toBe('breaking')
    expect(familyForPitch('KC')).toBe('breaking')
    expect(familyForPitch('CH')).toBe('offspeed')
    expect(familyForPitch('FS')).toBe('offspeed')
  })

  it('falls back to description keywords, then fastball', () => {
    expect(familyForPitch('XX', 'Sweeper')).toBe('breaking')
    expect(familyForPitch('XX', 'Changeup')).toBe('offspeed')
    expect(familyForPitch('XX', 'Mystery Ball')).toBe('fastball')
  })
})

describe('toPlayerArsenal', () => {
  it('normalizes usage and maps families', () => {
    const arsenal = toPlayerArsenal([
      { percentage: 0.5, type: { code: 'FF', description: 'Four-seam FB' } },
      { percentage: 0.3, type: { code: 'SL', description: 'Slider' } },
      { percentage: 0.2, type: { code: 'CH', description: 'Changeup' } },
    ])
    expect(arsenal?.pitches.map((p) => p.family)).toEqual(['fastball', 'breaking', 'offspeed'])
    expect(arsenal?.pitches.reduce((s, p) => s + p.usage, 0)).toBeCloseTo(1, 5)
    expect(arsenal?.pitches[0].name).toBe('Four-seam FB')
  })

  it('returns undefined for empty input so synthesis stays in charge', () => {
    expect(toPlayerArsenal([])).toBeUndefined()
  })
})
