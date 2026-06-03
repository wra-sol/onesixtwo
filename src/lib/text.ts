/** Lahman CSV exports non-ASCII names as `<U+XXXX>` escape sequences. */
export function decodeUnicodeEscapes(text: string): string {
  return text.replace(/<U\+([0-9A-Fa-f]{4,6})>/gi, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16)),
  )
}

/** Case- and accent-insensitive match for player search (e.g. "acuna" → "Acuña"). */
export function normalizeForSearch(text: string): string {
  return decodeUnicodeEscapes(text)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}
