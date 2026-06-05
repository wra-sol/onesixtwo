import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  buildActivePlayerCard,
  personIdFromMlbId,
  positionsFromMlbCodes,
} from './lib/active-player-builder.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, 'fixtures/mlb')

describe('active-player-builder', () => {
  it('maps MLB position codes to lineup positions', () => {
    expect(positionsFromMlbCodes(['6', 'SS'])).toEqual(['SS'])
    expect(positionsFromMlbCodes(['1', 'P'])).toEqual(['SP'])
  })

  it('builds hitter cards from hydrated season stats fixture', () => {
    const person = JSON.parse(
      readFileSync(join(fixturesDir, 'person-hitter.json'), 'utf8'),
    )
    const card = buildActivePlayerCard(
      {
        personId: personIdFromMlbId(person.id),
        mlbPersonId: person.id,
        name: person.fullName,
        teamId: 'yankees',
        positionCodes: ['6'],
        person,
      },
      1,
    )

    expect(card).not.toBeNull()
    expect(card?.role).toBe('hitter')
    expect(card?.ratings.overall).toBeGreaterThan(0)
    expect(card?.stats).toMatchObject({ hr: expect.any(Number) })
  })

  it('builds pitcher cards from hydrated season stats fixture', () => {
    const person = JSON.parse(
      readFileSync(join(fixturesDir, 'person-pitcher.json'), 'utf8'),
    )
    const card = buildActivePlayerCard(
      {
        personId: personIdFromMlbId(person.id),
        mlbPersonId: person.id,
        name: person.fullName,
        teamId: 'cubs',
        positionCodes: ['1'],
        person,
      },
      1,
    )

    expect(card).not.toBeNull()
    expect(card?.role).toBe('pitcher')
    expect(card?.positions).toContain('SP')
  })
})
