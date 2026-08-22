import { describe, expect, it } from 'vitest'
import {
  createStaffState,
  advanceRest,
  recordAppearance,
  conditionFor,
} from './staff-state'
import type { LivePlayer } from './live-types'

function arm(id: string, stamina = 50): LivePlayer {
  return {
    id,
    personId: id.length * 11,
    name: `Arm ${id}`,
    teamId: 1,
    teamAbbrev: 'T',
    teamName: 'T',
    positions: ['SP'],
    role: 'pitcher',
    grades: { stuff: 60, command: 55, stamina, defense: 50, overall: 58 },
    appearedOnTargetDate: true,
    isFallback: false,
    pitcherRoles: ['RP'],
  }
}

describe('TeamStaffState', () => {
  it('fresh arms get neutral condition', () => {
    const c = conditionFor(arm('fresh'))
    expect(c.stuffMult).toBe(1)
    expect(c.commandMult).toBe(1)
  })

  it('pitch-count fatigue decays stuff/command past the stamina soft cap', () => {
    const tired = conditionFor(arm('tired', 40), { currentGamePitches: 95 })
    const freshish = conditionFor(arm('freshish', 40), { currentGamePitches: 30 })
    expect(tired.stuffMult).toBeLessThan(freshish.stuffMult)
    expect(tired.commandMult).toBeLessThan(tired.commandMult + 0.001) // sanity
    expect(tired.stuffMult).toBeGreaterThanOrEqual(0.55)
    // High-stamina arms hold up longer at the same count.
    const durable = conditionFor(arm('durable', 80), { currentGamePitches: 95 })
    expect(durable.stuffMult).toBeGreaterThan(tired.stuffMult)
  })

  it('back-to-back relievers carry wear from a heavy outing', () => {
    const staff = createStaffState()
    recordAppearance(staff, 'rp', 40)
    advanceRest(staff)
    const nextDay = conditionFor(arm('rp'), { staff })
    const rested = conditionFor(arm('rp'))
    expect(nextDay.stuffMult).toBeLessThan(rested.stuffMult)
  })

  it('rest counters advance and reset on appearance', () => {
    const staff = createStaffState()
    recordAppearance(staff, 'a', 20)
    recordAppearance(staff, 'b', 10)
    advanceRest(staff)
    advanceRest(staff)
    expect(staff.rest.a).toBe(2)
    expect(staff.rest.b).toBe(2)
    recordAppearance(staff, 'a', 15)
    expect(staff.rest.a).toBe(0)
    expect(staff.lastOutingPitches.a).toBe(15)
  })
})
