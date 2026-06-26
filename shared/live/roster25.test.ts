import { describe, expect, it } from 'vitest'
import {
  createEmptyRoster25,
  playerEligibleForRoster25Slot,
  roster25BattingOrder,
  roster25Bench,
  roster25Bullpen,
  roster25IsComplete,
  roster25OpenSlots,
  roster25Players,
  roster25QuotaFills,
  roster25Rotation,
  roster25ToSeed,
  ROSTER25_POSITION_SLOTS,
  type Roster25,
  type Roster25Slot,
} from './roster25'
import type { LivePlayer, LivePlayerPosition, PitcherRoleSlot } from './live-types'

const SLOT_POSITION_KEY: Record<Roster25Slot, LivePlayerPosition> = {
  C1: 'C',
  C2: 'C',
  '1B': '1B',
  '2B': '2B',
  '3B': '3B',
  SS: 'SS',
  LF: 'LF',
  CF: 'CF',
  RF: 'RF',
  DH: 'DH',
  BENCH1: 'DH',
  BENCH2: 'DH',
  BENCH3: 'DH',
  SP1: 'SP',
  SP2: 'SP',
  SP3: 'SP',
  SP4: 'SP',
  SP5: 'SP',
  RP1: 'RP',
  RP2: 'RP',
  RP3: 'RP',
  RP4: 'RP',
  RP5: 'RP',
  RP6: 'RP',
  CL: 'CL',
}

function makePlayer(
  id: string,
  pos: LivePlayerPosition,
  overall = 50,
): LivePlayer {
  const isPitcher = pos === 'SP' || pos === 'RP' || pos === 'CL'
  return {
    id,
    personId: 0,
    name: id,
    teamId: 0,
    teamAbbrev: 'TM',
    teamName: 'TM Team',
    positions: [pos],
    role: isPitcher ? 'pitcher' : 'hitter',
    grades: { overall },
    appearedOnTargetDate: true,
    isFallback: false,
    pitcherRoles: isPitcher ? ([pos] as PitcherRoleSlot[]) : undefined,
  }
}

function eligiblePlayerForSlot(slot: Roster25Slot, overall = 50): LivePlayer {
  return makePlayer(`fill-${slot}`, SLOT_POSITION_KEY[slot], overall)
}

