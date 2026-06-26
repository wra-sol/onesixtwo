export function snakeDraftSide(
  pickNumber: number,
  userPicksFirst: boolean,
): 'user' | 'ai' {
  const round = Math.floor((pickNumber - 1) / 2)
  const isFirstInRound = (pickNumber - 1) % 2 === 0
  const userFirstThisRound = round % 2 === 0 ? userPicksFirst : !userPicksFirst
  if (isFirstInRound) {
    return userFirstThisRound ? 'user' : 'ai'
  }
  return userFirstThisRound ? 'ai' : 'user'
}
