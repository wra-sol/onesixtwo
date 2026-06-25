export function challengeDateFromClient(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

export function targetDateFromClient(now = new Date()): string {
  const eastern = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
  )
  eastern.setDate(eastern.getDate() - 1)
  return eastern.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}
