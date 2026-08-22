import { describe, expect, it } from 'vitest'
import {
  getArsenal,
  pickPitchFamily,
  arsenalQualityFor,
  synthesizePitchArsenal,
  synthesizeBatterProfile,
} from './pitch-profiles'
import type { LivePlayer } from './live-types'

function pitcher(id: string, over: Partial<LivePlayer> = {}): LivePlayer {
  return {
    id,
    personId: id.length * 7,
    name: `P ${id}`,
    teamId: 1,
    teamAbbrev: 'T',
    teamName: 'T',
    positions: ['SP'],
    role: 'pitcher',
    pitchHand: 'R',
    grades: { stuff: 55, command: 55, stamina: 50, defense: 50, overall: 55 },
    appearedOnTargetDate: true,
    isFallback: false,
    pitcherRoles: ['SP'],
    ...over,
  }
}

function hitter(id: string, over: Partial<LivePlayer> = {}): LivePlayer {
  return pitcher(id, {
    role: 'hitter',
    positions: ['OF'],
    batSide: 'R',
    pitcherRoles: undefined,
    ...over,
  })
}
void hitter

describe('synthesizePitchArsenal', () => {
  it('produces usage weights that sum to 1 with sane quality bands', () => {
    const arsenal = synthesizePitchArsenal(pitcher('a'))
    expect(arsenal.pitches.length).toBeGreaterThanOrEqual(2)
    const total = arsenal.pitches.reduce((s, p) => s + p.usage, 0)
    expect(total).toBeCloseTo(1, 5)
    for (const pitch of arsenal.pitches) {
      expect(pitch.quality).toBeGreaterThan(25)
      expect(pitch.quality).toBeLessThan(95)
    }
  })

  it('is deterministic per player', () => {
    const a = synthesizePitchArsenal(pitcher('stable-id'))
    const b = synthesizePitchArsenal(pitcher('stable-id'))
    expect(b).toEqual(a)
  })

  it('power arms lean breaking-heavy; command arms lean fastball/offspeed', () => {
    const powerArm = synthesizePitchArsenal(
      pitcher('power', { grades: { stuff: 80, command: 30, stamina: 40, defense: 50, overall: 70 } }),
    )
    const commandArm = synthesizePitchArsenal(
      pitcher('command', { grades: { stuff: 35, command: 80, stamina: 60, defense: 50, overall: 55 } }),
    )
    const usageOf = (ars: ReturnType<typeof synthesizePitchArsenal>, family: string) =>
      ars.pitches.find((p) => p.family === family)?.usage ?? 0
    expect(usageOf(powerArm, 'breaking')).toBeGreaterThan(usageOf(commandArm, 'breaking'))
    expect(usageOf(commandArm, 'fastball')).toBeGreaterThan(usageOf(powerArm, 'fastball'))
  })

  it('different ids yield different arsenals for identical grades', () => {
    const a = synthesizePitchArsenal(pitcher('twin-a'))
    const b = synthesizePitchArsenal(pitcher('twin-b'))
    expect(b).not.toEqual(a)
  })
})

describe('getArsenal hybrid seam', () => {
  it('prefers a real snapshot mix and derives quality from grades', () => {
    const player = pitcher('live-arm', {
      grades: { stuff: 80, command: 50, stamina: 50, defense: 50, overall: 75 },
      arsenal: {
        pitches: [
          { name: '4-Seamer', family: 'fastball', usage: 0.6 },
          { family: 'slider', usage: 0.4 } as never,
        ],
      },
    })
    player.arsenal!.pitches[1].family = 'breaking'

    const arsenal = getArsenal(player)
    expect(arsenal.pitches.map((p) => p.family)).toEqual(['fastball', 'breaking'])
    const fb = arsenalQualityFor(arsenal, 'fastball')
    const brk = arsenalQualityFor(arsenal, 'breaking')
    // Fastball quality blends in more command; breaking leans on the 80 stuff.
    expect(brk).toBeGreaterThan(fb)
    // Usage comes straight from the snapshot.
    expect(arsenal.pitches.find((p) => p.family === 'fastball')!.usage).toBe(0.6)
  })

  it('falls back to synthesis when no arsenal is present', () => {
    const bare = pitcher('bare')
    expect(getArsenal(bare)).toEqual(synthesizePitchArsenal(bare))
  })
})

describe('pickPitchFamily', () => {
  const arsenal = {
    pitches: [
      { family: 'fastball' as const, usage: 0.5, quality: 55 },
      { family: 'breaking' as const, usage: 0.3, quality: 60 },
      { family: 'offspeed' as const, usage: 0.2, quality: 50 },
    ],
  }
  it('selects by weighted usage', () => {
    expect(pickPitchFamily(arsenal, 0.2)).toBe('fastball')
    expect(pickPitchFamily(arsenal, 0.7)).toBe('breaking')
    expect(pickPitchFamily(arsenal, 0.95)).toBe('offspeed')
  })
})

describe('synthesizeBatterProfile', () => {
  it('is deterministic and stays inside sane multiplier bands', () => {
    const player = pitcher('batter-1', {
      role: 'hitter',
      batSide: 'L',
      grades: { contact: 70, power: 40, speed: 75, defense: 45, overall: 62 },
    })
    const profile = synthesizeBatterProfile(player)
    expect(profile).toEqual(synthesizeBatterProfile(player))

    for (const family of ['fastball', 'breaking', 'offspeed'] as const) {
      expect(profile.contactMod[family]).toBeGreaterThan(0.75)
      expect(profile.contactMod[family]).toBeLessThan(1.25)
      expect(profile.powerMod[family]).toBeGreaterThan(0.8)
      expect(profile.powerMod[family]).toBeLessThan(1.2)
    }
    expect(profile.chaseMod).toBeGreaterThan(0.8)
    expect(profile.chaseMod).toBeLessThan(1.3)
  })

  it('speedy contact batters hit fastballs better than sluggers chase-breaking ones', () => {
    const speedster = synthesizeBatterProfile(
      pitcher('speed', {
        role: 'hitter',
        grades: { contact: 65, power: 35, speed: 85, defense: 50, overall: 60 },
      }),
    )
    const slugger = synthesizeBatterProfile(
      pitcher('slug', {
        role: 'hitter',
        grades: { contact: 35, power: 90, speed: 30, defense: 50, overall: 65 },
      }),
    )
    expect(speedster.contactMod.fastball).toBeGreaterThan(slugger.contactMod.fastball)
    expect(speedster.chaseMod).toBeLessThan(slugger.chaseMod)
  })
})