describe('roster25', () => {
  it('createEmptyRoster25 has all 25 slots null', () => {
    const roster = createEmptyRoster25()
    expect(ROSTER25_POSITION_SLOTS.length).toBe(25)
    expect(roster25OpenSlots(roster).length).toBe(25)
    expect(roster25Players(roster)).toEqual([])
    expect(roster25IsComplete(roster)).toBe(false)
    expect(roster25QuotaFills(roster).every((entry) => !entry.filled)).toBe(true)
  })

  it('roster25IsComplete true only when all 25 filled', () => {
    const roster = createEmptyRoster25()
    expect(roster25IsComplete(roster)).toBe(false)
    for (const slot of ROSTER25_POSITION_SLOTS) {
      roster[slot] = eligiblePlayerForSlot(slot)
    }
    expect(roster25IsComplete(roster)).toBe(true)
    expect(roster25Players(roster).length).toBe(25)
    expect(roster25QuotaFills(roster).every((entry) => entry.filled)).toBe(true)
    expect(roster25OpenSlots(roster)).toEqual([])
  })

  it('catcher fills C1/C2 but not SP1', () => {
    const catcher = makePlayer('c', 'C')
    expect(playerEligibleForRoster25Slot(catcher, 'C1')).toBe(true)
    expect(playerEligibleForRoster25Slot(catcher, 'C2')).toBe(true)
    expect(playerEligibleForRoster25Slot(catcher, 'SP1')).toBe(false)
    expect(playerEligibleForRoster25Slot(catcher, '1B')).toBe(false)
  })

  it('starter fills SP1-SP5 but not C1 or RP1', () => {
    const starter = makePlayer('sp', 'SP')
    expect(playerEligibleForRoster25Slot(starter, 'SP1')).toBe(true)
    expect(playerEligibleForRoster25Slot(starter, 'SP5')).toBe(true)
    expect(playerEligibleForRoster25Slot(starter, 'C1')).toBe(false)
    expect(playerEligibleForRoster25Slot(starter, 'RP1')).toBe(false)
    expect(playerEligibleForRoster25Slot(starter, 'CL')).toBe(false)
  })

  it('outfielder fills LF/CF/RF', () => {
    const ofAll = makePlayer('of', 'OF')
    expect(playerEligibleForRoster25Slot(ofAll, 'LF')).toBe(true)
    expect(playerEligibleForRoster25Slot(ofAll, 'CF')).toBe(true)
    expect(playerEligibleForRoster25Slot(ofAll, 'RF')).toBe(true)
    expect(playerEligibleForRoster25Slot(ofAll, '1B')).toBe(false)
    const lfOnly = makePlayer('lf', 'LF')
    expect(playerEligibleForRoster25Slot(lfOnly, 'LF')).toBe(true)
    expect(playerEligibleForRoster25Slot(lfOnly, 'CF')).toBe(true)
    expect(playerEligibleForRoster25Slot(lfOnly, 'RF')).toBe(true)
  })

  it('DH-only hitter fills DH and bench but not IF or pitching', () => {
    const dh = makePlayer('dh', 'DH')
    expect(playerEligibleForRoster25Slot(dh, 'DH')).toBe(true)
    expect(playerEligibleForRoster25Slot(dh, 'BENCH1')).toBe(true)
    expect(playerEligibleForRoster25Slot(dh, 'BENCH3')).toBe(true)
    expect(playerEligibleForRoster25Slot(dh, '1B')).toBe(false)
    expect(playerEligibleForRoster25Slot(dh, 'SP1')).toBe(false)
  })

  it('reliever fills RP slots; closer fills CL with RP fallback', () => {
    const rp = makePlayer('rp', 'RP')
    expect(playerEligibleForRoster25Slot(rp, 'RP1')).toBe(true)
    expect(playerEligibleForRoster25Slot(rp, 'RP6')).toBe(true)
    expect(playerEligibleForRoster25Slot(rp, 'CL')).toBe(true)
    expect(playerEligibleForRoster25Slot(rp, 'SP1')).toBe(false)
    const cl = makePlayer('cl', 'CL')
    expect(playerEligibleForRoster25Slot(cl, 'CL')).toBe(true)
    expect(playerEligibleForRoster25Slot(cl, 'RP1')).toBe(false)
    expect(playerEligibleForRoster25Slot(cl, 'SP1')).toBe(false)
  })

  it('rotation returns 5 starters in order', () => {
    const roster = createEmptyRoster25()
    roster.SP1 = makePlayer('sp1', 'SP', 60)
    roster.SP2 = makePlayer('sp2', 'SP', 58)
    roster.SP3 = makePlayer('sp3', 'SP', 56)
    roster.SP4 = makePlayer('sp4', 'SP', 54)
    roster.SP5 = makePlayer('sp5', 'SP', 52)
    const rotation = roster25Rotation(roster)
    expect(rotation.map((p) => p.id)).toEqual(['sp1', 'sp2', 'sp3', 'sp4', 'sp5'])
  })

  it('bullpen returns 7 arms in order and bench returns 3', () => {
    const roster = createEmptyRoster25()
    roster.RP1 = makePlayer('rp1', 'RP')
    roster.RP2 = makePlayer('rp2', 'RP')
    roster.RP3 = makePlayer('rp3', 'RP')
    roster.RP4 = makePlayer('rp4', 'RP')
    roster.RP5 = makePlayer('rp5', 'RP')
    roster.RP6 = makePlayer('rp6', 'RP')
    roster.CL = makePlayer('cl', 'CL')
    expect(roster25Bullpen(roster).map((p) => p.id)).toEqual([
      'rp1',
      'rp2',
      'rp3',
      'rp4',
      'rp5',
      'rp6',
      'cl',
    ])
    roster.BENCH1 = makePlayer('b1', 'DH')
    roster.BENCH2 = makePlayer('b2', 'DH')
    roster.BENCH3 = makePlayer('b3', 'DH')
    expect(roster25Bench(roster).map((p) => p.id)).toEqual(['b1', 'b2', 'b3'])
  })

  it('batting order is the 9 starters sorted by overall, excluding C2/bench/pitchers', () => {
    const roster = createEmptyRoster25()
    roster.C1 = makePlayer('c1', 'C', 70)
    roster['1B'] = makePlayer('1b', '1B', 40)
    roster['2B'] = makePlayer('2b', '2B', 55)
    roster['3B'] = makePlayer('3b', '3B', 60)
    roster.SS = makePlayer('ss', 'SS', 50)
    roster.LF = makePlayer('lf', 'LF', 65)
    roster.CF = makePlayer('cf', 'CF', 45)
    roster.RF = makePlayer('rf', 'RF', 75)
    roster.DH = makePlayer('dh', 'DH', 80)
    roster.C2 = makePlayer('c2', 'C', 99)
    roster.BENCH1 = makePlayer('b1', 'DH', 99)
    roster.SP1 = makePlayer('sp1', 'SP', 99)
    const order = roster25BattingOrder(roster)
    expect(order.length).toBe(9)
    expect(order.map((p) => p.id)).toEqual([
      'dh',
      'rf',
      'c1',
      'lf',
      '3b',
      '2b',
      'ss',
      'cf',
      '1b',
    ])
    expect(order.some((p) => p.id === 'c2' || p.id === 'b1' || p.id === 'sp1')).toBe(
      false,
    )
  })

  it('roster25ToSeed is stable and differs when roster changes', () => {
    const roster = createEmptyRoster25()
    const emptySeed = roster25ToSeed(roster)
    roster.C1 = makePlayer('c1', 'C')
    const seeded = roster25ToSeed(roster)
    expect(roster25ToSeed({ ...roster } as Roster25)).toBe(seeded)
    expect(seeded).not.toBe(emptySeed)
    expect(seeded).toContain('C1:c1')
  })
})
