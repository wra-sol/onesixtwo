import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeUnicodeEscapes } from '../../src/lib/text.ts'
import { LAHMAN_DIR } from './lahman.ts'
import { parseCsv } from './parse-csv.ts'

export function normalizePlayerName(name: string): string {
  return decodeUnicodeEscapes(name).toLowerCase().replace(/\s+/g, ' ').trim()
}

let nameToBbref: Map<string, string> | null = null

function loadNameToBbref(): Map<string, string> {
  if (nameToBbref) {
    return nameToBbref
  }
  nameToBbref = new Map()
  const path = join(LAHMAN_DIR, 'People.csv')
  if (!existsSync(path)) {
    return nameToBbref
  }
  for (const row of parseCsv(readFileSync(path, 'utf8'))) {
    const first = row.nameFirst ?? ''
    const last = row.nameLast ?? ''
    const bbref = row.bbrefID || row.playerID
    if (!bbref) {
      continue
    }
    const name = normalizePlayerName(`${first} ${last}`)
    if (!nameToBbref.has(name)) {
      nameToBbref.set(name, bbref)
    }
  }
  return nameToBbref
}

/** Align seed slug personIds with Lahman bbrefID so bucket dedupe works. */
export function canonicalPersonId(player: {
  personId: string
  name: string
}): string {
  const mapped = loadNameToBbref().get(normalizePlayerName(player.name))
  return mapped ?? player.personId
}

export function withCanonicalPersonId<T extends { personId: string; name: string }>(
  player: T,
): T {
  return { ...player, personId: canonicalPersonId(player) }
}
