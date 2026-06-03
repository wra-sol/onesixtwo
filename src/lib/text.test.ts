import { describe, expect, it } from 'vitest'
import { decodeUnicodeEscapes, normalizeForSearch } from './text'

describe('decodeUnicodeEscapes', () => {
  it('decodes Lahman-style escape sequences', () => {
    expect(decodeUnicodeEscapes('Ronald Acu<U+00F1>a')).toBe('Ronald Acuña')
    expect(decodeUnicodeEscapes('Jos<U+00E9> Abreu')).toBe('José Abreu')
  })

  it('leaves plain ASCII names unchanged', () => {
    expect(decodeUnicodeEscapes('Mike Trout')).toBe('Mike Trout')
  })
})

describe('normalizeForSearch', () => {
  it('matches names without accents', () => {
    expect(normalizeForSearch('Ronald Acuña')).toBe('ronald acuna')
    expect(normalizeForSearch('Ronald Acu<U+00F1>a')).toBe('ronald acuna')
  })
})
