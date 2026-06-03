const BOT_UA =
  /bot|crawl|slurp|spider|mediapartners|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegram|preview/i

export function isShareBot(userAgent: string): boolean {
  return BOT_UA.test(userAgent)
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
