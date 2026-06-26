import { describe, expect, it } from 'vitest'
import {
  buildSim162SharePath,
  isParsedSim162Share,
  parseSim162ShareParams,
  sim162ShareValidationMessage,
  type Sim162ShareInput,
} from './sim162-share-url'

const SAMPLE_INPUT: Sim162ShareInput = {
  pool: 'live',
  challengeDate: '2026-06-25',
  playerIds: Array.from({ length: 25 }, (_, i) => `p${i}`),
  battingOrderIds: ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'],
  rotationOrderIds: ['r0', 'r1', 'r2', 'r3', 'r4'],
  simSeed: 'test-seed-abc',
}

describe('sim162-share-url', () => {
  it('round-trips a share input through build and parse', () => {
    const path = buildSim162SharePath(SAMPLE_INPUT)
    expect(path).toMatch(/^\/sim162-share\?/)

    const parsed = parseSim162ShareParams(
      new URLSearchParams(path.split('?')[1]),
    )
    expect(isParsedSim162Share(parsed)).toBe(true)
    if (!isParsedSim162Share(parsed)) return

    expect(parsed.pool).toBe(SAMPLE_INPUT.pool)
    expect(parsed.challengeDate).toBe(SAMPLE_INPUT.challengeDate)
    expect(parsed.playerIds).toEqual(SAMPLE_INPUT.playerIds)
    expect(parsed.battingOrderIds).toEqual(SAMPLE_INPUT.battingOrderIds)
    expect(parsed.rotationOrderIds).toEqual(SAMPLE_INPUT.rotationOrderIds)
    expect(parsed.simSeed).toBe(SAMPLE_INPUT.simSeed)
  })

  it('round-trips a legends pool input', () => {
    const legendsInput: Sim162ShareInput = {
      ...SAMPLE_INPUT,
      pool: 'legends',
    }
    const path = buildSim162SharePath(legendsInput)
    const parsed = parseSim162ShareParams(
      new URLSearchParams(path.split('?')[1]),
    )
    expect(isParsedSim162Share(parsed)).toBe(true)
    if (!isParsedSim162Share(parsed)) return
    expect(parsed.pool).toBe('legends')
  })

  it('rejects invalid pool', () => {
    const params = new URLSearchParams(buildSim162SharePath(SAMPLE_INPUT).split('?')[1])
    params.set('pool', 'invalid')
    const parsed = parseSim162ShareParams(params)
    expect(isParsedSim162Share(parsed)).toBe(false)
  })

  it('rejects wrong roster size', () => {
    const params = new URLSearchParams(buildSim162SharePath(SAMPLE_INPUT).split('?')[1])
    params.set('p', 'a,b,c')
    const parsed = parseSim162ShareParams(params)
    expect(isParsedSim162Share(parsed)).toBe(false)
  })

  it('rejects wrong batting order size', () => {
    const params = new URLSearchParams(buildSim162SharePath(SAMPLE_INPUT).split('?')[1])
    params.set('bo', 'a,b')
    const parsed = parseSim162ShareParams(params)
    expect(isParsedSim162Share(parsed)).toBe(false)
  })

  it('rejects wrong rotation size', () => {
    const params = new URLSearchParams(buildSim162SharePath(SAMPLE_INPUT).split('?')[1])
    params.set('ro', 'a,b')
    const parsed = parseSim162ShareParams(params)
    expect(isParsedSim162Share(parsed)).toBe(false)
  })

  it('rejects missing seed', () => {
    const params = new URLSearchParams(buildSim162SharePath(SAMPLE_INPUT).split('?')[1])
    params.delete('seed')
    const parsed = parseSim162ShareParams(params)
    expect(isParsedSim162Share(parsed)).toBe(false)
  })

  it('rejects missing challenge date', () => {
    const params = new URLSearchParams(buildSim162SharePath(SAMPLE_INPUT).split('?')[1])
    params.delete('date')
    const parsed = parseSim162ShareParams(params)
    expect(isParsedSim162Share(parsed)).toBe(false)
  })

  it('returns a human-readable validation message', () => {
    const params = new URLSearchParams()
    const parsed = parseSim162ShareParams(params)
    expect(isParsedSim162Share(parsed)).toBe(false)
    if (isParsedSim162Share(parsed)) return
    expect(sim162ShareValidationMessage(parsed)).toBeTypeOf('string')
    expect(sim162ShareValidationMessage(parsed).length).toBeGreaterThan(0)
  })
})
