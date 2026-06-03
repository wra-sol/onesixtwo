import { BRAND } from '../../src/lib/brand'
import { escapeHtml } from './html'
import type { ResolvedShare } from './resolve-share'

export function buildShareMetaTags(share: ResolvedShare): string {
  return [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(BRAND.name)}" />`,
    `<meta property="og:title" content="${escapeHtml(share.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(share.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(share.shareUrl)}" />`,
    `<meta property="og:image" content="${escapeHtml(share.ogImageUrl)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(`${share.title} lineup card`)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(share.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(share.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(share.ogImageUrl)}" />`,
    `<title>${escapeHtml(share.title)}</title>`,
    `<link rel="canonical" href="${escapeHtml(share.shareUrl)}" />`,
  ].join('\n    ')
}

export function buildBotShareHtml(share: ResolvedShare): string {
  const meta = buildShareMetaTags(share)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${meta}
  </head>
  <body>
    <p>${escapeHtml(share.title)}</p>
    <p>${escapeHtml(share.description)}</p>
    <p><a href="${escapeHtml(BRAND.url)}">Play ${escapeHtml(BRAND.name)}</a></p>
  </body>
</html>`
}

export function injectShareMetaIntoHtml(html: string, share: ResolvedShare): string {
  const meta = buildShareMetaTags(share)
  const withoutTitle = html.replace(/<title>[\s\S]*?<\/title>\s*/i, '')
  const withoutCanonical = withoutTitle.replace(
    /<link rel="canonical"[^>]*>\s*/i,
    '',
  )
  const withoutOg = withoutCanonical.replace(
    /<meta\s+[^>]*property="og:[^"]+"[^>]*>\s*/gi,
    '',
  )
  const withoutTwitter = withoutOg.replace(
    /<meta\s+[^>]*name="twitter:[^"]+"[^>]*>\s*/gi,
    '',
  )
  return withoutTwitter.replace('</head>', `    ${meta}\n  </head>`)
}
